from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import RoleChoices, User
from apps.allocations.models import AssignmentStatus, CustomerAssignment
from apps.customers.models import Customer
from .models import CustomerBatchRecord, ImportBatch, ImportStatus


class ImportBatchDeletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.supervisor = User.objects.create_user(
            username='batch_supervisor',
            password='Password@123',
            role=RoleChoices.SUPERVISOR,
        )
        self.other_supervisor = User.objects.create_user(
            username='other_batch_supervisor',
            password='Password@123',
            role=RoleChoices.SUPERVISOR,
        )
        self.agent = User.objects.create_user(
            username='batch_agent',
            password='Password@123',
            role=RoleChoices.AGENT,
            supervisor=self.supervisor,
        )
        self.batch = ImportBatch.objects.create(
            uploaded_by=self.supervisor,
            filename='wrong-upload.xlsx',
            import_status=ImportStatus.CONFIRMED,
        )

    def test_supervisor_deletes_batch_and_only_orphaned_new_customers(self):
        disposable_customer = Customer.objects.create(customer_id='BATCH_ONLY')
        CustomerBatchRecord.objects.create(
            customer=disposable_customer,
            batch=self.batch,
            created_from_batch=True,
        )

        preserved_customer = Customer.objects.create(customer_id='BATCH_SHARED')
        CustomerBatchRecord.objects.create(
            customer=preserved_customer,
            batch=self.batch,
            created_from_batch=True,
        )
        other_batch = ImportBatch.objects.create(
            uploaded_by=self.supervisor,
            filename='later-upload.xlsx',
            import_status=ImportStatus.CONFIRMED,
        )
        CustomerBatchRecord.objects.create(
            customer=preserved_customer,
            batch=other_batch,
        )

        assigned_customer = Customer.objects.create(customer_id='BATCH_ASSIGNED')
        CustomerBatchRecord.objects.create(
            customer=assigned_customer,
            batch=self.batch,
            created_from_batch=True,
        )
        CustomerAssignment.objects.create(
            customer=assigned_customer,
            assigned_agent=self.agent,
            assigned_by=self.supervisor,
            status=AssignmentStatus.ACTIVE,
        )

        self.client.force_authenticate(user=self.supervisor)
        response = self.client.delete(f'/api/v1/imports/{self.batch.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(ImportBatch.objects.filter(id=self.batch.id).exists())
        self.assertFalse(Customer.objects.filter(id=disposable_customer.id).exists())
        self.assertTrue(Customer.objects.filter(id=preserved_customer.id).exists())
        self.assertTrue(Customer.objects.filter(id=assigned_customer.id).exists())
        self.assertEqual(response.data['deleted_customers'], 1)
        self.assertEqual(response.data['preserved_customers'], 2)

    def test_supervisor_cannot_delete_another_supervisors_batch(self):
        self.client.force_authenticate(user=self.other_supervisor)
        response = self.client.delete(f'/api/v1/imports/{self.batch.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(ImportBatch.objects.filter(id=self.batch.id).exists())
