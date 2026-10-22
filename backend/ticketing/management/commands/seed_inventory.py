import os
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from ticketing.models import Provider, Event, Ticket
from catalog.models import TicketCategory


class Command(BaseCommand):
    help = 'Seeds providers, events, travel options, routes, venues, and direct-booking ticket inventory.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting inventory seed...'))

        # 1. Populate Ticket Categories
        categories_data = [
            {'name': 'Flights', 'slug': 'flight', 'icon': 'Plane', 'description': 'Domestic and international flight tickets.'},
            {'name': 'Trains', 'slug': 'train', 'icon': 'Train', 'description': 'Express, superfast, and Vande Bharat train tickets.'},
            {'name': 'Movies', 'slug': 'movie', 'icon': 'Film', 'description': 'Cinema, IMAX, and 3D movie showtimes.'},
            {'name': 'Concerts', 'slug': 'concert', 'icon': 'Music', 'description': 'Live music tours, stadium concerts, and orchestral performances.'},
            {'name': 'Festivals', 'slug': 'festival', 'icon': 'Sparkles', 'description': 'Multi-day music, arts, and cultural festivals.'},
            {'name': 'Sports', 'slug': 'sports', 'icon': 'Trophy', 'description': 'Cricket, football, tennis, and sporting tournaments.'},
            {'name': 'Other Events', 'slug': 'other', 'icon': 'Calendar', 'description': 'Theatrical plays, exhibitions, and fan conventions.'},
        ]

        for cat in categories_data:
            TicketCategory.objects.update_or_create(
                slug=cat['slug'],
                defaults={
                    'name': cat['name'],
                    'icon': cat['icon'],
                    'description': cat['description']
                }
            )

        # 2. Providers
        providers_data = [
            {
                'name': 'IndiGo Airlines',
                'slug': 'indigo',
                'category': 'flight',
                'description': "India's largest low-fare passenger airline providing reliable scheduled domestic and international air travel.",
                'logo_url': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.goindigo.in',
            },
            {
                'name': 'Air India',
                'slug': 'air-india',
                'category': 'flight',
                'description': 'Full-service international and domestic flag carrier featuring widebody Dreamliner flights with premium hospitality.',
                'logo_url': 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.airindia.com',
            },
            {
                'name': 'Indian Railways (IRCTC)',
                'slug': 'irctc',
                'category': 'train',
                'description': 'National railway operator offering Vande Bharat Express, Rajdhani, and Shatabdi express train routes across India.',
                'logo_url': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.irctc.co.in',
            },
            {
                'name': 'PVR INOX Cinemas',
                'slug': 'pvr-inox',
                'category': 'movie',
                'description': 'Leading cinema chain in India featuring premium IMAX Laser, Dolby Atmos, and Director Cut recliner theatres.',
                'logo_url': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.pvrcinemas.com',
            },
            {
                'name': 'Live Nation India',
                'slug': 'live-nation',
                'category': 'concert',
                'description': 'Global entertainment company organizing headline stadium tours, global pop concerts, and live symphony productions.',
                'logo_url': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.livenation.com',
            },
            {
                'name': 'Sunburn Festival',
                'slug': 'sunburn',
                'category': 'festival',
                'description': "Asia's premier electronic dance music festival featuring world-class DJs and experiential seaside staging in Goa.",
                'logo_url': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.sunburn.in',
            },
            {
                'name': 'Nodwin Gaming',
                'slug': 'nodwin-festivals',
                'category': 'festival',
                'description': 'Premier festival and music experiential organizer producing NH7 Weekender and cultural gatherings.',
                'logo_url': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=200&auto=format&fit=crop&q=80',
                'website': 'https://nodwingaming.com',
            },
            {
                'name': 'Board of Control for Cricket in India (BCCI / IPL)',
                'slug': 'bcci-ipl',
                'category': 'sports',
                'description': 'Governing body for Indian cricket and organizer of the Indian Premier League and international bilateral series.',
                'logo_url': 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.iplt20.com',
            },
            {
                'name': 'National Centre for the Performing Arts (NCPA)',
                'slug': 'ncpa',
                'category': 'other',
                'description': "India's premier cultural institution hosting symphony orchestra concerts, Broadway theatre, and classical recitals.",
                'logo_url': 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.ncpamumbai.com',
            },
            {
                'name': 'Comic Con India',
                'slug': 'comic-con-india',
                'category': 'other',
                'description': 'Annual pop culture convention celebrating comic art, gaming, anime, film merchandise, and cosplay in major metros.',
                'logo_url': 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
                'website': 'https://www.comicconindia.com',
            },
        ]

        provider_map = {}
        for p_data in providers_data:
            prov, _ = Provider.objects.update_or_create(
                slug=p_data['slug'],
                defaults=p_data
            )
            provider_map[prov.slug] = prov

        # 3. Events & Schedules
        events_data = [
            # Flights
            {
                'key': 'flight-indigo-bom-del',
                'provider_slug': 'indigo',
                'category': 'flight',
                'title': 'Flight 6E-204: Mumbai (BOM) → New Delhi (DEL)',
                'venue_or_route': 'Mumbai CSMIA (T2) → New Delhi IGI (T3)',
                'start_time': '2026-11-20T08:30:00Z',
                'end_time': '2026-11-20T10:45:00Z',
                'itinerary_or_details': 'Airbus A321neo • Non-stop 2h 15m • Terminal 2 Gate 42 • Economy Standard with 15kg checked baggage',
                'image_url': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('4850.00'),
                'tickets': [
                    {'ref': 'TKT-6E204-4A', 'seat': 'Seat 4A (Window, Extra Legroom)', 'price': Decimal('4850.00')},
                    {'ref': 'TKT-6E204-4B', 'seat': 'Seat 4B (Middle, Forward)', 'price': Decimal('4850.00')},
                    {'ref': 'TKT-6E204-12C', 'seat': 'Seat 12C (Aisle, Standard)', 'price': Decimal('4850.00')},
                    {'ref': 'TKT-6E204-18D', 'seat': 'Seat 18D (Aisle, Standard)', 'price': Decimal('4850.00')},
                    {'ref': 'TKT-6E204-21F', 'seat': 'Seat 21F (Window, Rear)', 'price': Decimal('4850.00')},
                ]
            },
            {
                'key': 'flight-indigo-blr-goa',
                'provider_slug': 'indigo',
                'category': 'flight',
                'title': 'Flight 6E-534: Bengaluru (BLR) → Goa (GOX)',
                'venue_or_route': 'Bengaluru Kempegowda (T1) → Manohar Mopa Airport (GOX)',
                'start_time': '2026-11-25T14:15:00Z',
                'end_time': '2026-11-25T15:30:00Z',
                'itinerary_or_details': 'Airbus A320 • Non-stop 1h 15m • Terminal 1 Gate 18 • Economy Regular',
                'image_url': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('3499.00'),
                'tickets': [
                    {'ref': 'TKT-6E534-3A', 'seat': 'Seat 3A (Window)', 'price': Decimal('3499.00')},
                    {'ref': 'TKT-6E534-8C', 'seat': 'Seat 8C (Aisle)', 'price': Decimal('3499.00')},
                    {'ref': 'TKT-6E534-15E', 'seat': 'Seat 15E (Middle)', 'price': Decimal('3499.00')},
                ]
            },
            {
                'key': 'flight-ai-del-bom',
                'provider_slug': 'air-india',
                'category': 'flight',
                'title': 'Flight AI-806: New Delhi (DEL) → Mumbai (BOM)',
                'venue_or_route': 'New Delhi IGI (T3) → Mumbai CSMIA (T2)',
                'start_time': '2026-12-05T18:00:00Z',
                'end_time': '2026-12-05T20:20:00Z',
                'itinerary_or_details': 'Boeing 787-8 Dreamliner • Non-stop 2h 20m • Terminal 3 Gate 31 • Full Meal Service Included',
                'image_url': 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('5600.00'),
                'tickets': [
                    {'ref': 'TKT-AI806-11A', 'seat': 'Seat 11A (Window, Forward Cabin)', 'price': Decimal('5600.00')},
                    {'ref': 'TKT-AI806-11B', 'seat': 'Seat 11B (Middle)', 'price': Decimal('5600.00')},
                    {'ref': 'TKT-AI806-24J', 'seat': 'Seat 24J (Aisle)', 'price': Decimal('5600.00')},
                ]
            },

            # Trains
            {
                'key': 'train-vande-bharat-ndls-bsb',
                'provider_slug': 'irctc',
                'category': 'train',
                'title': 'Vande Bharat Express (22436): New Delhi → Varanasi',
                'venue_or_route': 'New Delhi Railway Station (NDLS) → Varanasi Junction (BSB)',
                'start_time': '2026-11-22T06:00:00Z',
                'end_time': '2026-11-22T14:00:00Z',
                'itinerary_or_details': 'High-Speed AC Semi-Sleeper • Platform 16 • 8h Duration • Onboard breakfast & lunch included',
                'image_url': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('1750.00'),
                'tickets': [
                    {'ref': 'TKT-VB22436-E1-14', 'seat': 'Coach E1 (Executive Chair) - Seat 14 (Window)', 'price': Decimal('3200.00')},
                    {'ref': 'TKT-VB22436-E1-15', 'seat': 'Coach E1 (Executive Chair) - Seat 15 (Aisle)', 'price': Decimal('3200.00')},
                    {'ref': 'TKT-VB22436-C3-32', 'seat': 'Coach C3 (Chair Car) - Seat 32 (Window)', 'price': Decimal('1750.00')},
                    {'ref': 'TKT-VB22436-C4-45', 'seat': 'Coach C4 (Chair Car) - Seat 45 (Aisle)', 'price': Decimal('1750.00')},
                ]
            },
            {
                'key': 'train-rajdhani-ndls-mmct',
                'provider_slug': 'irctc',
                'category': 'train',
                'title': 'Mumbai Rajdhani Express (12952): New Delhi → Mumbai Central',
                'venue_or_route': 'New Delhi (NDLS) → Mumbai Central (MMCT)',
                'start_time': '2026-11-28T16:55:00Z',
                'end_time': '2026-11-29T08:35:00Z',
                'itinerary_or_details': 'Superfast Overnight AC Express • Platform 3 • Complete bedding & multi-course dinner/breakfast included',
                'image_url': 'https://images.unsplash.com/photo-1532105956626-9569c03602f6?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('3850.00'),
                'tickets': [
                    {'ref': 'TKT-RAJ12952-A1-18', 'seat': 'Coach A1 (2nd AC) - Berth 18 (Lower)', 'price': Decimal('3850.00')},
                    {'ref': 'TKT-RAJ12952-A2-22', 'seat': 'Coach A2 (2nd AC) - Berth 22 (Upper)', 'price': Decimal('3850.00')},
                    {'ref': 'TKT-RAJ12952-H1-02', 'seat': 'Coach H1 (1st AC) - Coupe Berth 02', 'price': Decimal('5400.00')},
                ]
            },

            # Movies
            {
                'key': 'movie-avatar-director-cut',
                'provider_slug': 'pvr-inox',
                'category': 'movie',
                'title': 'Avatar: Fire and Ash — IMAX 3D Premiere',
                'venue_or_route': "PVR Director's Cut, Ambience Mall, Vasant Kunj, New Delhi",
                'start_time': '2026-11-18T20:00:00Z',
                'end_time': '2026-11-18T23:15:00Z',
                'itinerary_or_details': 'Audi 1 • IMAX with Laser 3D & 12-Channel Immersive Sound • Luxury Leather Recliner with Butler Service',
                'image_url': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('950.00'),
                'tickets': [
                    {'ref': 'TKT-AVT-H07', 'seat': 'Recliner Row H - Seat 7 (Prime Center)', 'price': Decimal('950.00')},
                    {'ref': 'TKT-AVT-H08', 'seat': 'Recliner Row H - Seat 8 (Prime Center)', 'price': Decimal('950.00')},
                    {'ref': 'TKT-AVT-J12', 'seat': 'Recliner Row J - Seat 12', 'price': Decimal('950.00')},
                    {'ref': 'TKT-AVT-J13', 'seat': 'Recliner Row J - Seat 13', 'price': Decimal('950.00')},
                ]
            },
            {
                'key': 'movie-interstellar-imax',
                'provider_slug': 'pvr-inox',
                'category': 'movie',
                'title': 'Interstellar: 10th Anniversary IMAX 70mm Special Screening',
                'venue_or_route': 'PVR IMAX, Phoenix Palladium, Lower Parel, Mumbai',
                'start_time': '2026-11-21T19:15:00Z',
                'end_time': '2026-11-21T22:30:00Z',
                'itinerary_or_details': 'Screen 2 • Exclusive 70mm Analog IMAX Film Print Presentation • Uncompressed Sound Master',
                'image_url': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('850.00'),
                'tickets': [
                    {'ref': 'TKT-INT-G14', 'seat': 'Premium Row G - Seat 14 (Director Sweetspot)', 'price': Decimal('850.00')},
                    {'ref': 'TKT-INT-G15', 'seat': 'Premium Row G - Seat 15 (Director Sweetspot)', 'price': Decimal('850.00')},
                    {'ref': 'TKT-INT-F11', 'seat': 'Premium Row F - Seat 11', 'price': Decimal('850.00')},
                ]
            },

            # Concerts
            {
                'key': 'concert-coldplay-dy-patil',
                'provider_slug': 'live-nation',
                'category': 'concert',
                'title': 'Coldplay: Music of the Spheres World Tour',
                'venue_or_route': 'DY Patil Sports Stadium, Nerul, Navi Mumbai',
                'start_time': '2026-11-15T18:30:00Z',
                'end_time': '2026-11-15T22:30:00Z',
                'itinerary_or_details': 'Gate 4 Entry • South Stand Level 2 Bay 18 • Kinetic dance floor and synchronized LED wristband included',
                'image_url': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('6500.00'),
                'tickets': [
                    {'ref': 'TKT-CP-S2-C12', 'seat': 'South Stand Level 2 - Bay 18 Row C Seat 12', 'price': Decimal('6500.00')},
                    {'ref': 'TKT-CP-S2-C13', 'seat': 'South Stand Level 2 - Bay 18 Row C Seat 13', 'price': Decimal('6500.00')},
                    {'ref': 'TKT-CP-VIP-22', 'seat': 'Lounge Deck Bay 4 - Seat 22 (Hospitality Pass)', 'price': Decimal('12500.00')},
                    {'ref': 'TKT-CP-VIP-23', 'seat': 'Lounge Deck Bay 4 - Seat 23 (Hospitality Pass)', 'price': Decimal('12500.00')},
                ]
            },
            {
                'key': 'concert-arijit-singh-jln',
                'provider_slug': 'live-nation',
                'category': 'concert',
                'title': 'Arijit Singh Symphony Live Tour',
                'venue_or_route': 'Jawaharlal Nehru Stadium, Pragati Vihar, New Delhi',
                'start_time': '2026-12-12T19:00:00Z',
                'end_time': '2026-12-12T22:30:00Z',
                'itinerary_or_details': 'Full 50-piece International Symphony Orchestra • Gate 2 Dedicated VIP Lane • Platinum Stage-Front Zone',
                'image_url': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('4200.00'),
                'tickets': [
                    {'ref': 'TKT-AS-PLT-15', 'seat': 'Platinum Circle Row B - Seat 15', 'price': Decimal('4200.00')},
                    {'ref': 'TKT-AS-PLT-16', 'seat': 'Platinum Circle Row B - Seat 16', 'price': Decimal('4200.00')},
                    {'ref': 'TKT-AS-GLD-28', 'seat': 'Gold Section Row E - Seat 28', 'price': Decimal('2800.00')},
                ]
            },

            # Festivals
            {
                'key': 'festival-sunburn-goa',
                'provider_slug': 'sunburn',
                'category': 'festival',
                'title': 'Sunburn Goa 2026: 3-Day Seaside EDM Festival Pass',
                'venue_or_route': 'Vagator Beach Arena Grounds, North Goa',
                'start_time': '2026-12-28T15:00:00Z',
                'end_time': '2026-12-30T23:59:00Z',
                'itinerary_or_details': '3-Day Full Festival Pass • RFID Fast-Track Wristband • Access to all 5 stages across techno, EDM & house',
                'image_url': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('4999.00'),
                'tickets': [
                    {'ref': 'TKT-SB26-GA-9011', 'seat': 'General Admission 3-Day Pass #SB-9011', 'price': Decimal('4999.00')},
                    {'ref': 'TKT-SB26-GA-9012', 'seat': 'General Admission 3-Day Pass #SB-9012', 'price': Decimal('4999.00')},
                    {'ref': 'TKT-SB26-VIP-401', 'seat': 'VIP Deck Elevated Lounge Pass #SB-VIP-401', 'price': Decimal('9500.00')},
                ]
            },
            {
                'key': 'festival-nh7-weekender',
                'provider_slug': 'nodwin-festivals',
                'category': 'festival',
                'title': 'NH7 Weekender 2026: Multi-Genre Music Festival',
                'venue_or_route': 'Mahalakshmi Lawns, Karadi, Pune',
                'start_time': '2026-12-05T14:00:00Z',
                'end_time': '2026-12-07T23:00:00Z',
                'itinerary_or_details': 'Full Weekend Pass • Access to Bacardi Main Stage, The Dewarists & Acoustic Grove • Eco Cup included',
                'image_url': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('3200.00'),
                'tickets': [
                    {'ref': 'TKT-NH7-REG-8821', 'seat': 'Weekend Season Pass #NH7-8821', 'price': Decimal('3200.00')},
                    {'ref': 'TKT-NH7-REG-8822', 'seat': 'Weekend Season Pass #NH7-8822', 'price': Decimal('3200.00')},
                ]
            },

            # Sports
            {
                'key': 'sports-ipl-mi-vs-csk',
                'provider_slug': 'bcci-ipl',
                'category': 'sports',
                'title': 'IPL 2026: Mumbai Indians vs Chennai Super Kings',
                'venue_or_route': 'Wankhede Stadium, ' + 'Churchgate, Mumbai',
                'start_time': '2026-11-12T19:30:00Z',
                'end_time': '2026-11-12T23:30:00Z',
                'itinerary_or_details': 'Gate 3 Access • Garware Pavilion Level 2 • Complimentary beverage voucher & team fan flag',
                'image_url': 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('3500.00'),
                'tickets': [
                    {'ref': 'TKT-IPL-GAR-D14', 'seat': 'Garware Pavilion Level 2 - Row D Seat 14', 'price': Decimal('3500.00')},
                    {'ref': 'TKT-IPL-GAR-D15', 'seat': 'Garware Pavilion Level 2 - Row D Seat 15', 'price': Decimal('3500.00')},
                    {'ref': 'TKT-IPL-SAC-G22', 'seat': 'Sachin Tendulkar Stand Tier 1 - Row G Seat 22', 'price': Decimal('2200.00')},
                ]
            },
            {
                'key': 'sports-wtc-ind-vs-aus',
                'provider_slug': 'bcci-ipl',
                'category': 'sports',
                'title': 'ICC World Test Championship: India vs Australia (Day 3)',
                'venue_or_route': 'Eden Gardens, BBD Bagh, Kolkata',
                'start_time': '2026-11-27T09:30:00Z',
                'end_time': '2026-11-27T17:00:00Z',
                'itinerary_or_details': 'Gate 4 Access • Club House Upper Tier • Prime view behind bowler arm with shaded seating',
                'image_url': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('2200.00'),
                'tickets': [
                    {'ref': 'TKT-WTC-CH-E33', 'seat': 'Club House Block B - Row E Seat 33', 'price': Decimal('2200.00')},
                    {'ref': 'TKT-WTC-CH-E34', 'seat': 'Club House Block B - Row E Seat 34', 'price': Decimal('2200.00')},
                ]
            },

            # Other Events
            {
                'key': 'other-ncpa-beethoven-ninth',
                'provider_slug': 'ncpa',
                'category': 'other',
                'title': "Symphony Orchestra of India: Beethoven's Ninth Symphony",
                'venue_or_route': 'Jamshed Bhabha Theatre, NCPA, Nariman Point, Mumbai',
                'start_time': '2026-11-19T19:00:00Z',
                'end_time': '2026-11-19T21:30:00Z',
                'itinerary_or_details': 'Dress Circle Center • Featuring international choir and acclaimed soloists • Formal evening attire requested',
                'image_url': 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('1800.00'),
                'tickets': [
                    {'ref': 'TKT-SOI-DC-D10', 'seat': 'Dress Circle Center - Row D Seat 10', 'price': Decimal('1800.00')},
                    {'ref': 'TKT-SOI-DC-D11', 'seat': 'Dress Circle Center - Row D Seat 11', 'price': Decimal('1800.00')},
                    {'ref': 'TKT-SOI-STL-F18', 'seat': 'Stalls Tier 1 - Row F Seat 18', 'price': Decimal('1200.00')},
                ]
            },
            {
                'key': 'other-comic-con-blr',
                'provider_slug': 'comic-con-india',
                'category': 'other',
                'title': 'Comic Con Bengaluru 2026: 2-Day Superfan Badge',
                'venue_or_route': 'KTPO Trade Centre, Whitefield, Bengaluru',
                'start_time': '2026-11-28T10:00:00Z',
                'end_time': '2026-11-29T20:00:00Z',
                'itinerary_or_details': 'Weekend Pass • Priority early access to Artist Alley, Cosplay Championship & Exclusive Collectibles',
                'image_url': 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
                'base_price': Decimal('1499.00'),
                'tickets': [
                    {'ref': 'TKT-CCBLR-SUP-11', 'seat': 'Superfan Pass #CC-BLR-2026-11', 'price': Decimal('1499.00')},
                    {'ref': 'TKT-CCBLR-SUP-12', 'seat': 'Superfan Pass #CC-BLR-2026-12', 'price': Decimal('1499.00')},
                ]
            },
        ]

        created_events_count = 0
        created_tickets_count = 0
        skipped_tickets_count = 0

        for ed in events_data:
            prov = provider_map[ed['provider_slug']]
            start_dt = parse_datetime(ed['start_time'])
            end_dt = parse_datetime(ed['end_time']) if ed.get('end_time') else None

            event, ev_created = Event.objects.update_or_create(
                title=ed['title'],
                provider=prov,
                defaults={
                    'category': ed['category'],
                    'venue_or_route': ed['venue_or_route'],
                    'start_time': start_dt,
                    'end_time': end_dt,
                    'itinerary_or_details': ed['itinerary_or_details'],
                    'image_url': ed['image_url'],
                    'base_price': ed['base_price'],
                    'is_active': True,
                }
            )
            if ev_created:
                created_events_count += 1

            for td in ed['tickets']:
                ref = td['ref']
                existing_t = Ticket.objects.filter(ticket_ref=ref).first()
                if existing_t:
                    # NEVER overwrite user-owned tickets or tickets actively in resale or completed
                    if existing_t.owner is not None or existing_t.status in ('ACTIVE', 'LISTED', 'USED'):
                        skipped_tickets_count += 1
                        continue
                    else:
                        existing_t.event = event
                        existing_t.seat_or_coach = td['seat']
                        existing_t.face_value = td['price']
                        existing_t.status = 'AVAILABLE'
                        existing_t.save(update_fields=['event', 'seat_or_coach', 'face_value', 'status'])
                else:
                    t = Ticket.objects.create(
                        event=event,
                        ticket_ref=ref,
                        seat_or_coach=td['seat'],
                        face_value=td['price'],
                        owner=None,
                        status='AVAILABLE'
                    )
                    created_tickets_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded inventory: {len(providers_data)} providers, "
            f"{len(events_data)} events, {created_tickets_count} new tickets created "
            f"({skipped_tickets_count} user/active tickets protected)."
        ))
