
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrator"
        SECRETARY = "SECRETARY", "Secretary"
        DEPARTMENT_LEADER = "DEPARTMENT_LEADER", "Department Leader"

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.DEPARTMENT_LEADER,
    )

    phone_number = models.CharField(
        max_length=20,
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
