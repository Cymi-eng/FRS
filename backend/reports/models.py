
import calendar
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q


def activity_attachment_path(instance, filename):
    extension = filename.rsplit(".", 1)[-1].lower()
    return (
        f"reports/activities/{instance.activity_id}/"
        f"{uuid.uuid4().hex}.{extension}"
    )


class Activity(models.Model):
    """
    An individual department activity recorded whenever it happens.
    Activities are automatically grouped into weekly and monthly reports.
    """

    class ActivityType(models.TextChoices):
        WORSHIP = "WORSHIP", "Worship"
        EVANGELISM = "EVANGELISM", "Evangelism"
        OUTREACH = "OUTREACH", "Outreach"
        FELLOWSHIP = "FELLOWSHIP", "Fellowship"
        SERVICE = "SERVICE", "Church Service"
        MEETING = "MEETING", "Meeting"
        TRAINING = "TRAINING", "Training"
        OTHER = "OTHER", "Other"

    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.PROTECT,
        related_name="activities",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_activities",
    )

    activity_type = models.CharField(
        max_length=20,
        choices=ActivityType.choices,
        default=ActivityType.OTHER,
    )

    title = models.CharField(max_length=200)

    activity_date = models.DateField(db_index=True)

    location = models.CharField(max_length=200, blank=True)

    description = models.TextField()

    attendance_count = models.PositiveIntegerField(
        default=0,
    )

    outcomes = models.TextField(blank=True)

    challenges = models.TextField(blank=True)

    # Optional financial information.
    includes_financial_information = models.BooleanField(
        default=False,
    )

    expenditure_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    financial_notes = models.TextField(blank=True)

    is_archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-activity_date", "-created_at"]
        indexes = [
            models.Index(
                fields=["department", "activity_date"],
                name="activity_dept_date_idx",
            ),
            models.Index(
                fields=["created_by", "activity_date"],
                name="activity_creator_date_idx",
            ),
        ]

    def clean(self):
        if not self.includes_financial_information:
            self.expenditure_amount = 0
            self.financial_notes = ""

    def __str__(self):
        return f"{self.title} - {self.activity_date}"


class ActivityAttachment(models.Model):
    """
    Photos and supporting documents attached to individual activities.
    """

    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="attachments",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="activity_attachments",
    )

    file = models.FileField(
        upload_to=activity_attachment_path,
    )

    caption = models.CharField(max_length=255, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Attachment for {self.activity.title}"


class ReportSubmission(models.Model):
    """
    A weekly or monthly report compiled from a department's activities.

    Department leaders review and submit these reports manually.
    The system does not automatically submit them.
    """

    class PeriodType(models.TextChoices):
        WEEKLY = "WEEKLY", "Weekly"
        MONTHLY = "MONTHLY", "Monthly"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        CHANGES_REQUESTED = (
            "CHANGES_REQUESTED",
            "Changes Requested",
        )
        APPROVED = "APPROVED", "Approved"

    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.PROTECT,
        related_name="report_submissions",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_report_submissions",
    )

    period_type = models.CharField(
        max_length=10,
        choices=PeriodType.choices,
        db_index=True,
    )

    start_date = models.DateField()

    end_date = models.DateField()

    title = models.CharField(max_length=200, blank=True)

    # Activities included in this submitted report.
    activities = models.ManyToManyField(
        Activity,
        related_name="report_submissions",
        blank=True,
    )

    executive_summary = models.TextField(blank=True)

    achievements = models.TextField(blank=True)

    challenges = models.TextField(blank=True)

    recommendations = models.TextField(blank=True)

    plans_for_next_period = models.TextField(blank=True)

    includes_financial_report = models.BooleanField(
        default=False,
    )

    financial_summary = models.TextField(blank=True)

    total_expenditure = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_report_submissions",
    )

    review_comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "department__name"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "department",
                    "period_type",
                    "start_date",
                    "end_date",
                ],
                name="unique_department_report_period",
            ),
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="report_end_date_after_start",
            ),
        ]

        indexes = [
            models.Index(
                fields=["department", "period_type", "start_date"],
                name="report_dept_period_idx",
            ),
            models.Index(
                fields=["status", "submitted_at"],
                name="report_status_submit_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if self.end_date < self.start_date:
            raise ValidationError({
                "end_date": "End date cannot be before start date."
            })

        if self.period_type == self.PeriodType.WEEKLY:
            if (self.end_date - self.start_date).days != 6:
                raise ValidationError({
                    "end_date": "A weekly report must cover exactly seven days."
                })

            if self.start_date.weekday() != 0:
                raise ValidationError({
                    "start_date": "Weekly reports must start on Monday."
                })

        elif self.period_type == self.PeriodType.MONTHLY:
            last_day = calendar.monthrange(
                self.start_date.year,
                self.start_date.month,
            )[1]

            expected_end = self.start_date.replace(day=last_day)

            if self.start_date.day != 1 or self.end_date != expected_end:
                raise ValidationError(
                    "Monthly reports must cover the complete calendar month."
                )

    def __str__(self):
        return (
            f"{self.department.name} - "
            f"{self.get_period_type_display()} - "
            f"{self.start_date} to {self.end_date}"
        )
