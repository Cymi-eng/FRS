
from django.contrib import admin

from .models import Department, Member, DepartmentMembership


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


class DepartmentMembershipInline(admin.TabularInline):
    model = DepartmentMembership
    extra = 1
    autocomplete_fields = ("department",)
    readonly_fields = ("joined_at",)


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "year_of_study",
        "phone_number",
        "created_at",
    )

    search_fields = (
        "full_name",
        "phone_number",
        "year_of_study",
    )

    list_filter = ("year_of_study", "created_at")
    ordering = ("full_name",)
    readonly_fields = ("created_at", "updated_at")

    inlines = (DepartmentMembershipInline,)

    fieldsets = (
        (
            "Member Information",
            {
                "fields": (
                    "full_name",
                    "year_of_study",
                    "phone_number",
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


@admin.register(DepartmentMembership)
class DepartmentMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "department",
        "joined_at",
    )

    list_filter = ("department", "joined_at")

    search_fields = (
        "member__full_name",
        "member__phone_number",
        "department__name",
    )

    autocomplete_fields = ("member", "department")
    list_select_related = ("member", "department")
    readonly_fields = ("joined_at",)
