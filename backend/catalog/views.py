from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ticketing.models import Provider, Event, Ticket, ResaleListing


@api_view(['GET'])
@permission_classes([AllowAny])
def list_categories(request):
    """Returns all supported ticketing categories."""
    categories = [
        {'id': 1, 'name': 'Flights', 'slug': 'flight', 'icon': 'Plane'},
        {'id': 2, 'name': 'Trains', 'slug': 'train', 'icon': 'Train'},
        {'id': 3, 'name': 'Movies', 'slug': 'movie', 'icon': 'Film'},
        {'id': 4, 'name': 'Concerts', 'slug': 'concert', 'icon': 'Music'},
        {'id': 5, 'name': 'Festivals', 'slug': 'festival', 'icon': 'Sparkles'},
        {'id': 6, 'name': 'Sports', 'slug': 'sports', 'icon': 'Trophy'},
        {'id': 7, 'name': 'Other Events', 'slug': 'other', 'icon': 'Calendar'},
    ]
    return Response(categories)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_providers(request):
    """Returns active providers, optionally filtered by category."""
    category = request.GET.get('category', '').strip()
    qs = Provider.objects.filter(is_active=True)
    if category and category.lower() != 'all':
        qs = qs.filter(category=category.lower())
    
    results = []
    for p in qs:
        results.append({
            'id': p.id,
            'name': p.name,
            'slug': p.slug,
            'category': p.category,
            'category_display': p.get_category_display(),
            'description': p.description,
            'logo_url': p.logo_url,
            'website': p.website,
        })
    return Response({'providers': results})


def _cleanup_expired_reservations():
    """Releases expired reservations back to available or active status."""
    now = timezone.now()
    # Release direct tickets
    Ticket.objects.filter(
        status='RESERVED',
        owner__isnull=True,
        reserved_until__lt=now
    ).update(status='AVAILABLE', reserved_by=None, reserved_until=None)

    # Release resale listings
    expired_resales = ResaleListing.objects.filter(
        status='RESERVED',
        reserved_until__lt=now
    )
    for r in expired_resales:
        r.status = 'ACTIVE'
        r.reserved_by = None
        r.reserved_until = None
        r.save(update_fields=['status', 'reserved_by', 'reserved_until'])
        if r.ticket.status == 'RESERVED':
            r.ticket.status = 'LISTED'
            r.ticket.reserved_by = None
            r.ticket.reserved_until = None
            r.ticket.save(update_fields=['status', 'reserved_by', 'reserved_until'])


def _format_direct_listing(t, is_available=True):
    ev = t.event
    pr = ev.provider
    return {
        'id': f"dir-{t.id}",
        'item_type': 'DIRECT',
        'ticket_id': t.id,
        'resale_listing_id': None,
        'ticket_ref': t.ticket_ref,
        'title': ev.title,
        'category': ev.category,
        'provider_name': pr.name,
        'provider_logo': pr.logo_url,
        'venue_or_route': ev.venue_or_route,
        'start_time': ev.start_time.isoformat(),
        'end_time': ev.end_time.isoformat() if ev.end_time else None,
        'event_date': ev.start_time.isoformat(),
        'seat_or_coach': t.seat_or_coach,
        'itinerary_or_details': ev.itinerary_or_details,
        'image_url': ev.image_url,
        'face_value': str(t.face_value),
        'price': str(t.face_value),
        'asking_price': str(t.face_value),
        'service_fee': '0.00',
        'total_price': str(t.face_value),
        'status': t.status if not is_available else 'ACTIVE',
        'is_available': is_available,
        'seller_username': None,
        'is_direct': True,
        'created_at': t.created_at.isoformat(),
    }


def _format_resale_listing(r):
    t = r.ticket
    ev = t.event
    pr = ev.provider
    return {
        'id': f"res-{r.id}",
        'item_type': 'RESALE',
        'ticket_id': t.id,
        'resale_listing_id': r.id,
        'ticket_ref': t.ticket_ref,
        'title': ev.title,
        'category': ev.category,
        'provider_name': pr.name,
        'provider_logo': pr.logo_url,
        'venue_or_route': ev.venue_or_route,
        'start_time': ev.start_time.isoformat(),
        'end_time': ev.end_time.isoformat() if ev.end_time else None,
        'event_date': ev.start_time.isoformat(),
        'seat_or_coach': t.seat_or_coach,
        'itinerary_or_details': ev.itinerary_or_details,
        'image_url': ev.image_url,
        'face_value': str(t.face_value),
        'price': str(r.asking_price),
        'asking_price': str(r.asking_price),
        'service_fee': str(r.service_fee),
        'total_price': str(r.total_buyer_price),
        'status': r.status,
        'is_available': r.is_currently_available,
        'seller_username': r.seller.username,
        'is_direct': False,
        'created_at': r.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def list_marketplace_listings(request):
    """
    Public inventory and marketplace browsing.
    Supports filtering by category, type (direct/resale/all), provider, search keyword, and price.
    """
    _cleanup_expired_reservations()

    item_type = request.GET.get('type', 'all').lower()  # 'all', 'direct', 'resale'
    category = request.GET.get('category', '').strip().lower()
    q = request.GET.get('q', '').strip()
    provider_slug = request.GET.get('provider', '').strip().lower()
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    sort = request.GET.get('sort', 'date_asc')

    results = []

    # 1. DIRECT BOOKING INVENTORY (Pre-created provider tickets)
    if item_type in ('all', 'direct'):
        direct_tickets = Ticket.objects.filter(
            status='AVAILABLE',
            owner__isnull=True,
            event__is_active=True
        ).select_related('event', 'event__provider')

        if category and category != 'all':
            direct_tickets = direct_tickets.filter(event__category=category)
        if provider_slug:
            direct_tickets = direct_tickets.filter(event__provider__slug=provider_slug)
        if q:
            direct_tickets = direct_tickets.filter(
                Q(event__title__icontains=q) |
                Q(event__venue_or_route__icontains=q) |
                Q(event__provider__name__icontains=q) |
                Q(seat_or_coach__icontains=q)
            )
        if min_price:
            try:
                direct_tickets = direct_tickets.filter(face_value__gte=Decimal(min_price))
            except Exception:
                pass
        if max_price:
            try:
                direct_tickets = direct_tickets.filter(face_value__lte=Decimal(max_price))
            except Exception:
                pass

        for t in direct_tickets:
            results.append(_format_direct_listing(t))

    # 2. PEER-TO-PEER RESALE LISTINGS
    if item_type in ('all', 'resale'):
        resales = ResaleListing.objects.filter(
            status='ACTIVE'
        ).select_related('ticket', 'ticket__event', 'ticket__event__provider', 'seller')

        if category and category != 'all':
            resales = resales.filter(ticket__event__category=category)
        if provider_slug:
            resales = resales.filter(ticket__event__provider__slug=provider_slug)
        if q:
            resales = resales.filter(
                Q(ticket__event__title__icontains=q) |
                Q(ticket__event__venue_or_route__icontains=q) |
                Q(ticket__event__provider__name__icontains=q) |
                Q(ticket__seat_or_coach__icontains=q)
            )
        if min_price:
            try:
                resales = resales.filter(asking_price__gte=Decimal(min_price))
            except Exception:
                pass
        if max_price:
            try:
                resales = resales.filter(asking_price__lte=Decimal(max_price))
            except Exception:
                pass

        for r in resales:
            results.append(_format_resale_listing(r))

    # Sorting
    if sort == 'price_asc':
        results.sort(key=lambda x: Decimal(x['total_price']))
    elif sort == 'price_desc':
        results.sort(key=lambda x: Decimal(x['total_price']), reverse=True)
    elif sort == 'date_desc':
        results.sort(key=lambda x: x['event_date'], reverse=True)
    else:
        results.sort(key=lambda x: x['event_date'])

    return Response({
        'count': len(results),
        'listings': results
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_listing_detail(request, pk):
    """
    Retrieves details for a specific listing (either dir-<id>, res-<id>, or numeric id).
    """
    _cleanup_expired_reservations()

    pk_str = str(pk).strip()
    if pk_str.startswith('res-'):
        try:
            r = ResaleListing.objects.select_related('ticket', 'ticket__event', 'ticket__event__provider', 'seller').get(pk=int(pk_str[4:]))
            return Response({'listing': _format_resale_listing(r)})
        except (ValueError, ResaleListing.DoesNotExist):
            return Response({'error': 'Resale listing not found.'}, status=status.HTTP_404_NOT_FOUND)

    elif pk_str.startswith('dir-'):
        try:
            t = Ticket.objects.select_related('event', 'event__provider').get(pk=int(pk_str[4:]))
            is_avail = (t.status == 'AVAILABLE' and t.owner is None)
            return Response({'listing': _format_direct_listing(t, is_available=is_avail)})
        except (ValueError, Ticket.DoesNotExist):
            return Response({'error': 'Direct booking ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    else:
        try:
            num = int(pk_str)
        except ValueError:
            return Response({'error': 'Invalid listing identifier.'}, status=status.HTTP_400_BAD_REQUEST)

        r = ResaleListing.objects.filter(pk=num).select_related('ticket', 'ticket__event', 'ticket__event__provider', 'seller').first()
        if r:
            return Response({'listing': _format_resale_listing(r)})

        t = Ticket.objects.filter(pk=num).select_related('event', 'event__provider').first()
        if t:
            is_avail = (t.status == 'AVAILABLE' and t.owner is None)
            return Response({'listing': _format_direct_listing(t, is_available=is_avail)})

        return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_resale_listing(request):
    """
    List an owned ticket for peer-to-peer resale.
    Strictly enforces:
    1. Seller must be KYC verified via Setu DigiLocker.
    2. Ticket must be owned by the seller.
    3. Ticket status must be ACTIVE.
    4. Event date must be in the future.
    5. Asking price must follow platform rules (<= 120% of face value).
    """
    if not request.user.is_identity_verified or not request.user.verified_legal_name:
        return Response({
            'error': 'Identity verification required before listing tickets.',
            'code': 'KYC_REQUIRED',
            'detail': 'You must complete verified DigiLocker KYC before you can list tickets for resale.'
        }, status=status.HTTP_403_FORBIDDEN)

    ticket_id = request.data.get('ticket_id')
    asking_price_raw = request.data.get('asking_price')

    if not ticket_id or asking_price_raw is None:
        return Response({'error': 'ticket_id and asking_price are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        asking_price = Decimal(str(asking_price_raw))
        if asking_price <= 0:
            raise ValueError()
    except Exception:
        return Response({'error': 'Please provide a valid positive asking price.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            ticket = Ticket.objects.select_for_update().select_related('event').get(pk=ticket_id, owner=request.user)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket not found or not owned by you.'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.status != 'ACTIVE':
            return Response({
                'error': f"Ticket cannot be listed because its status is '{ticket.status}'. Only active tickets can be resold."
            }, status=status.HTTP_400_BAD_REQUEST)

        if ticket.event.start_time <= timezone.now():
            return Response({
                'error': 'This event has already started or concluded. Expired tickets cannot be listed.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Platform anti-scalping rule: asking price capped at 120% of face value
        max_allowed = (ticket.face_value * Decimal('1.20')).quantize(Decimal('0.01'))
        if asking_price > max_allowed:
            return Response({
                'error': f'Asking price exceeds the platform maximum allowed resale price of ₹{max_allowed} (120% of face value).',
                'max_allowed_price': str(max_allowed)
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if already has an active or reserved resale listing
        existing = ResaleListing.objects.filter(ticket=ticket).first()
        if existing and existing.status in ('ACTIVE', 'RESERVED'):
            return Response({
                'error': f'A resale listing already exists for this ticket in status {existing.status}.',
                'listing_id': existing.id
            }, status=status.HTTP_409_CONFLICT)

        if existing:
            listing = existing
            listing.seller = request.user
            listing.asking_price = asking_price
            listing.service_fee = Decimal('50.00')
            listing.status = 'ACTIVE'
            listing.reserved_by = None
            listing.reserved_until = None
            listing.save()
        else:
            listing = ResaleListing.objects.create(
                ticket=ticket,
                seller=request.user,
                asking_price=asking_price,
                service_fee=Decimal('50.00'),
                status='ACTIVE'
            )

        ticket.status = 'LISTED'
        ticket.save(update_fields=['status'])

    return Response({
        'success': True,
        'message': 'Ticket listed successfully for peer-to-peer resale.',
        'listing': {
            'id': f"res-{listing.id}",
            'listing_id': listing.id,
            'ticket_id': ticket.id,
            'ticket_ref': ticket.ticket_ref,
            'title': ticket.event.title,
            'asking_price': str(listing.asking_price),
            'service_fee': str(listing.service_fee),
            'total_price': str(listing.total_buyer_price),
            'status': listing.status,
            'created_at': listing.created_at.isoformat(),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_seller_listings(request):
    """Returns all resale listings created by the authenticated user."""
    _cleanup_expired_reservations()

    listings = ResaleListing.objects.filter(
        seller=request.user
    ).select_related('ticket', 'ticket__event', 'ticket__event__provider').order_by('-created_at')

    results = []
    for r in listings:
        t = r.ticket
        ev = t.event
        pr = ev.provider
        results.append({
            'id': r.id,
            'listing_id': r.id,
            'ticket_id': t.id,
            'ticket_ref': t.ticket_ref,
            'title': ev.title,
            'category': ev.category,
            'provider_name': pr.name,
            'venue_or_route': ev.venue_or_route,
            'event_date': ev.start_time.isoformat(),
            'seat_or_coach': t.seat_or_coach,
            'face_value': str(t.face_value),
            'asking_price': str(r.asking_price),
            'service_fee': str(r.service_fee),
            'total_price': str(r.total_buyer_price),
            'status': r.status,
            'created_at': r.created_at.isoformat(),
        })

    return Response({'listings': results})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def withdraw_resale_listing(request, pk):
    """Withdraw an active resale listing and return ticket to active vault status."""
    pk_str = str(pk).strip()
    if pk_str.startswith('res-'):
        pk_str = pk_str[4:]

    with transaction.atomic():
        try:
            listing = ResaleListing.objects.select_for_update().select_related('ticket').get(
                pk=pk_str, seller=request.user
            )
        except ResaleListing.DoesNotExist:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)

        if listing.status != 'ACTIVE':
            return Response({
                'error': f"Cannot withdraw listing in status '{listing.status}'."
            }, status=status.HTTP_400_BAD_REQUEST)

        listing.status = 'WITHDRAWN'
        listing.save(update_fields=['status'])

        ticket = listing.ticket
        if ticket.status == 'LISTED':
            ticket.status = 'ACTIVE'
            ticket.save(update_fields=['status'])

    return Response({
        'success': True,
        'message': 'Listing withdrawn successfully. Your ticket is now back in your vault.'
    })
