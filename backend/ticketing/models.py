import hashlib
import io
import uuid
import qrcode
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone


class Provider(models.Model):
    CATEGORY_CHOICES = [
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('movie', 'Movie'),
        ('concert', 'Concert'),
        ('festival', 'Festival'),
        ('sports', 'Sports'),
        ('other', 'Other Events'),
    ]

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, db_index=True)
    description = models.TextField(blank=True, default='')
    logo_url = models.URLField(max_length=500, blank=True, default='')
    website = models.URLField(max_length=500, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class Event(models.Model):
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='events')
    category = models.CharField(max_length=30, choices=Provider.CATEGORY_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    venue_or_route = models.CharField(max_length=255)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(null=True, blank=True)
    itinerary_or_details = models.TextField(blank=True, default='')
    image_url = models.URLField(max_length=500, blank=True, default='')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"{self.title} - {self.venue_or_route}"


class Ticket(models.Model):
    STATUS_CHOICES = [
        ('AVAILABLE', 'Available for Direct Booking'),
        ('RESERVED', 'Reserved in Checkout'),
        ('ACTIVE', 'Active & Valid in Vault'),
        ('LISTED', 'Listed for Peer-to-Peer Resale'),
        ('USED', 'Used / Admitted at Gate'),
        ('CANCELLED', 'Cancelled'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    ticket_ref = models.CharField(max_length=64, unique=True, db_index=True)
    seat_or_coach = models.CharField(max_length=100)
    face_value = models.DecimalField(max_digits=10, decimal_places=2)

    # Ownership:
    # owner is None -> pre-created direct inventory from provider
    # owner is set -> user-owned ticket in their vault
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_tickets'
    )
    attendee_name = models.CharField(max_length=255, blank=True, default='')
    booking_reference = models.CharField(max_length=64, blank=True, default='', db_index=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE', db_index=True)

    # Temporary reservation during checkout
    reserved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reserved_tickets'
    )
    reserved_until = models.DateTimeField(null=True, blank=True)

    # Cryptographic QR credential
    qr_token = models.CharField(max_length=128, unique=True, null=True, blank=True)
    qr_token_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    qr_image = models.ImageField(upload_to='qrcodes/', null=True, blank=True)

    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_ref} - {self.event.title} ({self.seat_or_coach})"

    def generate_qr_credential(self, force=False):
        """Generates or rotates cryptographic QR credential token and QR PNG image."""
        if not self.qr_token or force:
            self.qr_token = f"tkn_{uuid.uuid4().hex}"
            self.qr_token_hash = hashlib.sha256(self.qr_token.encode('utf-8')).hexdigest()

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )
            verification_payload = f"/api/ticketing/verify/{self.qr_token}/"
            qr.add_data(verification_payload)
            qr.make(fit=True)

            img = qr.make_image(fill_color="#0a0d14", back_color="#ffffff")
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            file_name = f"qr_{self.ticket_ref}_{uuid.uuid4().hex[:6]}.png"
            self.qr_image.save(file_name, ContentFile(buf.getvalue()), save=False)

    def invalidate_qr_credential(self):
        """Invalidates current QR credential so prior holder cannot use it."""
        self.qr_token = None
        self.qr_token_hash = ''
        if self.qr_image:
            self.qr_image.delete(save=False)
            self.qr_image = None


class ResaleListing(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active in Marketplace'),
        ('RESERVED', 'Reserved in Checkout'),
        ('SOLD', 'Sold & Transferred'),
        ('WITHDRAWN', 'Withdrawn by Seller'),
    ]

    ticket = models.OneToOneField(Ticket, on_delete=models.CASCADE, related_name='resale_listing')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='resale_listings')
    asking_price = models.DecimalField(max_digits=10, decimal_places=2)
    service_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('50.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)

    reserved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reserved_resales'
    )
    reserved_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Resale #{self.id}: {self.ticket.ticket_ref} - ₹{self.asking_price}"

    @property
    def total_buyer_price(self):
        return self.asking_price + self.service_fee

    @property
    def is_currently_available(self):
        if self.status == 'ACTIVE':
            return True
        if self.status == 'RESERVED' and self.reserved_until and timezone.now() > self.reserved_until:
            return True
        return False
