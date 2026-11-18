import calendar
import os
import zipfile
from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from departments.models import Department

from notifications.services import (
    notify_secretaries,
    notify_report_changes_requested,
    notify_report_approved,
)

from .models import Activity, ActivityAttachment, ReportSubmission

from .serializers import (
    ActivitySerializer,
    ActivityAttachmentSerializer,
    ReportSubmissionSerializer,
)


MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".docx",
}


# --------------------------------------------------------------------------
# Role helpers
# --------------------------------------------------------------------------

def is_admin(user):
    return user.is_authenticated and (
        user.is_superuser or user.role == "ADMIN"
    )


def is_secretary(user):
    return user.is_authenticated and user.role == "SECRETARY"


def is_department_leader(user):
    return user.is_authenticated and user.role == "DEPARTMENT_LEADER"


def user_department(user):
    return user.led_departments.filter(is_active=True).first()


# --------------------------------------------------------------------------
# Input helpers
# --------------------------------------------------------------------------

def parse_date_or_error(value, field):
    """parse_date returns None for badly formatted input but raises
    ValueError for well-formatted impossible dates (e.g. 2025-13-45)."""

    try:
        parsed = parse_date(value)
    except ValueError:
        parsed = None

    if not parsed:
        raise ValidationError({
            field: "Enter a valid date in YYYY-MM-DD format."
        })

    return parsed


def parse_int_or_error(value, field):
    """Assumes integer primary keys. Remove/adjust if you use UUIDs."""

    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({
            field: "Invalid value."
        })


def get_comment(request):
    """Safely read a text comment (handles missing, null or non-string)."""

    value = request.data.get("comment")

    if value is None:
        return ""

    return str(value).strip()


def get_reporting_period(period_type, selected_date):
    """Calculate daily, weekly or monthly reporting dates."""

    if period_type == "DAILY":
        return selected_date, selected_date

    if period_type == "WEEKLY":
        start_date = selected_date - timedelta(
            days=selected_date.weekday()
        )
        end_date = start_date + timedelta(days=6)
        return start_date, end_date

    if period_type == "MONTHLY":
        start_date = selected_date.replace(day=1)

        last_day = calendar.monthrange(
            selected_date.year,
            selected_date.month,
        )[1]

        end_date = selected_date.replace(day=last_day)

        return start_date, end_date

    raise ValidationError({
        "period_type": "Choose DAILY, WEEKLY or MONTHLY."
    })


def validate_uploaded_file(uploaded_file):
    """Validate attachment size, extension and basic file structure."""

    if uploaded_file.size > MAX_ATTACHMENT_SIZE:
        raise ValidationError({
            "file": "Maximum file size is 10 MB."
        })

    extension = os.path.splitext(uploaded_file.name)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError({
            "file": (
                "Only JPG, JPEG, PNG, WEBP, PDF and DOCX files are allowed."
            )
        })

    uploaded_file.seek(0)
    content = uploaded_file.read()
    uploaded_file.seek(0)

    if extension in {".jpg", ".jpeg", ".png", ".webp"}:
        expected_formats = {
            ".jpg": {"JPEG"},
            ".jpeg": {"JPEG"},
            ".png": {"PNG"},
            ".webp": {"WEBP"},
        }

        try:
            image = Image.open(BytesIO(content))
            image.verify()
            image_format = image.format

        except (
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            ValueError,
            Image.DecompressionBombError,
        ):
            raise ValidationError({
                "file": "The uploaded image is invalid or corrupted."
            })

        if image_format not in expected_formats[extension]:
            raise ValidationError({
                "file": (
                    "The image content does not match its file extension."
                )
            })

    elif extension == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValidationError({
                "file": "The uploaded PDF file is invalid."
            })

    elif extension == ".docx":
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                names = archive.namelist()
        except zipfile.BadZipFile:
            raise ValidationError({
                "file": "The uploaded DOCX document is invalid."
            })

        if "word/document.xml" not in names:
            raise ValidationError({
                "file": "The uploaded DOCX document is invalid."
            })

    uploaded_file.seek(0)


def build_report_snapshot(report, activities):
    """
    Create a JSON-safe historical copy of report content.

    This snapshot is independent of future edits to Activity records.
    """

    activity_snapshots = []

    for activity in activities:
        attachment_snapshots = []

        for attachment in activity.attachments.all():
            attachment_snapshots.append({
                "id": attachment.id,
                "file_name": os.path.basename(attachment.file.name),
                "file_path": attachment.file.name,
                "caption": attachment.caption,
                "uploaded_by": attachment.uploaded_by.get_full_name()
                or attachment.uploaded_by.username,
                "uploaded_at": attachment.uploaded_at.isoformat(),
            })

        expenditure = activity.expenditure_amount or Decimal("0.00")

        activity_snapshots.append({
            "id": activity.id,
            "activity_type": activity.activity_type,
            "activity_type_display": activity.get_activity_type_display(),
            "title": activity.title,
            "activity_date": activity.activity_date.isoformat(),
            "location": activity.location,
            "description": activity.description,
            "attendance_count": activity.attendance_count or 0,
            "outcomes": activity.outcomes,
            "challenges": activity.challenges,
            "includes_financial_information": (
                activity.includes_financial_information
            ),
            "expenditure_amount": str(expenditure),
            "financial_notes": activity.financial_notes,
            "created_by": (
                activity.created_by.get_full_name()
                or activity.created_by.username
            ),
            "created_at": activity.created_at.isoformat(),
            "updated_at": activity.updated_at.isoformat(),
            "attachments": attachment_snapshots,
        })

    total_attendance = sum(
        (activity.attendance_count or 0) for activity in activities
    )

    total_expenditure = sum(
        (
            (activity.expenditure_amount or Decimal("0.00"))
            for activity in activities
            if activity.includes_financial_information
        ),
        Decimal("0.00"),
    )

    return {
        "snapshot_version": 1,
        "generated_at": timezone.now().isoformat(),
        "department": {
            "id": report.department_id,
            "name": report.department.name,
            "code": report.department.code,
        },
        "report": {
            "id": report.id,
            "title": report.title,
            "period_type": report.period_type,
            "period_type_display": report.get_period_type_display(),
            "start_date": report.start_date.isoformat(),
            "end_date": report.end_date.isoformat(),
            "executive_summary": report.executive_summary,
            "achievements": report.achievements,
            "challenges": report.challenges,
            "recommendations": report.recommendations,
            "plans_for_next_period": report.plans_for_next_period,
            "general_remarks": report.general_remarks,
            "includes_financial_report": report.includes_financial_report,
            "financial_summary": report.financial_summary,
            "total_expenditure": str(report.total_expenditure),
        },
        "prepared_by": (
            report.created_by.get_full_name()
            or report.created_by.username
        ),
        "activity_count": len(activity_snapshots),
        "total_attendance": total_attendance,
        "calculated_activity_expenditure": str(total_expenditure),
        "activities": activity_snapshots,
    }


# --------------------------------------------------------------------------
# Activities
# --------------------------------------------------------------------------

class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = Activity.objects.select_related(
            "department",
            "created_by",
        ).prefetch_related("attachments")

        if is_admin(user) or is_secretary(user):
            pass

        elif is_department_leader(user):
            department = user_department(user)

            if not department:
                return queryset.none()

            queryset = queryset.filter(department=department)

        else:
            return queryset.none()

        department_id = self.request.query_params.get("department")
        activity_type = self.request.query_params.get("activity_type")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if department_id and (is_admin(user) or is_secretary(user)):
            queryset = queryset.filter(
                department_id=parse_int_or_error(
                    department_id,
                    "department",
                )
            )

        if activity_type:
            queryset = queryset.filter(
                activity_type=activity_type
            )

        if start_date:
            queryset = queryset.filter(
                activity_date__gte=parse_date_or_error(
                    start_date,
                    "start_date",
                )
            )

        if end_date:
            queryset = queryset.filter(
                activity_date__lte=parse_date_or_error(
                    end_date,
                    "end_date",
                )
            )

        return queryset

    def create(self, request, *args, **kwargs):
        if not (
            is_admin(request.user)
            or is_department_leader(request.user)
        ):
            raise PermissionDenied(
                "Only administrators and department leaders can record activities."
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user

        if is_department_leader(user):
            department = user_department(user)

            if not department:
                raise ValidationError(
                    "Your account has no active department assignment."
                )

        elif is_admin(user):
            department_id = self.request.data.get("department")

            if not department_id:
                raise ValidationError({
                    "department": "Select a department."
                })

            department = get_object_or_404(
                Department,
                pk=parse_int_or_error(department_id, "department"),
                is_active=True,
            )

        else:
            raise PermissionDenied(
                "You cannot record activities."
            )

        serializer.save(
            department=department,
            created_by=user,
        )

    def update(self, request, *args, **kwargs):
        activity = self.get_object()

        if is_department_leader(request.user):
            if activity.created_by_id != request.user.id:
                raise PermissionDenied(
                    "You can only edit activities you recorded."
                )

        elif not is_admin(request.user):
            raise PermissionDenied(
                "You cannot edit this activity."
            )

        if activity.is_archived:
            raise PermissionDenied(
                "Archived activities cannot be edited."
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied(
            "Activities cannot be permanently deleted. Contact an administrator."
        )


# --------------------------------------------------------------------------
# Attachments
# --------------------------------------------------------------------------

class ActivityAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityAttachmentSerializer
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    http_method_names = [
        "get",
        "post",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = ActivityAttachment.objects.select_related(
            "activity",
            "activity__department",
            "uploaded_by",
        )

        if is_admin(user) or is_secretary(user):
            return queryset

        if is_department_leader(user):
            department = user_department(user)

            if department:
                return queryset.filter(
                    activity__department=department
                )

        return queryset.none()

    def create(self, request, *args, **kwargs):
        if not (
            is_admin(request.user)
            or is_department_leader(request.user)
        ):
            raise PermissionDenied(
                "Only administrators and department leaders can upload attachments."
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        activity_id = parse_int_or_error(
            self.request.data.get("activity"),
            "activity",
        )

        activity = get_object_or_404(
            Activity.objects.select_related("department"),
            pk=activity_id,
        )

        if is_department_leader(user):
            department = user_department(user)

            if (
                not department
                or activity.department_id != department.id
            ):
                raise PermissionDenied(
                    "You cannot upload files to another department's activity."
                )

        elif not is_admin(user):
            raise PermissionDenied(
                "You cannot upload activity attachments."
            )

        if activity.is_archived:
            raise ValidationError(
                "Attachments cannot be added to archived activities."
            )

        uploaded_file = self.request.FILES.get("file")

        if not uploaded_file:
            raise ValidationError({
                "file": "Select a file to upload."
            })

        validate_uploaded_file(uploaded_file)

        serializer.save(
            activity=activity,
            uploaded_by=user,
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()

        if is_department_leader(request.user):
            if attachment.uploaded_by_id != request.user.id:
                raise PermissionDenied(
                    "You can only delete attachments you uploaded."
                )

        elif not is_admin(request.user):
            raise PermissionDenied(
                "You cannot delete attachments."
            )

        # Preserve evidence referenced by a previously submitted report.
        protected_statuses = [
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
            ReportSubmission.Status.CHANGES_REQUESTED,
            ReportSubmission.Status.APPROVED,
        ]

        has_submitted_report = attachment.activity.report_submissions.filter(
            status__in=protected_statuses
        ).exists()

        if has_submitted_report:
            raise PermissionDenied(
                "This attachment is part of a submitted report and cannot be deleted."
            )

        # Delete the DB row first; remove the file only once the
        # transaction has actually committed.
        storage = attachment.file.storage
        file_name = attachment.file.name

        attachment.delete()

        if file_name:
            transaction.on_commit(
                lambda: storage.delete(file_name)
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------

class ReportSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = ReportSubmissionSerializer
    permission_classes = [IsAuthenticated]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = ReportSubmission.objects.select_related(
            "department",
            "created_by",
            "reviewer",
        ).prefetch_related(
            "activities",
            "activities__attachments",
        )

        if getattr(self, "action", None) in {
            "submit",
            "start_review",
            "request_changes",
            "approve",
        }:
            # Lock only the report row. Without of=("self",), PostgreSQL
            # fails because "reviewer" is a nullable (outer-joined) relation.
            queryset = queryset.select_for_update(of=("self",))

        if is_admin(user) or is_secretary(user):
            return queryset

        if is_department_leader(user):
            department = user_department(user)

            if department:
                return queryset.filter(
                    department=department
                )

        return queryset.none()

    def create(self, request, *args, **kwargs):
        if not is_department_leader(request.user):
            raise PermissionDenied(
                "Only department leaders can create report submissions."
            )

        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        department = user_department(self.request.user)

        if not department:
            raise ValidationError(
                "Your account has no active department assignment."
            )

        serializer.save(
            department=department,
            created_by=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        report = self.get_object()

        if not is_department_leader(request.user):
            raise PermissionDenied(
                "Only the department leader can edit this report."
            )

        if report.created_by_id != request.user.id:
            raise PermissionDenied(
                "You can only edit reports you created."
            )

        if report.status not in {
            ReportSubmission.Status.DRAFT,
            ReportSubmission.Status.CHANGES_REQUESTED,
        }:
            raise PermissionDenied(
                "Only draft or correction-requested reports can be edited."
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied(
            "Reports cannot be permanently deleted."
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        report = self.get_object()

        if not is_department_leader(request.user):
            raise PermissionDenied(
                "Only department leaders can submit reports."
            )

        if report.created_by_id != request.user.id:
            raise PermissionDenied(
                "You can only submit reports you created."
            )

        previous_status = report.status

        if previous_status not in {
            ReportSubmission.Status.DRAFT,
            ReportSubmission.Status.CHANGES_REQUESTED,
        }:
            raise ValidationError(
                "This report cannot be submitted in its current state."
            )

        # Lock the activity rows while creating the snapshot.
        activities = list(
            report.activities.select_for_update(of=("self",))
            .select_related(
                "department",
                "created_by",
            )
            .prefetch_related(
                "attachments",
                "attachments__uploaded_by",
            )
            .order_by("activity_date", "created_at")
        )

        if not activities:
            raise ValidationError(
                "A report must contain at least one activity."
            )

        for activity in activities:
            if activity.department_id != report.department_id:
                raise ValidationError(
                    "The report contains an activity from another department."
                )

            if not (
                report.start_date
                <= activity.activity_date
                <= report.end_date
            ):
                raise ValidationError(
                    "The report contains an activity outside its reporting period."
                )

            if activity.is_archived:
                raise ValidationError(
                    "The report contains an archived activity. Remove it before submission."
                )

        # Generate a fresh snapshot on initial submission or resubmission.
        snapshot = build_report_snapshot(
            report,
            activities,
        )

        now = timezone.now()

        report.compiled_snapshot = snapshot
        report.snapshot_created_at = now

        report.status = ReportSubmission.Status.SUBMITTED
        report.submitted_at = now
        report.reviewed_at = None
        report.reviewer = None
        report.review_comment = ""

        report.save(update_fields=[
            "compiled_snapshot",
            "snapshot_created_at",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewer",
            "review_comment",
            "updated_at",
        ])

        resubmitted = (
            previous_status
            == ReportSubmission.Status.CHANGES_REQUESTED
        )

        transaction.on_commit(
            lambda: notify_secretaries(
                report,
                resubmitted=resubmitted,
            )
        )

        return Response(
            self.get_serializer(report).data
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def start_review(self, request, pk=None):
        report = self.get_object()

        if not is_secretary(request.user):
            raise PermissionDenied(
                "Only the Secretary can review reports."
            )

        if report.status != ReportSubmission.Status.SUBMITTED:
            raise ValidationError(
                "Only submitted reports can enter review."
            )

        report.status = ReportSubmission.Status.UNDER_REVIEW
        report.reviewer = request.user
        report.reviewed_at = timezone.now()

        report.save(update_fields=[
            "status",
            "reviewer",
            "reviewed_at",
            "updated_at",
        ])

        return Response(
            self.get_serializer(report).data
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def request_changes(self, request, pk=None):
        report = self.get_object()

        if not is_secretary(request.user):
            raise PermissionDenied(
                "Only the Secretary can request report corrections."
            )

        if report.status not in {
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
        }:
            raise ValidationError(
                "This report cannot be returned for corrections."
            )

        comment = get_comment(request)

        if not comment:
            raise ValidationError({
                "comment": "Explain what needs to be corrected."
            })

        report.status = ReportSubmission.Status.CHANGES_REQUESTED
        report.reviewer = request.user
        report.reviewed_at = timezone.now()
        report.review_comment = comment

        report.save(update_fields=[
            "status",
            "reviewer",
            "reviewed_at",
            "review_comment",
            "updated_at",
        ])

        transaction.on_commit(
            lambda: notify_report_changes_requested(report)
        )

        return Response(
            self.get_serializer(report).data
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approve(self, request, pk=None):
        report = self.get_object()

        if not is_secretary(request.user):
            raise PermissionDenied(
                "Only the Secretary can approve reports."
            )

        if report.status not in {
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
        }:
            raise ValidationError(
                "Only submitted or under-review reports can be approved."
            )

        report.status = ReportSubmission.Status.APPROVED
        report.reviewer = request.user
        report.reviewed_at = timezone.now()
        report.review_comment = get_comment(request)

        report.save(update_fields=[
            "status",
            "reviewer",
            "reviewed_at",
            "review_comment",
            "updated_at",
        ])

        transaction.on_commit(
            lambda: notify_report_approved(report)
        )

        return Response(
            self.get_serializer(report).data
        )


# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------

class ActivitySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        period_type = request.query_params.get(
            "period_type",
            "WEEKLY",
        ).upper()

        date_value = request.query_params.get("date")

        if period_type not in {
            "DAILY",
            "WEEKLY",
            "MONTHLY",
        }:
            raise ValidationError({
                "period_type": "Choose DAILY, WEEKLY or MONTHLY."
            })

        if not date_value:
            raise ValidationError({
                "date": "Provide a date in YYYY-MM-DD format."
            })

        selected_date = parse_date_or_error(date_value, "date")

        start_date, end_date = get_reporting_period(
            period_type,
            selected_date,
        )

        queryset = Activity.objects.filter(
            activity_date__gte=start_date,
            activity_date__lte=end_date,
            is_archived=False,
        ).select_related(
            "department",
            "created_by",
        ).prefetch_related("attachments")

        department_id = request.query_params.get("department")

        if is_department_leader(user):
            department = user_department(user)

            if not department:
                raise PermissionDenied(
                    "Your account has no active department assignment."
                )

            queryset = queryset.filter(
                department=department
            )

        elif is_admin(user) or is_secretary(user):
            if department_id:
                queryset = queryset.filter(
                    department_id=parse_int_or_error(
                        department_id,
                        "department",
                    )
                )

        else:
            raise PermissionDenied(
                "You cannot view activity summaries."
            )

        # Only count expenditure for activities flagged as financial, so the
        # total matches the report snapshot calculation.
        totals = queryset.aggregate(
            attendance=Sum("attendance_count"),
            expenditure=Sum(
                "expenditure_amount",
                filter=Q(includes_financial_information=True),
            ),
        )

        activities = list(
            queryset.order_by(
                "activity_date",
                "created_at",
            )
        )

        serializer = ActivitySerializer(
            activities,
            many=True,
            context={"request": request},
        )

        return Response({
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date,
            "activity_count": len(activities),
            "total_attendance": totals["attendance"] or 0,
            "total_expenditure": totals["expenditure"] or Decimal("0.00"),
            "activities": serializer.data,
        })