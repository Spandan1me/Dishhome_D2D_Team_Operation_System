from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import RoleChoices, User


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
        self.assertIn(b'Customer ID,Customer Name', response.content)

    def test_export_rejects_unsupported_file_format(self):
        response = self.client.get(
            self.export_url,
            {'report_type': 'visits', 'file_format': 'pdf'},
        )

        self.assertEqual(response.status_code, 400)
