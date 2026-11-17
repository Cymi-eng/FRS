
from django.contrib import admin

from .models import Activity, ActivityAttachment, ReportSubmission


class ActivityAttachmentInline(admin.TabularInline):
    model = ActivityAttachment
    extra = 0
    fields = ("file", "caption", "uploaded_by", "uploaded_at")
    readonly_fields = ("uploaded_at",)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "department",
        "activity_type",
        "activity_date",
        "attendance_count",
        "includes_financial_information",
        "created_by",
    )

    list_filter = (
        "department",
        "activity_type",
        "activity_date",
        "includes_financial_information",
        "is_archived",
    )

    search_fields = (
        "title",
        "description",
        "location",
        "department__name",
        "created_by__username",
    )

    date_hierarchy = "activity_date"
    list_select_related = ("department", "created_by")
    ordering = ("-activity_date",)

    readonly_fields = ("created_at", "updated_at")

    inlines = [ActivityAttachmentInline]

    fieldsets = (
        (
            "Activity Details",
            {
                "fields": (
                    "department",
                    "created_by",
                    "activity_type",
                    "title",
                    "activity_date",
                    "location",
                    "description",
                )
            },
        ),
        (
            "Results",
            {
                "fields": (
                    "attendance_count",
                    "outcomes",
                    "challenges",
                )
            },
        ),
        (
            "Financial Information",
            {
                "fields": (
                    "includes_financial_information",
                    "expenditure_amount",
                    "financial_notes",
                )
            },
        ),
        (
            "Record Management",
            {
                "fields": (
                    "is_archived",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(ActivityAttachment)
class ActivityAttachmentAdmin(admin.ModelAdmin):
    list_display = (
        "activity",
        "uploaded_by",
        "caption",
        "uploaded_at",
    )

    search_fields = (
        "activity__title",
        "caption",
        "uploaded_by__username",
    )

    list_filter = ("uploaded_at",)
    list_select_related = ("activity", "uploaded_by")
    readonly_fields = ("uploaded_at",)


@admin.register(ReportSubmission)
class ReportSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "department",
        "period_type",
        "start_date",
        "end_date",
        "status",
        "created_by",
        "reviewer",
        "submitted_at",
    )

    list_filter = (
        "period_type",
        "status",
        "department",
        "start_date",
    )

    search_fields = (
        "department__name",
        "title",
        "created_by__username",
        "reviewer__username",
        "review_comment",
    )

    list_select_related = (
        "department",
        "created_by",
        "reviewer",
    )

    filter_horizontal = ("activities",)

    readonly_fields = (
        "submitted_at",
        "reviewed_at",
        "created_at",
        "updated_at",
    )

    ordering = ("-start_date",)

    fieldsets = (
        (
            "Report Details",
            {
                "fields": (
                    "department",
                    "created_by",
                    "period_type",
                    "start_date",
                    "end_date",
                    "title",
                    "activities",
                )
            },
        ),
        (
            "Report Content",
            {
                "fields": (
                    "executive_summary",
                    "achievements",
                    "challenges",
                    "recommendations",
                    "plans_for_next_period",
                )
            },
        ),
        (
            "Financial Summary",
            {
                "fields": (
                    "includes_financial_report",
                    "financial_summary",
                    "total_expenditure",
                )
            },
        ),
        (
            "Review and Approval",
            {
                "fields": (
                    "status",
                    "reviewer",
                    "review_comment",
                    "submitted_at",
                    "reviewed_at",
                )
            },
        ),
        (
            "Record Information",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
