import requests
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import User, SetuKYCRecord
from .setu_client import SetuClient


@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    token = get_token(request)
    return Response({'csrfToken': token})


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    phone = request.data.get('phone', '').strip()

    if not username or not email or not password:
        return Response(
            {'error': 'Username, email, and password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email is already registered.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        phone=phone
    )

    login(request, user)
    return Response({
        'message': 'Account registered successfully.',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_identity_verified': user.is_identity_verified,
            'verified_legal_name': user.verified_legal_name
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is None:
        try:
            user_obj = User.objects.get(email__iexact=username)
            user = authenticate(request, username=user_obj.username, password=password)
        except User.DoesNotExist:
            user = None

    if user is None:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)
    return Response({
        'message': 'Logged in successfully.',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_identity_verified': user.is_identity_verified,
            'verified_legal_name': user.verified_legal_name
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'message': 'Logged out successfully.'})


def sync_user_kyc_status(user):
    if user.is_identity_verified and user.verified_legal_name:
        return {
            'status': 'VERIFIED',
            'verified_legal_name': user.verified_legal_name,
            'message': 'Identity is already verified.'
        }

    latest_kyc = user.kyc_records.order_by('-created_at').first()
    if not latest_kyc:
        return {'status': 'NOT_STARTED', 'detail': 'No verification attempt found.'}

    if latest_kyc.status == 'VERIFIED' and latest_kyc.verified_legal_name:
        if not user.is_identity_verified or user.verified_legal_name != latest_kyc.verified_legal_name:
            user.is_identity_verified = True
            user.verified_legal_name = latest_kyc.verified_legal_name
            user.save(update_fields=['is_identity_verified', 'verified_legal_name'])
        return {
            'status': 'VERIFIED',
            'verified_legal_name': user.verified_legal_name,
            'verified_at': latest_kyc.verified_at.isoformat() if latest_kyc.verified_at else None
        }

    if not SetuClient.is_configured():
        return {
            'status': 'UNCONFIGURED',
            'detail': 'Setu credentials not configured in environment.'
        }

    status_resp = SetuClient.get_request_status(latest_kyc.setu_request_id)
    if not status_resp.get('success'):
        return {
            'status': latest_kyc.status,
            'error': status_resp.get('error')
        }

    remote_status = status_resp.get('status')
    if remote_status == 'AUTHENTICATED':
        doc_resp = SetuClient.fetch_aadhaar_data(latest_kyc.setu_request_id)
        if doc_resp.get('success'):
            legal_name = doc_resp.get('verified_legal_name')
            if legal_name:
                latest_kyc.status = 'VERIFIED'
                latest_kyc.verified_legal_name = legal_name
                latest_kyc.verified_at = timezone.now()
                latest_kyc.save(update_fields=['status', 'verified_legal_name', 'verified_at'])

                user.is_identity_verified = True
                user.verified_legal_name = legal_name
                user.save(update_fields=['is_identity_verified', 'verified_legal_name'])

                return {
                    'status': 'VERIFIED',
                    'verified_legal_name': legal_name,
                    'message': 'Setu DigiLocker identity verification successfully completed.'
                }

        latest_kyc.status = 'FAILED'
        latest_kyc.error_message = doc_resp.get('error', 'Could not retrieve legal name from Setu response.')
        latest_kyc.save(update_fields=['status', 'error_message'])
        return {
            'status': 'FAILED',
            'error': latest_kyc.error_message
        }

    if remote_status == 'EXPIRED':
        if latest_kyc.status != 'EXPIRED':
            latest_kyc.status = 'EXPIRED'
            latest_kyc.save(update_fields=['status'])
        return {'status': 'EXPIRED', 'detail': 'DigiLocker consent session expired.'}

    return {
        'status': 'INITIATED',
        'detail': 'Waiting for user to complete DigiLocker authentication.'
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    if not request.user.is_authenticated:
        return Response({'authenticated': False, 'user': None})

    user = request.user

    latest_kyc = user.kyc_records.order_by('-created_at').first()
    if not user.is_identity_verified and latest_kyc and latest_kyc.status in ('INITIATED', 'VERIFIED'):
        try:
            sync_user_kyc_status(user)
            user.refresh_from_db()
            latest_kyc.refresh_from_db()
        except requests.RequestException:
            pass

    kyc_info = None
    if latest_kyc:
        kyc_info = {
            'status': latest_kyc.status,
            'request_id': latest_kyc.setu_request_id,
            'verified_legal_name': latest_kyc.verified_legal_name,
            'created_at': latest_kyc.created_at.isoformat(),
            'verified_at': latest_kyc.verified_at.isoformat() if latest_kyc.verified_at else None,
            'error_message': latest_kyc.error_message
        }

    return Response({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'phone': user.phone,
            'is_identity_verified': user.is_identity_verified,
            'verified_legal_name': user.verified_legal_name,
            'kyc': kyc_info
        },
        'setu_status': {
            'is_configured': SetuClient.is_configured(),
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_setu_kyc(request):
    user = request.user
    if user.is_identity_verified:
        return Response({
            'message': 'Identity is already verified.',
            'status': 'VERIFIED',
            'verified_legal_name': user.verified_legal_name
        })

    if not SetuClient.is_configured():
        return Response({
            'error': 'Setu DigiLocker sandbox credentials are not configured in backend environment.',
            'status': 'UNCONFIGURED',
            'instruction': 'Add SETU_CLIENT_ID, SETU_CLIENT_SECRET, and SETU_PRODUCT_INSTANCE_ID to backend/.env'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    redirect_url = request.data.get('redirect_url')
    result = SetuClient.create_digilocker_request(redirect_url=redirect_url)

    if not result.get('success'):
        return Response({
            'error': result.get('error'),
            'status': result.get('status')
        }, status=status.HTTP_502_BAD_GATEWAY)

    record = SetuKYCRecord.objects.create(
        user=user,
        setu_request_id=result['request_id'],
        status='INITIATED',
        digilocker_url=result.get('url', ''),
    )

    return Response({
        'status': 'INITIATED',
        'setu_request_id': record.setu_request_id,
        'digilocker_url': record.digilocker_url,
        'valid_upto': result.get('valid_upto'),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_setu_kyc_status(request):
    user = request.user
    result = sync_user_kyc_status(user)
    if result.get('status') == 'FAILED':
        return Response(result, status=status.HTTP_502_BAD_GATEWAY)
    return Response(result)
