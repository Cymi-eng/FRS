
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Notification


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="leader_test",
            email="leader@example.com",
            password="SecurePass123!",
            role=User.Role.DEPARTMENT_LEADER,
        )

        self.other_user = User.objects.create_user(
            username="other_leader",
            email="other@example.com",
            password="SecurePass123!",
            role=User.Role.DEPARTMENT_LEADER,
        )

        self.notification = Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.NotificationType.GENERAL,
            title="Test Notification",
            message="This is a test notification.",
        )

        self.other_notification = Notification.objects.create(
            recipient=self.other_user,
            notification_type=Notification.NotificationType.GENERAL,
            title="Private Notification",
            message="This belongs to another user.",
        )

        self.list_url = reverse("notification-list")
        self.count_url = reverse("notification-unread-count")
        self.mark_all_url = reverse("notification-mark-all-read")
        self.mark_url = reverse(
            "notification-mark-read",
            kwargs={"notification_id": self.notification.id},
        )

        self.client.force_authenticate(user=self.user)

    def test_user_only_sees_own_notifications(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["title"],
            "Test Notification",
        )

    def test_unread_count_returns_correct_count(self):
        response = self.client.get(self.count_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)

    def test_user_can_mark_notification_as_read(self):
        response = self.client.post(self.mark_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notification.refresh_from_db()

        self.assertTrue(self.notification.is_read)
        self.assertIsNotNone(self.notification.read_at)

    def test_user_cannot_mark_another_users_notification_as_read(self):
        url = reverse(
            "notification-mark-read",
            kwargs={
                "notification_id": self.other_notification.id,
            },
        )

        response = self.client.post(url)

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.other_notification.refresh_from_db()
        self.assertFalse(self.other_notification.is_read)

    def test_user_can_mark_all_notifications_as_read(self):
        Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.NotificationType.GENERAL,
            title="Second Notification",
            message="Another test notification.",
        )

        response = self.client.post(self.mark_all_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_read"], 2)

        unread_count = Notification.objects.filter(
            recipient=self.user,
            is_read=False,
        ).count()

        self.assertEqual(unread_count, 0)

    def test_unread_filter_returns_only_unread_notifications(self):
        self.notification.is_read = True
        self.notification.save(update_fields=["is_read"])

        response = self.client.get(
            self.list_url,
            {"unread": "true"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_notifications_require_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
