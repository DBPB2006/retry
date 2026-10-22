from django.urls import path
from .views import (
    get_csrf_token,
    register_view,
    login_view,
    logout_view,
    me_view,
    initiate_setu_kyc,
    check_setu_kyc_status,
)

urlpatterns = [
    path('csrf/', get_csrf_token, name='auth-csrf'),
    path('register/', register_view, name='auth-register'),
    path('login/', login_view, name='auth-login'),
    path('logout/', logout_view, name='auth-logout'),
    path('me/', me_view, name='auth-me'),
    path('setu/initiate/', initiate_setu_kyc, name='setu-initiate'),
    path('setu/status/', check_setu_kyc_status, name='setu-status'),
]
