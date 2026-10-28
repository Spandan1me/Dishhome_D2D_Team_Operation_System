from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, RoleChoices
from apps.customers.models import Customer, RecordSource, ReviewStatus
from apps.allocations.models import CustomerAssignment, AssignmentStatus
from apps.visits.models import VisitLog, VisitStatus
from apps.followups.models import FollowUp, FollowUpStatus
from apps.imports.models import ImportBatch, ImportStatus, CustomerBatchRecord
from apps.imports.services import parse_and_validate_file
import io
import openpyxl

class D2DBusinessLogicTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_superuser(
            username='admin_test',
            password='Password@123',
            email='admin@test.com',
            role=RoleChoices.ADMIN
        )
        self.supervisor = User.objects.create_user(
            username='sup_test',
            password='Password@123',
            full_name='Test Supervisor',
            role=RoleChoices.SUPERVISOR
        )
        self.agent1 = User.objects.create_user(
            username='agent1_test',
            password='Password@123',
            full_name='Agent One',
            role=RoleChoices.AGENT,
            supervisor=self.supervisor
        )
        self.agent2 = User.objects.create_user(
            username='agent2_test',
            password='Password@123',
            full_name='Agent Two',
            role=RoleChoices.AGENT,
            supervisor=self.supervisor
        )

        # Customer
        self.customer1 = Customer.objects.create(
            customer_id='DH90001',
            customer_name='Prem Bahadur',
            phone_number='9800000001',
            churn_days=45,
            package='200 Mbps',
            record_source=RecordSource.SUPERVISOR_UPLOAD,
            created_by=self.supervisor
        )

    def test_login_and_token(self):
        resp = self.client.post('/api/v1/auth/login/', {
            'username': 'sup_test',
            'password': 'Password@123'
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('token', resp.data)
        self.assertEqual(resp.data['user']['role'], 'SUPERVISOR')

    def test_agent_access_control(self):
        """Agents must not access supervisor-only endpoints like template upload or batch confirm."""
        self.client.force_authenticate(user=self.agent1)
        resp = self.client.get('/api/v1/imports/template/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_single_and_bulk_allocation(self):
        self.client.force_authenticate(user=self.supervisor)

        # Single allocation
        resp = self.client.post('/api/v1/allocations/assign/', {
            'customer_id': self.customer1.id,
            'agent_id': self.agent1.id
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        assign = CustomerAssignment.objects.get(customer=self.customer1, status=AssignmentStatus.ACTIVE)
        self.assertEqual(assign.assigned_agent, self.agent1)

        # Create another customer
        c2 = Customer.objects.create(
            customer_id='DH90002',
            customer_name='Maya Thapa',
            phone_number='9800000002',
            churn_days=30,
            package='100 Mbps',
            created_by=self.supervisor
        )

        # Bulk distribution evenly across agent1 and agent2
        resp = self.client.post('/api/v1/allocations/bulk/', {
            'customer_ids': [self.customer1.id, c2.id],
            'distribute_evenly': True,
            'agent_ids': [self.agent1.id, self.agent2.id]
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Exactly 1 active assignment per customer
        self.assertEqual(self.customer1.assignments.filter(status='ACTIVE').count(), 1)
        self.assertEqual(c2.assignments.filter(status='ACTIVE').count(), 1)

    def test_manual_customer_entry_by_agent(self):
        self.client.force_authenticate(user=self.agent1)
        resp = self.client.post('/api/v1/customers/manual/', {
            'customer_id': 'DH_MANUAL_101',
            'customer_name': 'Field Customer',
            'phone_number': '9811111111',
            'churn_days': 15,
            'package': '150 Mbps',
            'additional_notes': 'Met on door-to-door visit'
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['record_source'], 'AGENT_MANUAL')
        self.assertEqual(resp.data['review_status'], 'PENDING_REVIEW')

        # Prevent duplicate ID
        resp2 = self.client.post('/api/v1/customers/manual/', {
            'customer_id': 'DH_MANUAL_101',
            'customer_name': 'Duplicate ID'
        })
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_visit_findings_and_switching_validation(self):
        self.client.force_authenticate(user=self.agent1)

        # Missing switching_to when remark is 'Switching to another ISP'
        resp = self.client.post('/api/v1/visits/', {
            'customer_id': self.customer1.id,
            'visit_status': 'COMPLETED',
            'follow_up_remark': 'Switching to another ISP',
            'switching_reason': 'High package price of DH',
            'switching_to': ''  # missing
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('switching_to', resp.data)

        # Valid visit with GPS
        resp_valid = self.client.post('/api/v1/visits/', {
            'customer_id': self.customer1.id,
            'visit_status': 'COMPLETED',
            'follow_up_remark': 'Switching to another ISP',
            'switching_reason': 'High package price of DH',
            'switching_to': 'Worldlink',
            'gps_latitude': 27.7172,
            'gps_longitude': 85.3240,
            'gps_accuracy': 10.5
        })
        self.assertEqual(resp_valid.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(resp_valid.data['gps_latitude'])

    def test_dashboard_stats(self):
        self.client.force_authenticate(user=self.supervisor)
        resp = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', resp.data)
        self.assertIn('charts', resp.data)

    def test_admin_can_manage_agents_and_supervisors(self):
        self.client.force_authenticate(user=self.admin)
        supervisor_response = self.client.post('/api/v1/users/', {
            'username': 'new_supervisor',
            'password': 'Password@123',
            'full_name': 'New Supervisor',
            'role': RoleChoices.SUPERVISOR,
        })
        self.assertEqual(supervisor_response.status_code, status.HTTP_201_CREATED)
        managed_supervisor = User.objects.get(username='new_supervisor')
        self.assertEqual(managed_supervisor.role, RoleChoices.SUPERVISOR)

        agent_response = self.client.post('/api/v1/users/', {
            'username': 'new_admin_agent',
            'password': 'Password@123',
            'full_name': 'New Admin Agent',
            'role': RoleChoices.AGENT,
            'supervisor': managed_supervisor.id,
        })
        self.assertEqual(agent_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(agent_response.data['supervisor'], managed_supervisor.id)

        users_response = self.client.get('/api/v1/users/')
        self.assertEqual(users_response.status_code, status.HTTP_200_OK)
        listed_roles = {user['role'] for user in users_response.data['results']}
        self.assertIn(RoleChoices.AGENT, listed_roles)
        self.assertIn(RoleChoices.SUPERVISOR, listed_roles)

        toggle_response = self.client.post(
            f'/api/v1/users/{managed_supervisor.id}/toggle-active/'
        )
        self.assertEqual(toggle_response.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_response.data['is_active'])

    def test_supervisor_can_allocate_to_any_active_agent_in_workspace(self):
        other_supervisor = User.objects.create_user(
            username='other_sup_test',
            password='Password@123',
            full_name='Other Supervisor',
            role=RoleChoices.SUPERVISOR,
        )
        other_agent = User.objects.create_user(
            username='other_agent_test',
            password='Password@123',
            full_name='Other Agent',
            role=RoleChoices.AGENT,
            supervisor=other_supervisor,
        )

        self.client.force_authenticate(user=self.supervisor)
        batch = ImportBatch.objects.create(
            uploaded_by=self.supervisor,
            filename='shared-team.xlsx',
            import_status=ImportStatus.PENDING,
            error_summary={'cached_rows': [{
                'customer_id': 'DH_SHARED_100',
                'customer_name': 'Shared Team Customer',
                'phone_number': '9800000099',
                'churn_days': 20,
                'package': '100 Mbps'
            }]},
        )

        response = self.client.post(
            f'/api/v1/imports/{batch.id}/confirm/',
            {'agent_id': other_agent.id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_supervisor_can_manage_only_their_own_agents(self):
        self.client.force_authenticate(user=self.supervisor)
        create_response = self.client.post('/api/v1/users/', {
            'username': 'supervisor_created_agent',
            'password': 'Password@123',
            'full_name': 'Supervisor Created Agent',
        })
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_agent = User.objects.get(username='supervisor_created_agent')
        self.assertEqual(created_agent.supervisor, self.supervisor)

        create_supervisor_response = self.client.post('/api/v1/users/', {
            'username': 'not_allowed_supervisor',
            'password': 'Password@123',
            'role': RoleChoices.SUPERVISOR,
        })
        self.assertEqual(create_supervisor_response.status_code, status.HTTP_400_BAD_REQUEST)

        other_supervisor = User.objects.create_user(
            username='other_supervisor',
            password='Password@123',
            role=RoleChoices.SUPERVISOR,
        )
        other_agent = User.objects.create_user(
            username='other_agent',
            password='Password@123',
            role=RoleChoices.AGENT,
            supervisor=other_supervisor,
        )
        delete_response = self.client.delete(f'/api/v1/users/{other_agent.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

        toggle_response = self.client.post(f'/api/v1/users/{created_agent.id}/toggle-active/')
        self.assertEqual(toggle_response.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_response.data['is_active'])

    def test_reset_user_password_for_managed_account(self):
        self.client.force_authenticate(user=self.supervisor)
        create_response = self.client.post('/api/v1/users/', {
            'username': 'resettable_agent',
            'password': 'Password@123',
            'full_name': 'Resettable Agent',
        })
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        managed_agent = User.objects.get(username='resettable_agent')
        reset_response = self.client.post(
            f'/api/v1/users/{managed_agent.id}/reset-password/',
            {'new_password': 'NewPassword@456'}
        )
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        managed_agent.refresh_from_db()
        self.assertTrue(managed_agent.check_password('NewPassword@456'))

        other_supervisor = User.objects.create_user(
            username='other_supervisor_reset',
            password='Password@123',
            role=RoleChoices.SUPERVISOR,
        )
        forbidden = self.client.post(
            f'/api/v1/users/{other_supervisor.id}/reset-password/',
            {'new_password': 'AnotherPassword@123'}
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        admin_reset = self.client.post(
            f'/api/v1/users/{self.supervisor.id}/reset-password/',
            {'new_password': 'SupervisorPassword@789'}
        )
        self.assertEqual(admin_reset.status_code, status.HTTP_200_OK)
        self.supervisor.refresh_from_db()
        self.assertTrue(self.supervisor.check_password('SupervisorPassword@789'))

    def test_supervisor_can_see_customer_uploads_and_agents_from_other_supervisors(self):
        other_supervisor = User.objects.create_user(
            username='other_sup',
            password='Password@123',
            role=RoleChoices.SUPERVISOR,
        )
        other_agent = User.objects.create_user(
            username='other_agent_shared',
            password='Password@123',
            full_name='Shared Other Agent',
            role=RoleChoices.AGENT,
            supervisor=other_supervisor,
        )
        uploaded_customer = Customer.objects.create(
            customer_id='DH_SUP_OTHER_001',
            customer_name='Other Supervisor Upload',
            phone_number='9800000099',
            churn_days=12,
            package='250 Mbps',
            record_source=RecordSource.SUPERVISOR_UPLOAD,
            created_by=other_supervisor,
        )

        self.client.force_authenticate(user=self.supervisor)

        user_response = self.client.get('/api/v1/users/')
        self.assertEqual(user_response.status_code, status.HTTP_200_OK)
        user_ids = {user['id'] for user in user_response.data['results']}
        self.assertIn(other_agent.id, user_ids)

        eligible_response = self.client.get('/api/v1/users/eligible-agents/')
        self.assertEqual(eligible_response.status_code, status.HTTP_200_OK)
        eligible_ids = {user['id'] for user in eligible_response.data}
        self.assertIn(other_agent.id, eligible_ids)

        customer_response = self.client.get('/api/v1/customers/')
        self.assertEqual(customer_response.status_code, status.HTTP_200_OK)
        customer_ids = {customer['id'] for customer in customer_response.data['results']}
        self.assertIn(uploaded_customer.id, customer_ids)
