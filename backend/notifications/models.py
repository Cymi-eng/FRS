
from django.conf import settings
from django.db import models


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        REPORT_SUBMITTED = "REPORT_SUBMITTED", "Report Submitted"
        REPORT_APPROVED = "REPORT_APPROVED", "Report Approved"
        CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes Requested"
        REPORT_RESUBMITTED = "REPORT_RESUBMITTED", "Report Resubmitted"
        GENERAL = "GENERAL", "General Notification"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
    )

    title = models.CharField(max_length=200)
    message = models.TextField()

    report = models.ForeignKey(
        "reports.ReportSubmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.recipient}"
