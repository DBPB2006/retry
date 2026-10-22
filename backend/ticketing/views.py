from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Ticket


def _serialize_ticket(t):
    """Formats an owned Ticket instance into a JSON-serializable dictionary."""
    if not t.qr_token and t.status in ('ACTIVE', 'LISTED'):
        t.generate_qr_credential()
        t.save()

    ev = t.event
    pr = ev.provider
    resale = getattr(t, 'resale_listing', None)
    is_resale_active = resale and resale.status == 'ACTIVE'

    return {
        'id': t.id,
        'ticket_ref': t.ticket_ref,
        'booking_reference': t.booking_reference,
        'title': ev.title,
        'category': ev.category,
        'provider_name': pr.name,
        'provider_logo': pr.logo_url,
        'venue_or_route': ev.venue_or_route,
        'seat_or_coach': t.seat_or_coach,
        'start_time': ev.start_time.isoformat(),
        'end_time': ev.end_time.isoformat() if ev.end_time else None,
        'event_date': ev.start_time.isoformat(),
        'itinerary_or_details': ev.itinerary_or_details,
        'image_url': ev.image_url,
        'face_value': str(t.face_value),
        'attendee_name': t.attendee_name,
        'status': t.status,
        'qr_token': t.qr_token,
        'qr_image_url': t.qr_image.url if t.qr_image else None,
        'resale_listing_id': resale.id if is_resale_active else None,
        'resale_asking_price': str(resale.asking_price) if is_resale_active else None,
        'is_eligible_for_resale': (t.status == 'ACTIVE' and ev.start_time > timezone.now()),
        'used_at': t.used_at.isoformat() if t.used_at else None,
        'created_at': t.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_tickets(request):
    """Returns all tickets owned by the authenticated user in their Ticket Vault."""
    tickets = Ticket.objects.filter(
        owner=request.user
    ).select_related('event', 'event__provider', 'resale_listing')

    results = [_serialize_ticket(t) for t in tickets]
    return Response({
        'count': len(results),
        'tickets': results
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ticket_detail(request, pk):
    """Returns details for a single ticket owned by the authenticated user."""
    try:
        t = Ticket.objects.select_related('event', 'event__provider', 'resale_listing').get(pk=pk, owner=request.user)
    except Ticket.DoesNotExist:
        return Response({'error': 'Ticket not found in your vault.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({'ticket': _serialize_ticket(t)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_eligible_resale_tickets(request):
    """
    Returns owned tickets eligible to be listed for peer-to-peer resale.
    Requires user to own the ticket, be identity verified, status to be ACTIVE, and event date in the future.
    """
    if not request.user.is_identity_verified or not request.user.verified_legal_name:
        return Response({
            'error': 'Identity verification required.',
            'code': 'KYC_REQUIRED',
            'tickets': []
        }, status=status.HTTP_403_FORBIDDEN)

    tickets = Ticket.objects.filter(
        owner=request.user,
        status='ACTIVE',
        event__start_time__gt=timezone.now()
    ).select_related('event', 'event__provider').order_by('event__start_time')

    results = [
        {
            'id': t.id,
            'ticket_ref': t.ticket_ref,
            'booking_reference': t.booking_reference,
            'title': t.event.title,
            'category': t.event.category,
            'provider_name': t.event.provider.name,
            'venue_or_route': t.event.venue_or_route,
            'seat_or_coach': t.seat_or_coach,
            'event_date': t.event.start_time.isoformat(),
            'face_value': str(t.face_value),
            'max_allowed_resale_price': str((t.face_value * Decimal('1.20')).quantize(Decimal('0.01'))),
            'attendee_name': t.attendee_name,
        }
        for t in tickets
    ]

    return Response({
        'count': len(results),
        'tickets': results
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def verify_qr_credential(request, token):
    """
    Gate check-in / access control scanner endpoint.
    Verifies cryptographic QR credential token against authoritative database records.
    Supports optional check-in / admission.
    """
    token_str = token.strip()
    ticket = Ticket.objects.select_related('event', 'event__provider', 'owner').filter(qr_token=token_str).first()

    if not ticket:
        return Response({
            'decision': 'DENIED',
            'reason': 'QR credential token not found in platform database. This credential may be invalid or superseded.',
            'ticket': None
        }, status=status.HTTP_404_NOT_FOUND)

    if ticket.status == 'CANCELLED':
        return Response({
            'decision': 'DENIED',
            'reason': 'This ticket credential has been CANCELLED.',
            'ticket': {
                'ticket_ref': ticket.ticket_ref,
                'status': ticket.status,
                'title': ticket.event.title
            }
        })

    if ticket.status == 'USED':
        return Response({
            'decision': 'DENIED',
            'reason': f"This ticket has ALREADY BEEN ADMITTED / USED at {ticket.used_at.isoformat() if ticket.used_at else 'earlier gate'}.",
            'ticket': {
                'ticket_ref': ticket.ticket_ref,
                'status': ticket.status,
                'title': ticket.event.title,
                'used_at': ticket.used_at.isoformat() if ticket.used_at else None
            }
        })

    # Optional admit / check-in action
    action = request.data.get('action') if request.method == 'POST' else request.GET.get('action')
    if action == 'admit':
        ticket.status = 'USED'
        ticket.used_at = timezone.now()
        ticket.save(update_fields=['status', 'used_at'])

    ev = ticket.event
    pr = ev.provider

    return Response({
        'decision': 'GRANTED',
        'ticket': {
            'ticket_ref': ticket.ticket_ref,
            'booking_reference': ticket.booking_reference,
            'status': ticket.status,
            'title': ev.title,
            'category': ev.category,
            'provider_name': pr.name,
            'venue_or_route': ev.venue_or_route,
            'seat_or_coach': ticket.seat_or_coach,
            'event_date': ev.start_time.isoformat(),
            'attendee_name': ticket.attendee_name,
            'owner_username': ticket.owner.username if ticket.owner else 'Direct Inventory',
            'verified_at': timezone.now().isoformat(),
            'is_admitted': (ticket.status == 'USED'),
        }
    })
