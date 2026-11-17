
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Department


User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    leader_name = serializers.SerializerMethodField()
    leader_username = serializers.CharField(
        source="leader.username",
        read_only=True,
        default=None,
    )

    leader = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="DEPARTMENT_LEADER"),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "code",
            "description",
            "leader",
            "leader_name",
            "leader_username",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "leader_name",
            "leader_username",
            "created_at",
            "updated_at",
        ]

    def get_leader_name(self, obj):
        if not obj.leader:
            return None

        return obj.leader.get_full_name() or obj.leader.username

    def validate_leader(self, value):
        if value and value.role != "DEPARTMENT_LEADER":
            raise serializers.ValidationError(
                "Only department leaders can be assigned to departments."
            )

        return value
