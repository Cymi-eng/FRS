
from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class AuthenticationAndAccountTests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username="system_admin",
            email="admin@example.com",
            password="Strong-Test-Password-928!",
            role=User.Role.ADMIN,
        )

        self.leader = User.objects.create_user(
            username="worship_leader",
            email="leader@example.com",
            password="Strong-Test-Password-928!",
            role=User.Role.DEPARTMENT_LEADER,
        )

        self.login_url = reverse("token_obtain_pair")
        self.profile_url = reverse("current-user")
        self.password_url = reverse("change-password")
        self.users_url = reverse("user-management-list")

    def test_user_can_login_and_receive_jwt_tokens(self):
        response = self.client.post(
            self.login_url,
            {
                "username": "worship_leader",
                "password": "Strong-Test-Password-928!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_inactive_user_cannot_login(self):
        self.leader.is_active = False
        self.leader.save(update_fields=["is_active"])

        response = self.client.post(
            self.login_url,
            {
                "username": "worship_leader",
                "password": "Strong-Test-Password-928!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_authenticated_user_can_view_own_profile(self):
        self.client.force_authenticate(user=self.leader)

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "worship_leader")
        self.assertEqual(
            response.data["role"],
            User.Role.DEPARTMENT_LEADER,
        )

    def test_unauthenticated_user_cannot_view_profile(self):
        response = self.client.get(self.profile_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_admin_can_create_user(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.users_url,
            {
                "username": "new_secretary",
                "email": "secretary@example.com",
                "first_name": "New",
                "last_name": "Secretary",
                "role": User.Role.SECRETARY,
                "password": "Another-Strong-Password-928!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="new_secretary")

        self.assertTrue(
            user.check_password("Another-Strong-Password-928!")
        )
        self.assertEqual(user.role, User.Role.SECRETARY)

    def test_department_leader_cannot_manage_users(self):
        self.client.force_authenticate(user=self.leader)

        response = self.client.get(self.users_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_user_can_change_password(self):
        self.client.force_authenticate(user=self.leader)

        response = self.client.post(
            self.password_url,
            {
                "old_password": "Strong-Test-Password-928!",
                "new_password": "New-Strong-Password-837!",
                "confirm_new_password": "New-Strong-Password-837!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.leader.refresh_from_db()

        self.assertTrue(
            self.leader.check_password("New-Strong-Password-837!")
        )

    def test_password_change_rejects_wrong_current_password(self):
        self.client.force_authenticate(user=self.leader)

        response = self.client.post(
            self.password_url,
            {
                "old_password": "Wrong-Current-Password!",
                "new_password": "New-Strong-Password-837!",
                "confirm_new_password": "New-Strong-Password-837!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_password_change_rejects_mismatched_passwords(self):
        self.client.force_authenticate(user=self.leader)

        response = self.client.post(
            self.password_url,
            {
                "old_password": "Strong-Test-Password-928!",
                "new_password": "New-Strong-Password-837!",
                "confirm_new_password": "Different-Password-837!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
