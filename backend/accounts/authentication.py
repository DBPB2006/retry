from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication subclass that skips CSRF enforcement for development REST APIs,
    while still properly verifying user sessions via session cookies.
    """
    def enforce_csrf(self, request):
        return  # Skip CSRF check for JSON API endpoints
