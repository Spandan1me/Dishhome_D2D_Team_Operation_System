import os
import django
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'd2d_project.settings')
django.setup()

from apps.accounts.models import User, RoleChoices
from apps.customers.models import Customer, RecordSource, ReviewStatus
from apps.imports.models import ImportBatch, ImportStatus, AllocationStatus, CustomerBatchRecord
from apps.allocations.models import CustomerAssignment, AssignmentStatus
from apps.visits.models import VisitLog, VisitStatus
from apps.followups.models import FollowUp, FollowUpStatus
from apps.audit.models import AuditLog, AuditAction

def run_seed():
    print("Seeding DishHome D2D Field Operations system data...")

    # 1. System Admin
    admin_user, _ = User.objects.get_or_create(
        username='admin',
        defaults={
            'full_name': 'System Administrator',
            'email': 'admin@dishhome.com.np',
            'role': RoleChoices.ADMIN,
            'is_staff': True,
            'is_superuser': True
        }
    )
    admin_user.set_password('Admin@123')
    admin_user.save()
    print("[OK] Admin user created: admin / Admin@123")

    # 2. Supervisor
    sup, _ = User.objects.get_or_create(
        username='supervisor1',
        defaults={
            'full_name': 'Prakash Acharya (D2D Supervisor)',
            'email': 'prakash.supervisor@dishhome.com.np',
            'role': RoleChoices.SUPERVISOR,
            'phone_number': '9801998877'
        }
    )
    sup.set_password('Super@123')
    sup.save()
    print("[OK] Supervisor created: supervisor1 / Super@123")

    # 3. Agents
    agents_info = [
        ('agent1', 'Bikash Shrestha', '9801112233'),
        ('agent2', 'Sunita Maharjan', '9802223344'),
        ('agent3', 'Kiran KC', '9803334455'),
    ]
    agents = []
    for uname, fname, phone in agents_info:
        ag, _ = User.objects.get_or_create(
            username=uname,
            defaults={
                'full_name': fname,
                'email': f'{uname}@dishhome.com.np',
                'role': RoleChoices.AGENT,
                'phone_number': phone,
                'supervisor': sup
            }
        )
        ag.set_password('Agent@123')
        ag.supervisor = sup
        ag.save()
        agents.append(ag)
        print(f"[OK] Agent created: {uname} / Agent@123 ({fname})")

    # 4. Import Batch
    batch, _ = ImportBatch.objects.get_or_create(
        filename='DishHome_Churn_Kathmandu_Oct2026.xlsx',
        uploaded_by=sup,
        defaults={
            'total_rows': 12,
            'valid_rows': 12,
            'invalid_rows': 0,
            'duplicate_rows': 0,
            'import_status': ImportStatus.CONFIRMED,
            'allocation_status': AllocationStatus.PARTIALLY_ALLOCATED
        }
    )

    # 5. Customers
    sample_customers = [
        ("DH10021", "Ram Sharma", "9801234567", 95, "200 Mbps"),
        ("DH10022", "Sita Thapa", "9812345678", 120, "100 Mbps"),
        ("DH10023", "Hari Gurung", "9841234567", 180, "300 Mbps"),
        ("DH10024", "Anita Shrestha", "9851029384", 45, "150 Mbps"),
        ("DH10025", "Bishal Tamang", "9803928172", 60, "200 Mbps"),
        ("DH10026", "Gita Adhikari", "9813847291", 30, "75 Mbps"),
        ("DH10027", "Deepak Rai", "9843920192", 110, "200 Mbps"),
        ("DH10028", "Kalpana Karki", "9860192837", 140, "300 Mbps"),
        ("DH10029", "Suresh Bhandari", "9808123456", 75, "150 Mbps"),
        ("DH10030", "Manisha Magar", "9818234567", 90, "200 Mbps"),
        ("DH10031", "Prabhat Joshi", "9848345678", 25, "100 Mbps"),
        ("DH10032", "Sabina Poudel", "9868456789", 15, "200 Mbps"),
    ]

    customers = []
    for cid, name, phone, churn, pkg in sample_customers:
        c, _ = Customer.objects.get_or_create(
            customer_id=cid,
            defaults={
                'customer_name': name,
                'phone_number': phone,
                'churn_days': churn,
                'package': pkg,
                'record_source': RecordSource.SUPERVISOR_UPLOAD,
                'review_status': ReviewStatus.APPROVED,
                'created_by': sup
            }
        )
        CustomerBatchRecord.objects.get_or_create(customer=c, batch=batch)
        customers.append(c)

    print(f"[OK] Created {len(customers)} customers from batch #{batch.id}")

    # 6. Allocations (Assign first 8 customers across agents, leave 4 unassigned)
    CustomerAssignment.objects.all().delete()
    for i in range(8):
        c = customers[i]
        ag = agents[i % len(agents)]
        CustomerAssignment.objects.create(
            customer=c,
            assigned_agent=ag,
            assigned_by=sup,
            status=AssignmentStatus.ACTIVE
        )
    print("[OK] Allocated 8 customers across D2D agents (4 remain unassigned for demo)")

    # 7. Visit logs with realistic GPS points in Kathmandu
    VisitLog.objects.all().delete()
    now = timezone.now()

    # Bikash visited Ram Sharma (DH10021) -> Ready to recharge
    v1 = VisitLog.objects.create(
        customer=customers[0],
        agent=agents[0],
        visit_status=VisitStatus.COMPLETED,
        follow_up_remark="Ready to recharge within 3 days",
        notes="Customer was polite, wants internet reconnected by Friday.",
        gps_latitude=27.7172453,
        gps_longitude=85.3239605,
        gps_accuracy=12.5,
        gps_captured_at=now - timedelta(days=2),
        completed_at=now - timedelta(days=2)
    )

    # Sunita visited Sita Thapa (DH10022) -> Switching to another ISP
    v2 = VisitLog.objects.create(
        customer=customers[1],
        agent=agents[1],
        visit_status=VisitStatus.COMPLETED,
        follow_up_remark="Switching to another ISP",
        switching_reason="High package price of DH",
        switching_to="Worldlink",
        notes="Claimed competitor offered free router and lower tariff.",
        gps_latitude=27.6710221,
        gps_longitude=85.3129482,
        gps_accuracy=18.0,
        gps_captured_at=now - timedelta(days=1),
        completed_at=now - timedelta(days=1)
    )

    # Kiran visited Hari Gurung (DH10023) -> Call not received / Customer Not Found
    v3 = VisitLog.objects.create(
        customer=customers[2],
        agent=agents[2],
        visit_status=VisitStatus.CUSTOMER_NOT_FOUND,
        follow_up_remark="Call not received",
        notes="Door locked, neighbor said family travels frequently.",
        gps_latitude=27.7025812,
        gps_longitude=85.3182901,
        gps_accuracy=15.2,
        gps_captured_at=now - timedelta(hours=5),
        completed_at=now - timedelta(hours=5)
    )
    print("[OK] Created 3 realistic visit logs with GPS metadata")

    # 8. Follow-ups
    FollowUp.objects.all().delete()
    today = timezone.localdate()
    # Due in 2 days
    FollowUp.objects.create(
        customer=customers[0],
        related_visit=v1,
        assigned_agent=agents[0],
        follow_up_date=today + timedelta(days=2),
        status=FollowUpStatus.PENDING,
        notes="Check if recharge payment was deposited"
    )
    # Due today
    FollowUp.objects.create(
        customer=customers[3],
        assigned_agent=agents[0],
        follow_up_date=today,
        status=FollowUpStatus.PENDING,
        notes="Callback customer Anita Shrestha regarding package discount"
    )
    # Overdue
    FollowUp.objects.create(
        customer=customers[4],
        assigned_agent=agents[1],
        follow_up_date=today - timedelta(days=2),
        status=FollowUpStatus.OVERDUE,
        notes="Router replacement follow-up"
    )
    print("[OK] Created follow-ups (today, upcoming, overdue)")

    # 9. Manual customer added by agent pending supervisor review
    c_manual, _ = Customer.objects.get_or_create(
        customer_id="DH99901",
        defaults={
            'customer_name': 'Subash Khadka',
            'phone_number': '9841999888',
            'churn_days': 40,
            'package': '150 Mbps',
            'record_source': RecordSource.AGENT_MANUAL,
            'review_status': ReviewStatus.PENDING_REVIEW,
            'review_notes': 'Found during field visit in Thamel area, needs reconnect offer.',
            'created_by': agents[0]
        }
    )
    CustomerAssignment.objects.get_or_create(
        customer=c_manual,
        assigned_agent=agents[0],
        defaults={
            'assigned_by': agents[0],
            'status': AssignmentStatus.ACTIVE,
            'reassignment_reason': 'Self-assigned manual field entry'
        }
    )
    print("[OK] Created agent-added manual customer: DH99901 (Pending Review)")

    # Update batch status
    batch.update_allocation_status()
    print("[OK] All seed data generated successfully!")

if __name__ == '__main__':
    run_seed()
