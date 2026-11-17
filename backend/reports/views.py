
import calendar
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity, ActivityAttachment, ReportSubmission
from .serializers import (
    ActivitySerializer,
    ActivityAttachmentSerializer,
    ReportSubmissionSerializer,
)


def user_department(user):
    return user.led_departments.filter(is_active=True).first()


def is_admin(user):
    return user.role == "ADMIN"


def is_secretary(user):
    return user.role == "SECRETARY"


def is_department_leader(user):
    return user.role == "DEPARTMENT_LEADER"


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
            queryset = queryset.filter(department_id=department_id)

        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)

        if start_date:
            queryset = queryset.filter(activity_date__gte=start_date)

        if end_date:
            queryset = queryset.filter(activity_date__lte=end_date)

        return queryset

    def create(self, request, *args, **kwargs):
        user = request.user

        if not (is_admin(user) or is_department_leader(user)):
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

        else:
            department_id = self.request.data.get("department")

            if not department_id:
                raise ValidationError({
                    "department": "Select a department."
                })

            from departments.models import Department

            department = get_object_or_404(
                Department,
                pk=department_id,
                is_active=True,
            )

        serializer.save(
            department=department,
            created_by=user,
        )

    def update(self, request, *args, **kwargs):
        activity = self.get_object()

        if not is_admin(request.user):
            if not is_department_leader(request.user):
                raise PermissionDenied(
                    "You cannot edit this activity."
                )

            if activity.created_by_id != request.user.id:
                raise PermissionDenied(
                    "You can only edit activities you recorded."
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


class ActivityAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityAttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    http_method_names = ["get", "post", "delete", "head", "options"]

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

    def perform_create(self, serializer):
        user = self.request.user
        activity_id = self.request.data.get("activity")

        activity = get_object_or_404(
            Activity.objects.select_related("department"),
            pk=activity_id,
        )

        if is_department_leader(user):
            department = user_department(user)

            if not department or activity.department_id != department.id:
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

        if uploaded_file.size > 10 * 1024 * 1024:
            raise ValidationError({
                "file": "Maximum file size is 10 MB."
            })

        allowed_extensions = {
            ".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx"
        }

        import os

        extension = os.path.splitext(uploaded_file.name)[1].lower()

        if extension not in allowed_extensions:
            raise ValidationError({
                "file": "Only JPG, PNG, WEBP, PDF and DOCX files are allowed."
            })

        serializer.save(
            activity=activity,
            uploaded_by=user,
        )

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()

        if not is_admin(request.user):
            if not is_department_leader(request.user):
                raise PermissionDenied(
                    "You cannot delete attachments."
                )

            if attachment.uploaded_by_id != request.user.id:
                raise PermissionDenied(
                    "You can only delete attachments you uploaded."
                )

        attachment.file.delete(save=False)
        attachment.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = ReportSubmissionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = [
        "get", "post", "put", "patch", "head", "options"
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

        if is_admin(user) or is_secretary(user):
            return queryset

        if is_department_leader(user):
            department = user_department(user)

            if department:
                return queryset.filter(department=department)

        return queryset.none()

    def create(self, request, *args, **kwargs):
        if not is_department_leader(request.user):
            raise PermissionDenied(
                "Only department leaders can create report submissions."
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        department = user_department(self.request.user)

        if not department:
            raise ValidationError(
                "Your account has no active department assignment."
            )

        report = serializer.save(
            department=department,
            created_by=self.request.user,
        )

        # If no activities were explicitly selected, include every
        # activity in the department within the reporting dates.
        if not report.activities.exists():
            matching_activities = Activity.objects.filter(
                department=department,
                activity_date__gte=report.start_date,
                activity_date__lte=report.end_date,
                is_archived=False,
            )

            report.activities.set(matching_activities)

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

        if report.status not in [
            ReportSubmission.Status.DRAFT,
            ReportSubmission.Status.CHANGES_REQUESTED,
        ]:
            raise PermissionDenied(
                "Only draft or correction-requested reports can be edited."
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied(
            "Reports cannot be permanently deleted."
        )

    @action(detail=True, methods=["post"])
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

        if report.status not in [
            ReportSubmission.Status.DRAFT,
            ReportSubmission.Status.CHANGES_REQUESTED,
        ]:
            raise ValidationError(
                "This report cannot be submitted in its current state."
            )

        if not report.activities.exists():
            raise ValidationError(
                "A report must contain at least one activity."
            )

        report.status = ReportSubmission.Status.SUBMITTED
        report.submitted_at = timezone.now()
        report.review_comment = ""
        report.save(
            update_fields=[
                "status",
                "submitted_at",
                "review_comment",
                "updated_at",
            ]
        )

        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
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
        report.save(
            update_fields=[
                "status",
                "reviewer",
                "reviewed_at",
                "updated_at",
            ]
        )

        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
    def request_changes(self, request, pk=None):
        report = self.get_object()

        if not is_secretary(request.user):
            raise PermissionDenied(
                "Only the Secretary can request report corrections."
            )

        if report.status not in [
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
        ]:
            raise ValidationError(
                "This report cannot be returned for corrections."
            )

        comment = request.data.get("comment", "").strip()

        if not comment:
            raise ValidationError({
                "comment": "Explain what needs to be corrected."
            })

        report.status = ReportSubmission.Status.CHANGES_REQUESTED
        report.reviewer = request.user
        report.reviewed_at = timezone.now()
        report.review_comment = comment
        report.save(
            update_fields=[
                "status",
                "reviewer",
                "reviewed_at",
                "review_comment",
                "updated_at",
            ]
        )

        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        report = self.get_object()

        if not is_secretary(request.user):
            raise PermissionDenied(
                "Only the Secretary can approve reports."
            )

        if report.status not in [
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
        ]:
            raise ValidationError(
                "Only submitted or under-review reports can be approved."
            )

        report.status = ReportSubmission.Status.APPROVED
        report.reviewer = request.user
        report.reviewed_at = timezone.now()
        report.review_comment = request.data.get("comment", "").strip()
        report.save(
            update_fields=[
                "status",
                "reviewer",
                "reviewed_at",
                "review_comment",
                "updated_at",
            ]
        )

        return Response(self.get_serializer(report).data)


class ActivitySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        period_type = request.query_params.get(
            "period_type",
            "WEEKLY",
        ).upper()

        date_value = request.query_params.get("date")

        if period_type not in ["WEEKLY", "MONTHLY"]:
            raise ValidationError({
                "period_type": "Choose WEEKLY or MONTHLY."
            })

        if not date_value:
            raise ValidationError({
                "date": "Provide a date in YYYY-MM-DD format."
            })

        from django.utils.dateparse import parse_date

        selected_date = parse_date(date_value)

        if not selected_date:
            raise ValidationError({
                "date": "Enter a valid date in YYYY-MM-DD format."
            })

        if period_type == "WEEKLY":
            start_date = selected_date - timedelta(
                days=selected_date.weekday()
            )
            end_date = start_date + timedelta(days=6)
        else:
            start_date = selected_date.replace(day=1)
            last_day = calendar.monthrange(
                selected_date.year,
                selected_date.month,
            )[1]
            end_date = selected_date.replace(day=last_day)

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

            queryset = queryset.filter(department=department)

        elif is_admin(user) or is_secretary(user):
            if department_id:
                queryset = queryset.filter(
                    department_id=department_id
                )
        else:
            raise PermissionDenied("You cannot view activity summaries.")

        total = queryset.count()

        totals = queryset.aggregate(
            attendance=Sum("attendance_count"),
            expenditure=Sum("expenditure_amount"),
        )

        serializer = ActivitySerializer(
            queryset.order_by("activity_date", "created_at"),
            many=True,
            context={"request": request},
        )

        return Response({
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date,
            "activity_count": total,
            "total_attendance": totals["attendance"] or 0,
            "total_expenditure": totals["expenditure"] or 0,
            "activities": serializer.data,
        })
