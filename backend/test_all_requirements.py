import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'd2d_project.settings')
django.setup()

from apps.accounts.models import User, RoleChoices
from apps.customers.models import Customer, RecordSource
from apps.imports.models import ImportBatch, CustomerBatchRecord
from apps.allocations.models import CustomerAssignment
from apps.visits.models import VisitLog
from apps.followups.models import FollowUp
from rest_framework.test import APIClient

print("=== RUNNING ADVANCED TEST SUITE ===")

# Setup Users
admin_user, _ = User.objects.get_or_create(username='admin_super', defaults={'role': RoleChoices.ADMIN, 'is_staff': True, 'is_superuser': True, 'full_name': 'Super Admin'})
admin_user.role = RoleChoices.ADMIN
admin_user.is_superuser = True
admin_user.save()

sup1, _ = User.objects.get_or_create(username='sup_alpha', defaults={'role': RoleChoices.SUPERVISOR, 'full_name': 'Supervisor Alpha'})
sup2, _ = User.objects.get_or_create(username='sup_beta', defaults={'role': RoleChoices.SUPERVISOR, 'full_name': 'Supervisor Beta'})

agent_a, _ = User.objects.get_or_create(username='agent_alpha_1', defaults={'role': RoleChoices.AGENT, 'supervisor': sup1, 'full_name': 'Agent Alpha 1'})
agent_a.supervisor = sup1
agent_a.save()

# ==========================================
# TEST 1: Supervisor deletes wrong upload file
# ==========================================
print("\n--- TEST 1: Supervisor deletes wrong upload file ---")
batch_wrong = ImportBatch.objects.create(
    filename='wrong_area_file.xlsx',
    uploaded_by=sup1,
    total_rows=5,
    valid_rows=5,
    import_status='CONFIRMED',
    allocation_status='UNALLOCATED'
)
created_cust_ids = []
for i in range(1, 6):
    c = Customer.objects.create(
        customer_id=f'WRONG_CUST_{batch_wrong.id}_{i}',
        customer_name=f'Wrong Customer {i}',
        phone_number=f'981111{i:04d}',
        churn_days=45,
        package='200 Mbps',
        created_by=sup1,
        record_source=RecordSource.SUPERVISOR_UPLOAD
    )
    CustomerBatchRecord.objects.create(batch=batch_wrong, customer=c)
    created_cust_ids.append(c.id)

# Try deleting with unrelated supervisor sup2 (should be 403)
sup2_client = APIClient()
sup2_client.force_authenticate(user=sup2)
res_wrong_sup = sup2_client.delete(f'/api/v1/imports/{batch_wrong.id}/')
print(f"Delete batch by unauthorized supervisor status: {res_wrong_sup.status_code}")
assert res_wrong_sup.status_code == 403

# Try deleting with agent (should be 403)
agent_client = APIClient()
agent_client.force_authenticate(user=agent_a)
res_agent = agent_client.delete(f'/api/v1/imports/{batch_wrong.id}/')
print(f"Delete batch by agent status: {res_agent.status_code}")
assert res_agent.status_code == 403

# Delete by uploader supervisor (sup1)
sup1_client = APIClient()
sup1_client.force_authenticate(user=sup1)
res_sup1 = sup1_client.delete(f'/api/v1/imports/{batch_wrong.id}/')
print(f"Delete batch by owner supervisor status: {res_sup1.status_code}, Detail: {res_sup1.data.get('detail')}")
assert res_sup1.status_code == 200

# Verify batch and customer records were completely cleaned up
assert not ImportBatch.objects.filter(id=batch_wrong.id).exists()
remaining_custs = Customer.objects.filter(id__in=created_cust_ids).count()
print(f"Remaining customer records from wrong file: {remaining_custs} (expected 0)")
assert remaining_custs == 0

# Test Admin can delete any batch
batch_admin_test = ImportBatch.objects.create(
    filename='admin_delete_test.xlsx',
    uploaded_by=sup1,
    total_rows=1,
    valid_rows=1,
    import_status='CONFIRMED'
)
admin_client = APIClient()
admin_client.force_authenticate(user=admin_user)
res_admin_del = admin_client.delete(f'/api/v1/imports/{batch_admin_test.id}/')
print(f"Admin delete any batch status: {res_admin_del.status_code}")
assert res_admin_del.status_code == 200

# ==========================================
# TEST 2: Team Management (Deactivate & Delete Agent)
# ==========================================
print("\n--- TEST 2: Team Management (Deactivate & Delete Agent) ---")
# Deactivate agent_a
res_toggle = sup1_client.post(f'/api/v1/users/{agent_a.id}/toggle-active/')
print(f"Toggle active status: {res_toggle.status_code}, is_active: {res_toggle.data.get('is_active')}")
assert res_toggle.status_code == 200
agent_a.refresh_from_db()
assert not agent_a.is_active

# Reactivate agent_a
res_toggle2 = sup1_client.post(f'/api/v1/users/{agent_a.id}/toggle-active/')
print(f"Re-activate status: {res_toggle2.status_code}, is_active: {res_toggle2.data.get('is_active')}")
assert res_toggle2.status_code == 200
agent_a.refresh_from_db()
assert agent_a.is_active

# Delete an agent created under supervisor
temp_agent = User.objects.create_user(username='temp_agent_del', password='password123', role=RoleChoices.AGENT, supervisor=sup1, full_name='Temp Agent')
res_del_agent = sup1_client.delete(f'/api/v1/users/{temp_agent.id}/')
print(f"Delete agent status: {res_del_agent.status_code}, Detail: {res_del_agent.data.get('detail')}")
assert res_del_agent.status_code == 200
assert not User.objects.filter(id=temp_agent.id).exists()

# ==========================================
# TEST 3: Super Admin Role Access
# ==========================================
print("\n--- TEST 3: Super Admin Role Access (both Supervisor and Agent capabilities) ---")
# Admin accessing supervisor views
res_sup_dash = admin_client.get('/api/v1/reports/dashboard/')
print(f"Admin access supervisor dashboard stats: {res_sup_dash.status_code}")
assert res_sup_dash.status_code == 200

res_sup_batches = admin_client.get('/api/v1/imports/')
print(f"Admin access imports list: {res_sup_batches.status_code}")
assert res_sup_batches.status_code == 200

# Admin accessing agent views: manual add customer
res_manual_cust = admin_client.post('/api/v1/customers/manual/', {
    'customer_id': f'ADMIN_TEST_{os.urandom(3).hex()}',
    'customer_name': 'Admin Added Customer',
    'phone_number': '9841999999',
    'churn_days': 15,
    'package': '150 Mbps'
})
print(f"Admin manually adding customer: {res_manual_cust.status_code}")
assert res_manual_cust.status_code == 201
admin_cust_id = res_manual_cust.data['id']

# Admin recording visit on customer
res_visit = admin_client.post('/api/v1/visits/', {
    'customer_id': admin_cust_id,
    'follow_up_remark': 'Connected',
    'notes': 'Recorded by Super Admin'
})
print(f"Admin recording visit findings: {res_visit.status_code}")
assert res_visit.status_code == 201

print("\n=== ALL TEST CASES PASSED WITH 100% SUCCESS! ===")
