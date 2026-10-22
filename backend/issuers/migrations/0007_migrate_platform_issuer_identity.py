from django.db import migrations


def migrate_issuer_and_ticket_references(apps, schema_editor):
    Issuer = apps.get_model('issuers', 'Issuer')
    IssuerTransferPolicy = apps.get_model('issuers', 'IssuerTransferPolicy')
    IssuerTicket = apps.get_model('issuers', 'IssuerTicket')
    IssuerTransferHistory = apps.get_model('issuers', 'IssuerTransferHistory')
    ReplacementTicket = apps.get_model('ticketing', 'ReplacementTicket')
    TicketListing = apps.get_model('catalog', 'TicketListing')
    TicketVerificationLog = apps.get_model('catalog', 'TicketVerificationLog')

    # 1. Establish unified platform issuer identity: SafeTicket
    platform_issuer, _ = Issuer.objects.update_or_create(
        code='SafeTicket',
        defaults={
            'name': 'SafeTicket',
            'issuer_type': 'PLATFORM',
            
            'is_active': True,
        }
    )

    # 2. Re-point transfer policies to SafeTicket platform issuer (deduplicating categories)
    existing_categories = set()
    for policy in IssuerTransferPolicy.objects.all():
        if policy.category_name in existing_categories:
            policy.delete()
        else:
            policy.issuer = platform_issuer
            policy.save(update_fields=['issuer'])
            existing_categories.add(policy.category_name)

    # 3. Migrate IssuerTicket records
    for ticket in IssuerTicket.objects.all():
        updated_fields = ['issuer']
        ticket.issuer = platform_issuer

        # Migrate internal simulated ticket references to clean customer-facing references
        if ticket.ticket_ref == 'SIM_TRANSPORT-2B2A2C54':
            ticket.ticket_ref = 'TKT-2B2A2C54'
            ticket.legacy_reference = 'SIM_TRANSPORT-2B2A2C54'
            updated_fields.extend(['ticket_ref', 'legacy_reference'])
        elif ticket.ticket_ref == 'SIM_EVENT-F9065C63':
            ticket.ticket_ref = 'TKT-F9065C63'
            ticket.legacy_reference = 'SIM_EVENT-F9065C63'
            updated_fields.extend(['ticket_ref', 'legacy_reference'])

        # Update superseded references
        if ticket.superseded_by_ref == 'SIM_TRANSPORT-2B2A2C54':
            ticket.superseded_by_ref = 'TKT-2B2A2C54'
            updated_fields.append('superseded_by_ref')
        elif ticket.superseded_by_ref == 'SIM_EVENT-F9065C63':
            ticket.superseded_by_ref = 'TKT-F9065C63'
            updated_fields.append('superseded_by_ref')
        elif ticket.superseded_by_ref == 'SIM_EVENT-REPLACED-88':
            ticket.superseded_by_ref = 'TKT-REPLACED-88'
            updated_fields.append('superseded_by_ref')

        # Clean PNR values
        if ticket.pnr.startswith('LEGACY-'):
            cleaned_pnr = 'PNR-' + ticket.pnr[7:]
            if 'SIM_EVENT-F9065C63' in ticket.pnr:
                cleaned_pnr = 'PNR-COLDPLAY-801'
            ticket.pnr = cleaned_pnr
            updated_fields.append('pnr')

        ticket.save(update_fields=list(set(updated_fields)))

    # 4. Migrate ReplacementTicket vault records
    for rep in ReplacementTicket.objects.all():
        rep.issuer_code = 'SafeTicket'
        if rep.new_ticket_ref == 'SIM_TRANSPORT-2B2A2C54':
            rep.new_ticket_ref = 'TKT-2B2A2C54'
        elif rep.new_ticket_ref == 'SIM_EVENT-F9065C63':
            rep.new_ticket_ref = 'TKT-F9065C63'
        rep.save(update_fields=['issuer_code', 'new_ticket_ref'])

    # 5. Migrate IssuerTransferHistory audit records
    for history in IssuerTransferHistory.objects.all():
        updated = ['new_ticket_ref']
        if history.new_ticket_ref == 'SIM_TRANSPORT-2B2A2C54':
            history.new_ticket_ref = 'TKT-2B2A2C54'
        elif history.new_ticket_ref == 'SIM_EVENT-F9065C63':
            history.new_ticket_ref = 'TKT-F9065C63'

        if history.pnr.startswith('LEGACY-'):
            history.pnr = 'PNR-' + history.pnr[7:]
            updated.append('pnr')
        elif not history.pnr:
            history.pnr = 'PNR-COLDPLAY-801'
            updated.append('pnr')

        history.save(update_fields=updated)

    # 6. Migrate TicketListing records
    for listing in TicketListing.objects.all():
        updated = ['issuer_code']
        listing.issuer_code = 'SafeTicket'
        if listing.pnr.startswith('LEGACY-'):
            listing.pnr = 'PNR-' + listing.pnr[7:]
            updated.append('pnr')
        listing.save(update_fields=updated)

    # 7. Migrate TicketVerificationLog records
    for log in TicketVerificationLog.objects.all():
        if log.pnr.startswith('LEGACY-'):
            log.pnr = 'PNR-' + log.pnr[7:]
            log.save(update_fields=['pnr'])

    # 8. Clean up obsolete simulated issuer records
    Issuer.objects.filter(code__in=['SIM_EVENT', 'SIM_TRANSPORT']).delete()


def reverse_migration(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('issuers', '0006_issuerticket_legacy_reference_and_more'),
        ('orders', '0001_initial'),
        ('ticketing', '0001_initial'),
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(migrate_issuer_and_ticket_references, reverse_migration),
    ]
