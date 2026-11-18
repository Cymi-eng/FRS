
import calendar

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
            getattr(
                self.instance,
                "includes_financial_information",
                False,
            ),
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

    period_type = serializers.ChoiceField(
        choices=(
            ("DAILY", "Daily"),
            ("WEEKLY", "Weekly"),
            ("MONTHLY", "Monthly"),
        ),
    )

    activities = ActivitySerializer(
        many=True,
        read_only=True,
    )

    activity_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Activity.objects.filter(is_archived=False),
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
        instance = self.instance

        period_type = attrs.get(
            "period_type",
            getattr(instance, "period_type", None),
        )

        start_date = attrs.get(
            "start_date",
            getattr(instance, "start_date", None),
        )

        end_date = attrs.get(
            "end_date",
            getattr(instance, "end_date", None),
        )

        if not start_date or not end_date:
            raise serializers.ValidationError(
                "Both start_date and end_date are required."
            )

        if end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be before start date."
            })

        # DAILY: exactly one calendar day.
        if period_type == "DAILY":
            if start_date != end_date:
                raise serializers.ValidationError({
                    "end_date": (
                        "A daily report must cover exactly one day. "
                        "Start date and end date must be identical."
                    )
                })

        # WEEKLY: Monday to Sunday.
        elif period_type == "WEEKLY":
            if start_date.weekday() != 0:
                raise serializers.ValidationError({
                    "start_date": "Weekly reports must start on Monday."
                })

            if (end_date - start_date).days != 6:
                raise serializers.ValidationError({
                    "end_date": "Weekly reports must cover exactly seven days."
                })

        # MONTHLY: complete calendar month.
        elif period_type == "MONTHLY":
            last_day = calendar.monthrange(
                start_date.year,
                start_date.month,
            )[1]

            expected_end = start_date.replace(day=last_day)

            if start_date.day != 1 or end_date != expected_end:
                raise serializers.ValidationError(
                    "Monthly reports must cover a complete calendar month."
                )

        # Prevent changes to reports that are already submitted or approved.
        if instance and instance.status in (
            ReportSubmission.Status.SUBMITTED,
            ReportSubmission.Status.UNDER_REVIEW,
            ReportSubmission.Status.APPROVED,
        ):
            protected_fields = {
                "period_type",
                "start_date",
                "end_date",
                "title",
                "executive_summary",
                "achievements",
                "challenges",
                "recommendations",
                "plans_for_next_period",
                "includes_financial_report",
                "financial_summary",
                "total_expenditure",
                "activities",
            }

            changed_fields = protected_fields.intersection(attrs.keys())

            if changed_fields:
                raise serializers.ValidationError(
                    "This report cannot be edited in its current status."
                )

        activities = attrs.get("activities")

        request = self.context.get("request")
        user = getattr(request, "user", None)

        # Determine the department available to the current leader.
        leader_department_id = None

        if user and getattr(user, "role", None) == "DEPARTMENT_LEADER":
            department = user.led_departments.filter(
                is_active=True
            ).first()

            if not department:
                raise serializers.ValidationError(
                    "Your account has no active department assignment."
                )

            leader_department_id = department.id

            if instance and instance.department_id != leader_department_id:
                raise serializers.ValidationError(
                    "You cannot manage reports belonging to another department."
                )

        # Validate manually selected activities.
        if activities is not None:
            for activity in activities:
                if not start_date <= activity.activity_date <= end_date:
                    raise serializers.ValidationError({
                        "activity_ids": (
                            "Every selected activity must fall within "
                            "the report dates."
                        )
                    })

                if leader_department_id and (
                    activity.department_id != leader_department_id
                ):
                    raise serializers.ValidationError({
                        "activity_ids": (
                            "You can only include activities from "
                            "your own department."
                        )
                    })

            department_ids = {
                activity.department_id for activity in activities
            }

            if len(department_ids) > 1:
                raise serializers.ValidationError({
                    "activity_ids": (
                        "A report can only contain activities "
                        "from one department."
                    )
                })

        return attrs

    def _validate_activity_selection(self, activities, department, start_date, end_date):
        for activity in activities:
            if activity.department_id != department.id:
                raise serializers.ValidationError({
                    "activity_ids": (
                        "A report cannot include activities from another department."
                    )
                })

            if not start_date <= activity.activity_date <= end_date:
                raise serializers.ValidationError({
                    "activity_ids": (
                        "Every activity must fall within the report dates."
                    )
                })

            if activity.is_archived:
                raise serializers.ValidationError({
                    "activity_ids": (
                        "Archived activities cannot be included in a report."
                    )
                })

    def create(self, validated_data):
        activities_provided = "activities" in validated_data
        selected_activities = validated_data.pop("activities", None)

        department = validated_data.get("department")
        start_date = validated_data["start_date"]
        end_date = validated_data["end_date"]

        if department is None:
            request = self.context.get("request")
            user = getattr(request, "user", None)

            if user and getattr(user, "role", None) == "DEPARTMENT_LEADER":
                department = user.led_departments.filter(
                    is_active=True
                ).first()

        if department is None:
            raise serializers.ValidationError(
                "A department must be assigned before creating a report."
            )

        if activities_provided:
            activities = list(selected_activities)
        else:
            # Automatically compile all eligible activities
            # for the selected department and reporting period.
            activities = list(
                Activity.objects.filter(
                    department=department,
                    activity_date__range=(start_date, end_date),
                    is_archived=False,
                ).order_by("activity_date", "created_at")
            )

        self._validate_activity_selection(
            activities,
            department,
            start_date,
            end_date,
        )

        report = ReportSubmission.objects.create(
            **validated_data,
        )

        report.activities.set(activities)

        return report

    def update(self, instance, validated_data):
        activities_provided = "activities" in validated_data

        selected_activities = validated_data.pop(
            "activities",
            None,
        )

        new_start_date = validated_data.get(
            "start_date",
            instance.start_date,
        )

        new_end_date = validated_data.get(
            "end_date",
            instance.end_date,
        )

        period_changed = (
            new_start_date != instance.start_date
            or new_end_date != instance.end_date
        )

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        if activities_provided:
            activities = list(selected_activities)

            self._validate_activity_selection(
                activities,
                instance.department,
                instance.start_date,
                instance.end_date,
            )

            instance.activities.set(activities)

        elif period_changed:
            # Recompile automatically if a draft's reporting
            # period changes.
            activities = list(
                Activity.objects.filter(
                    department=instance.department,
                    activity_date__range=(
                        instance.start_date,
                        instance.end_date,
                    ),
                    is_archived=False,
                ).order_by("activity_date", "created_at")
            )

            instance.activities.set(activities)

        return instance
