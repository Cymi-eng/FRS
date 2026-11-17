
from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "leader",
        "is_active",
        "created_at",
    )

    list_filter = ("is_active", "created_at")

    search_fields = (
        "name",
        "code",
        "description",
        "leader__username",
        "leader__first_name",
        "leader__last_name",
    )

    list_select_related = ("leader",)
    ordering = ("name",)

    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Department Information",
            {
                "fields": (
                    "name",
                    "code",
                    "description",
                    "is_active",
                )
            },
        ),
        (
            "Department Leadership",
            {"fields": ("leader",)},
        ),
        (
            "Record Information",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
