
from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import Department


User = get_user_model()


class DepartmentAPITests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_test",
            password="TestPassword123!",
            role="ADMIN",
        )

        self.secretary = User.objects.create_user(
            username="secretary_test",
            password="TestPassword123!",
            role="SECRETARY",
        )

        self.leader_one = User.objects.create_user(
            username="leader_one",
            password="TestPassword123!",
            role="DEPARTMENT_LEADER",
        )

        self.leader_two = User.objects.create_user(
            username="leader_two",
            password="TestPassword123!",
            role="DEPARTMENT_LEADER",
        )

        self.department_one = Department.objects.create(
            name="Worship Department",
            code="WOR",
            leader=self.leader_one,
        )

        self.department_two = Department.objects.create(
            name="Evangelism Department",
            code="EVA",
            leader=self.leader_two,
        )

        self.list_url = reverse("department-list")

    def test_admin_can_list_all_departments(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_can_create_department(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.list_url,
            {
                "name": "Choir Department",
                "code": "CHO",
                "description": "Church choir activities",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Department.objects.filter(code="CHO").exists()
        )

    def test_secretary_can_view_all_departments(self):
        self.client.force_authenticate(user=self.secretary)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_secretary_cannot_create_department(self):
        self.client.force_authenticate(user=self.secretary)

        response = self.client.post(
            self.list_url,
            {
                "name": "New Department",
                "code": "NEW",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_leader_only_sees_assigned_department(self):
        self.client.force_authenticate(user=self.leader_one)

        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["code"],
            "WOR",
        )

    def test_leader_cannot_create_department(self):
        self.client.force_authenticate(user=self.leader_one)

        response = self.client.post(
            self.list_url,
            {
                "name": "Unauthorized Department",
                "code": "BAD",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_leader_cannot_access_another_department(self):
        self.client.force_authenticate(user=self.leader_one)

        url = reverse(
            "department-detail",
            kwargs={"pk": self.department_two.pk},
        )

        response = self.client.get(url)

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_unauthenticated_user_cannot_list_departments(self):
        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
