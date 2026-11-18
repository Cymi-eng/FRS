
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True)

    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_departments",
        limit_choices_to={"role": "DEPARTMENT_LEADER"},
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def clean(self):
        if self.leader and self.leader.role != "DEPARTMENT_LEADER":
            raise ValidationError({
                "leader": "Only department leaders can be assigned to a department."
            })

    def __str__(self):
        return f"{self.name} ({self.code})"


class Member(models.Model):
    full_name = models.CharField(max_length=200)
    year_of_study = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=20)

    departments = models.ManyToManyField(
        Department,
        through="DepartmentMembership",
        related_name="members",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class DepartmentMembership(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="department_memberships",
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "member"],
                name="unique_member_department",
            )
        ]

    def __str__(self):
        return f"{self.member.full_name} - {self.department.name}"
