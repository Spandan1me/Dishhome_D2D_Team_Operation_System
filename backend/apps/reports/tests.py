from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import RoleChoices, User
from apps.customers.models import Customer
from apps.allocations.models import CustomerAssignment
from apps.reports.services import normalize_export_value
from apps.visits.models import VisitLog, VisitStatus


class ReportExportTests(APITestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user(
            username='report-supervisor',
            password='test-password',
            role=RoleChoices.SUPERVISOR,
        )
        self.client.force_authenticate(user=self.supervisor)
        self.export_url = reverse('report_export')

    def test_excel_export_downloads_using_file_format_parameter(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'excel'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertTrue(response.content.startswith(b'PK'))

    def test_csv_export_downloads_using_file_format_parameter(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'csv'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn(b'Customer ID,Customer Name,Contact,Package,Churn Days', response.content)

    def test_churn_csv_export_includes_contact_package_and_churn_days(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'churn', 'file_format': 'csv'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn(b'Customer ID,Customer Name,Phone Number,Churn Days,Package', response.content)

    def test_visit_csv_export_includes_collection_type_column(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'csv'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Collection Type', response.content)

    def test_supervisor_csv_export_includes_all_agent_visit_rows(self):
        agent = User.objects.create_user(
            username='export-agent',
            password='test-password',
            role=RoleChoices.AGENT,
            supervisor=self.supervisor,
        )
        customer = Customer.objects.create(
            customer_id='DH-EXPORT-001',
            customer_name='Export Customer',
            phone_number='9800000001',
            churn_days=15,
            package='100 Mbps',
        )
        VisitLog.objects.create(
            customer=customer,
            agent=agent,
            visit_status=VisitStatus.COMPLETED,
            follow_up_remark='Ready to recharge within 3 days',
            notes='Export test visit',
        )

        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'csv'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'DH-EXPORT-001', response.content)
        self.assertIn(b'Export Customer', response.content)

    def test_export_rejects_unsupported_file_format(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'pdf'},
        )

        self.assertEqual(response.status_code, 400)

    def test_normalize_export_value_keeps_blank_cells_empty(self):
        self.assertEqual(normalize_export_value(None), '')
        self.assertEqual(normalize_export_value(''), '')
        self.assertEqual(normalize_export_value('Customer A'), 'Customer A')
