from io import BytesIO
from tempfile import TemporaryDirectory

from django.test import TestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import RoleChoices, User
from apps.customers.models import Customer
from .models import VisitEvidenceUpload, VisitLog


class VisitEvidenceTests(TestCase):
    def setUp(self):
        self.media_dir = TemporaryDirectory()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(self.media_dir.cleanup)

        self.agent = User.objects.create_user(
            username='evidence_agent',
            password='Password@123',
            role=RoleChoices.AGENT,
        )
        self.other_agent = User.objects.create_user(
            username='other_evidence_agent',
            password='Password@123',
            role=RoleChoices.AGENT,
        )
        self.customer = Customer.objects.create(customer_id='EVIDENCE-001')
        self.client = APIClient()
        self.client.force_authenticate(user=self.agent)

    def make_photo(self):
        image_buffer = BytesIO()
        Image.new('RGB', (2, 2), color='red').save(image_buffer, format='JPEG')
        return SimpleUploadedFile(
            'visit.jpg',
            image_buffer.getvalue(),
            content_type='image/jpeg',
        )

    def test_agent_can_submit_and_view_photo_and_video_evidence(self):
        response = self.client.post(
            '/api/v1/visits/',
            {
                'customer_id': str(self.customer.id),
                'visit_status': 'COMPLETED',
                'follow_up_remark': 'Connected',
                'gps_latitude': 27.7172,
                'gps_longitude': 85.3241,
                'photo': self.make_photo(),
                'video': SimpleUploadedFile(
                    'visit.mp4',
                    b'video evidence test',
                    content_type='video/mp4',
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['has_photo'])
        self.assertTrue(response.data['has_video'])

        visit = VisitLog.objects.get(id=response.data['id'])
        photo_response = self.client.get(
            f'/api/v1/visits/{visit.id}/evidence/photo/'
        )
        video_response = self.client.get(
            f'/api/v1/visits/{visit.id}/evidence/video/'
        )
        self.assertEqual(photo_response.status_code, status.HTTP_200_OK)
        self.assertEqual(video_response.status_code, status.HTTP_200_OK)
        self.assertEqual(photo_response['Content-Type'], 'image/jpeg')
        self.assertEqual(video_response['Content-Type'], 'video/mp4')
        photo_response.close()
        video_response.close()

    def test_other_agent_cannot_view_visit_evidence(self):
        response = self.client.post(
            '/api/v1/visits/',
            {
                'customer_id': str(self.customer.id),
                'visit_status': 'COMPLETED',
                'follow_up_remark': 'Connected',
                'gps_latitude': 27.7172,
                'gps_longitude': 85.3241,
                'photo': self.make_photo(),
            },
            format='multipart',
        )
        visit_id = response.data['id']

        self.client.force_authenticate(user=self.other_agent)
        evidence_response = self.client.get(
            f'/api/v1/visits/{visit_id}/evidence/photo/'
        )
        self.assertEqual(evidence_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_captured_evidence_upload_attaches_to_visit(self):
        upload_response = self.client.post(
            '/api/v1/visits/evidence-uploads/',
            {
                'customer_id': str(self.customer.id),
                'photo': self.make_photo(),
            },
            format='multipart',
        )
        self.assertEqual(upload_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(upload_response.data['evidence_type'], 'photo')

        visit_response = self.client.post(
            '/api/v1/visits/',
            {
                'customer_id': str(self.customer.id),
                'visit_status': 'COMPLETED',
                'follow_up_remark': 'Connected',
                'gps_latitude': 27.7172,
                'gps_longitude': 85.3241,
                'photo_evidence_id': upload_response.data['id'],
            },
            format='multipart',
        )
        self.assertEqual(visit_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(visit_response.data['has_photo'])
        self.assertFalse(
            VisitEvidenceUpload.objects.filter(id=upload_response.data['id']).exists()
        )

        evidence_response = self.client.get(
            f"/api/v1/visits/{visit_response.data['id']}/evidence/photo/"
        )
        self.assertEqual(evidence_response.status_code, status.HTTP_200_OK)
        evidence_response.close()

    def test_completed_visit_requires_gps_coordinates(self):
        response = self.client.post(
            '/api/v1/visits/',
            {
                'customer_id': str(self.customer.id),
                'visit_status': 'COMPLETED',
                'follow_up_remark': 'Connected',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('GPS', str(response.data))
