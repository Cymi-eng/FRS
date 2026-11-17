
from rest_framework import serializers

from .models import Activity, ActivityAttachment, ReportSubmission


class ActivityAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name",
        read_only=True,
    )

    class Meta:
        model = ActivityAttachment
        fields = (
            "id",
            "activity",
            "file",
            "caption",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        read_only_fields = (
            "id",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )


class ActivitySerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
    )

    attachments = ActivityAttachmentSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Activity
        fields = (
            "id",
            "department",
            "department_name",
            "created_by",
            "created_by_name",
            "activity_type",
            "title",
            "activity_date",
            "location",
            "description",
            "attendance_count",
            "outcomes",
            "challenges",
            "includes_financial_information",
            "expenditure_amount",
            "financial_notes",
            "is_archived",
            "attachments",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "department",
            "created_by",
            "is_archived",
            "created_at",
            "updated_at",
            "attachments",
        )

    def validate(self, attrs):
        includes_finances = attrs.get(
            "includes_financial_information",
            getattr(self.instance, "includes_financial_information", False),
        )

        amount = attrs.get(
            "expenditure_amount",
            getattr(self.instance, "expenditure_amount", 0),
        )

        if not includes_finances and amount:
            raise serializers.ValidationError({
                "expenditure_amount": (
                    "Enable financial information before entering expenditure."
                )
            })

        return attrs


class ReportSubmissionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
    )

    reviewer_name = serializers.CharField(
        source="reviewer.get_full_name",
        read_only=True,
        allow_null=True,
    )

    activities = ActivitySerializer(many=True, read_only=True)

    activity_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Activity.objects.all(),
        source="activities",
        write_only=True,
        required=False,
    )

    class Meta:
        model = ReportSubmission
        fields = (
            "id",
            "department",
            "department_name",
            "created_by",
            "created_by_name",
            "period_type",
            "start_date",
            "end_date",
            "title",
            "activities",
            "activity_ids",
            "executive_summary",
            "achievements",
            "challenges",
            "recommendations",
            "plans_for_next_period",
            "includes_financial_report",
            "financial_summary",
            "total_expenditure",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewer",
            "reviewer_name",
            "review_comment",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "department",
            "created_by",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewer",
            "review_comment",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        period_type = attrs.get(
            "period_type",
            getattr(self.instance, "period_type", None),
        )

        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )

        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )

        if not start_date or not end_date:
            raise serializers.ValidationError(
                "Both start_date and end_date are required."
            )

        if end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be before start date."
            })

        if period_type == ReportSubmission.PeriodType.WEEKLY:
            if start_date.weekday() != 0:
                raise serializers.ValidationError({
                    "start_date": "Weekly reports must start on Monday."
                })

            if (end_date - start_date).days != 6:
                raise serializers.ValidationError({
                    "end_date": "Weekly reports must cover seven days."
                })

        elif period_type == ReportSubmission.PeriodType.MONTHLY:
            import calendar

            last_day = calendar.monthrange(
                start_date.year,
                start_date.month,
            )[1]

            if (
                start_date.day != 1
                or end_date.year != start_date.year
                or end_date.month != start_date.month
                or end_date.day != last_day
            ):
                raise serializers.ValidationError(
                    "Monthly reports must cover a complete calendar month."
                )

        activities = attrs.get("activities")

        if activities is not None:
            request = self.context.get("request")

            if request and request.user.role == "DEPARTMENT_LEADER":
                department = request.user.led_departments.filter(
                    is_active=True
                ).first()

                if not department:
                    raise serializers.ValidationError(
                        "Your account has no active department assignment."
                    )

                for activity in activities:
                    if activity.department_id != department.id:
                        raise serializers.ValidationError({
                            "activity_ids": (
                                "You can only include activities from your "
                                "own department."
                            )
                        })

                    if not start_date <= activity.activity_date <= end_date:
                        raise serializers.ValidationError({
                            "activity_ids": (
                                "Every activity must fall within the report dates."
                            )
                        })

        return attrs
