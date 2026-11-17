
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
