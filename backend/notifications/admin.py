
from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "recipient",
        "notification_type",
        "is_read",
        "created_at",
    )

    list_filter = (
        "notification_type",
        "is_read",
        "created_at",
    )

    search_fields = (
        "title",
        "message",
        "recipient__username",
        "recipient__email",
    )

    list_select_related = ("recipient", "report")
    readonly_fields = ("created_at", "read_at")
    ordering = ("-created_at",)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
