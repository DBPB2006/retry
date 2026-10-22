import hmac
import hashlib
import uuid
import razorpay
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order, Payment
from ticketing.models import Ticket, ResaleListing


def get_razorpay_client():
    """Initializes and returns authenticated Razorpay API client."""
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_order(request):
    """
    Initiates checkout for either direct booking inventory or peer-to-peer resale.
    Mandatory Setu DigiLocker KYC identity verification is required before initiating any transaction.
    Locks the inventory for 10 minutes and creates a pending Order + Razorpay order.
    """
    # 1. MANDATORY SETU DIGILOCKER KYC VERIFICATION GATE
    if not request.user.is_identity_verified or not request.user.verified_legal_name:
        return Response({
            'error': 'Identity verification required.',
            'code': 'KYC_REQUIRED',
            'detail': 'You must complete genuine Setu DigiLocker identity verification before booking or purchasing tickets on this platform.'
        }, status=status.HTTP_403_FORBIDDEN)

    raw_id = str(request.data.get('listing_id') or request.data.get('ticket_id') or '').strip()
    attendee_name = request.data.get('attendee_name', '').strip()

    if not raw_id:
        return Response({'error': 'Listing or ticket ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

    is_resale = False
    is_direct = False
    item_id = None

    if raw_id.startswith('res-'):
        is_resale = True
        item_id = int(raw_id[4:])
    elif raw_id.startswith('dir-'):
        is_direct = True
        item_id = int(raw_id[4:])
    else:
        # Determine from numeric id
        try:
            num = int(raw_id)
            if ResaleListing.objects.filter(pk=num).exists():
                is_resale = True
                item_id = num
            elif Ticket.objects.filter(pk=num).exists():
                is_direct = True
                item_id = num
        except ValueError:
            return Response({'error': 'Invalid inventory identifier.'}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    reservation_window = now + timezone.timedelta(minutes=10)
    attendee = attendee_name or request.user.verified_legal_name or request.user.username

    with transaction.atomic():
        if is_resale:
            try:
                resale_listing = ResaleListing.objects.select_for_update().select_related('ticket', 'ticket__event').get(pk=item_id)
            except ResaleListing.DoesNotExist:
                return Response({'error': 'Resale listing not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Prevent seller from purchasing their own ticket
            if resale_listing.seller == request.user:
                return Response({
                    'error': 'Sellers are not permitted to purchase their own ticket listings.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check availability
            is_free = (
                resale_listing.status == 'ACTIVE' or
                (resale_listing.status == 'RESERVED' and resale_listing.reserved_until and resale_listing.reserved_until < now)
            )
            is_current_buyer = (
                resale_listing.status == 'RESERVED' and
                resale_listing.reserved_by == request.user and
                resale_listing.reserved_until and
                resale_listing.reserved_until >= now
            )

            if not is_free and not is_current_buyer:
                return Response({
                    'error': 'This ticket listing is currently reserved by another buyer or has been sold.',
                    'code': 'LISTING_UNAVAILABLE',
                    'status': resale_listing.status
                }, status=status.HTTP_409_CONFLICT)

            # Reserve listing & ticket
            resale_listing.status = 'RESERVED'
            resale_listing.reserved_by = request.user
            resale_listing.reserved_until = reservation_window
            resale_listing.save(update_fields=['status', 'reserved_by', 'reserved_until'])

            ticket = resale_listing.ticket
            ticket.status = 'RESERVED'
            ticket.reserved_by = request.user
            ticket.reserved_until = reservation_window
            ticket.save(update_fields=['status', 'reserved_by', 'reserved_until'])

            ticket_price = resale_listing.asking_price
            service_fee = resale_listing.service_fee
            total_amount = resale_listing.total_buyer_price
            order_type = 'RESALE'

        elif is_direct:
            try:
                ticket = Ticket.objects.select_for_update().select_related('event').get(pk=item_id)
            except Ticket.DoesNotExist:
                return Response({'error': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Direct ticket must have no owner and be available or expired reserved
            if ticket.owner is not None:
                return Response({'error': 'This ticket is already owned by a user.'}, status=status.HTTP_409_CONFLICT)

            is_free = (
                ticket.status == 'AVAILABLE' or
                (ticket.status == 'RESERVED' and ticket.reserved_until and ticket.reserved_until < now)
            )
            is_current_buyer = (
                ticket.status == 'RESERVED' and
                ticket.reserved_by == request.user and
                ticket.reserved_until and
                ticket.reserved_until >= now
            )

            if not is_free and not is_current_buyer:
                return Response({
                    'error': 'This ticket is currently reserved by another buyer or has been booked.',
                    'code': 'TICKET_UNAVAILABLE',
                    'status': ticket.status
                }, status=status.HTTP_409_CONFLICT)

            ticket.status = 'RESERVED'
            ticket.reserved_by = request.user
            ticket.reserved_until = reservation_window
            ticket.save(update_fields=['status', 'reserved_by', 'reserved_until'])

            resale_listing = None
            ticket_price = ticket.face_value
            service_fee = Decimal('0.00')
            total_amount = ticket.face_value
            order_type = 'DIRECT'
        else:
            return Response({'error': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check for existing pending order for this user and ticket
        order = Order.objects.filter(
            buyer=request.user,
            ticket=ticket,
            status='PENDING'
        ).first()

        if not order:
            order = Order.objects.create(
                buyer=request.user,
                order_type=order_type,
                ticket=ticket,
                resale_listing=resale_listing,
                order_number=f"ORD-{uuid.uuid4().hex[:8].upper()}",
                ticket_price=ticket_price,
                service_fee=service_fee,
                total_amount=total_amount,
                status='PENDING',
                attendee_name=attendee,
            )
        else:
            order.attendee_name = attendee
            order.ticket_price = ticket_price
            order.service_fee = service_fee
            order.total_amount = total_amount
            order.order_type = order_type
            order.resale_listing = resale_listing
            order.save()

        # Create or update Razorpay Order
        client = get_razorpay_client()
        amount_in_paise = int(order.total_amount * 100)

        rzp_order = client.order.create({
            'amount': amount_in_paise,
            'currency': 'INR',
            'receipt': order.order_number,
            'notes': {
                'order_id': order.id,
                'order_type': order_type,
                'ticket_ref': ticket.ticket_ref,
                'buyer_username': request.user.username,
            }
        })

        order.razorpay_order_id = rzp_order['id']
        order.save(update_fields=['razorpay_order_id'])

    ev = ticket.event
    return Response({
        'order': {
            'id': order.id,
            'order_number': order.order_number,
            'order_type': order.order_type,
            'ticket_id': ticket.id,
            'ticket_ref': ticket.ticket_ref,
            'title': ev.title,
            'category': ev.category,
            'venue_or_route': ev.venue_or_route,
            'seat_or_coach': ticket.seat_or_coach,
            'event_date': ev.start_time.isoformat(),
            'ticket_price': str(order.ticket_price),
            'service_fee': str(order.service_fee),
            'total_amount': str(order.total_amount),
            'status': order.status,
            'attendee_name': order.attendee_name,
            'reservation_expires_at': reservation_window.isoformat(),
        },
        'razorpay': {
            'order_id': rzp_order['id'],
            'amount': rzp_order['amount'],
            'currency': rzp_order['currency'],
            'key_id': settings.RAZORPAY_KEY_ID,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request, order_id):
    """
    Verifies the cryptographic Razorpay payment signature and completes booking/transfer.
    1. HMAC SHA-256 signature verification.
    2. Server-side fetch from Razorpay API to confirm captured amount.
    3. Row-level locks to prevent double-booking or duplicate transfers.
    4. Issues new ticket or transfers ticket to buyer and generates secure QR credential.
    5. In resale transfers, invalidates the seller's old QR and issues fresh credential to buyer.
    """
    if not request.user.is_identity_verified or not request.user.verified_legal_name:
        return Response({
            'error': 'Identity verification required.',
            'code': 'KYC_REQUIRED',
            'detail': 'You must complete genuine Setu DigiLocker verification before completing ticket transactions.'
        }, status=status.HTTP_403_FORBIDDEN)

    razorpay_order_id = request.data.get('razorpay_order_id', '').strip()
    razorpay_payment_id = request.data.get('razorpay_payment_id', '').strip()
    razorpay_signature = request.data.get('razorpay_signature', '').strip()

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return Response({
            'error': 'Missing required Razorpay payment confirmation fields.',
            'code': 'MISSING_PAYMENT_FIELDS'
        }, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().select_related('ticket', 'ticket__event', 'resale_listing').get(
                pk=order_id, buyer=request.user
            )
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Idempotent response if already completed
        if order.status == 'COMPLETED':
            t = order.ticket
            return Response({
                'success': True,
                'message': 'Order is already completed and ticket issued.',
                'order': {
                    'order_number': order.order_number,
                    'status': order.status,
                    'total_amount': str(order.total_amount),
                    'razorpay_payment_id': razorpay_payment_id,
                    'razorpay_order_id': order.razorpay_order_id,
                },
                'ticket': {
                    'id': t.id,
                    'ticket_ref': t.ticket_ref,
                    'booking_reference': t.booking_reference,
                    'attendee_name': t.attendee_name,
                    'qr_token': t.qr_token,
                    'qr_image_url': t.qr_image.url if t.qr_image else None,
                }
            }, status=status.HTTP_200_OK)

        if order.status != 'PENDING':
            return Response({
                'error': f"Order cannot be verified in current status '{order.status}'.",
                'code': 'INVALID_ORDER_STATUS',
                'order_status': order.status
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify razorpay_order_id matches
        if order.razorpay_order_id and razorpay_order_id != order.razorpay_order_id:
            return Response({
                'error': 'Razorpay order ID mismatch.',
                'code': 'ORDER_ID_MISMATCH'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Cryptographic Signature Verification
        client = get_razorpay_client()
        is_valid = False
        try:
            client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
            is_valid = True
        except Exception:
            body = f"{razorpay_order_id}|{razorpay_payment_id}"
            expected_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            is_valid = hmac.compare_digest(expected_signature, razorpay_signature)

        if not is_valid:
            Payment.objects.update_or_create(
                order=order,
                defaults={
                    'razorpay_order_id': razorpay_order_id,
                    'razorpay_payment_id': razorpay_payment_id,
                    'razorpay_signature': razorpay_signature,
                    'amount': order.total_amount,
                    'currency': 'INR',
                    'status': 'FAILED',
                    'error_code': 'INVALID_SIGNATURE',
                    'error_description': 'Cryptographic payment signature mismatch.'
                }
            )
            order.status = 'PAYMENT_FAILED'
            order.save(update_fields=['status'])
            return Response({
                'success': False,
                'error': 'Invalid payment signature. Verification failed.',
                'code': 'INVALID_SIGNATURE'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Fetch payment details from Razorpay API
        try:
            rzp_payment = client.payment.fetch(razorpay_payment_id)
            expected_paise = int(order.total_amount * 100)
            if rzp_payment.get('order_id') != razorpay_order_id:
                return Response({
                    'error': 'Payment record in Razorpay does not belong to this order.',
                    'code': 'PAYMENT_ORDER_MISMATCH'
                }, status=status.HTTP_400_BAD_REQUEST)

            if int(rzp_payment.get('amount', 0)) != expected_paise:
                return Response({
                    'error': 'Payment amount mismatch.',
                    'code': 'PAYMENT_AMOUNT_MISMATCH'
                }, status=status.HTTP_400_BAD_REQUEST)

            if rzp_payment.get('status') not in ('captured', 'authorized'):
                return Response({
                    'error': f"Payment status is '{rzp_payment.get('status')}', expected captured.",
                    'code': 'PAYMENT_NOT_CAPTURED'
                }, status=status.HTTP_402_PAYMENT_REQUIRED)
        except razorpay.errors.RazorpayError as rzp_err:
            return Response({
                'error': f'Failed to verify payment status with Razorpay: {str(rzp_err)}',
                'code': 'RAZORPAY_FETCH_ERROR'
            }, status=status.HTTP_502_BAD_GATEWAY)

        # Record payment
        Payment.objects.update_or_create(
            order=order,
            defaults={
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature,
                'amount': order.total_amount,
                'currency': 'INR',
                'status': 'PAID',
                'paid_at': timezone.now(),
            }
        )

        ticket = order.ticket

        if order.order_type == 'RESALE' and order.resale_listing:
            # Transfer ownership from seller to buyer
            resale_listing = order.resale_listing
            resale_listing.status = 'SOLD'
            resale_listing.save(update_fields=['status'])

            # Invalidate seller's old QR and issue a brand-new QR credential for buyer
            ticket.invalidate_qr_credential()
            ticket.owner = request.user
            ticket.attendee_name = order.attendee_name
            ticket.status = 'ACTIVE'
            ticket.reserved_by = None
            ticket.reserved_until = None
            ticket.generate_qr_credential(force=True)
            ticket.save()

        else:
            # Direct booking fulfillment
            ticket.owner = request.user
            ticket.attendee_name = order.attendee_name
            if not ticket.booking_reference:
                ticket.booking_reference = f"DIR-{uuid.uuid4().hex[:8].upper()}"
            ticket.status = 'ACTIVE'
            ticket.reserved_by = None
            ticket.reserved_until = None
            ticket.generate_qr_credential(force=True)
            ticket.save()

        order.status = 'COMPLETED'
        order.save(update_fields=['status'])

    return Response({
        'success': True,
        'message': 'Payment verified and ticket successfully issued to your vault!',
        'order': {
            'order_number': order.order_number,
            'order_type': order.order_type,
            'status': order.status,
            'total_amount': str(order.total_amount),
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_order_id': order.razorpay_order_id,
        },
        'ticket': {
            'id': ticket.id,
            'ticket_ref': ticket.ticket_ref,
            'booking_reference': ticket.booking_reference,
            'title': ticket.event.title,
            'venue_or_route': ticket.event.venue_or_route,
            'seat_or_coach': ticket.seat_or_coach,
            'attendee_name': ticket.attendee_name,
            'qr_token': ticket.qr_token,
            'qr_image_url': ticket.qr_image.url if ticket.qr_image else None,
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_order_history(request):
    """Returns order history for the authenticated buyer."""
    orders = Order.objects.filter(
        buyer=request.user
    ).select_related('ticket', 'ticket__event', 'ticket__event__provider').order_by('-created_at')

    results = []
    for o in orders:
        t = o.ticket
        ev = t.event if t else None
        results.append({
            'id': o.id,
            'order_number': o.order_number,
            'order_type': o.order_type,
            'ticket_id': t.id if t else None,
            'ticket_ref': t.ticket_ref if t else 'N/A',
            'title': ev.title if ev else 'Ticket Order',
            'category': ev.category if ev else 'N/A',
            'venue_or_route': ev.venue_or_route if ev else '',
            'seat_or_coach': t.seat_or_coach if t else '',
            'ticket_price': str(o.ticket_price),
            'service_fee': str(o.service_fee),
            'total_amount': str(o.total_amount),
            'status': o.status,
            'attendee_name': o.attendee_name,
            'razorpay_order_id': o.razorpay_order_id,
            'created_at': o.created_at.isoformat(),
        })

    return Response({'orders': results})
