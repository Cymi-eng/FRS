
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Department, Member, DepartmentMembership


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


class DepartmentMembershipSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
    )

    class Meta:
        model = DepartmentMembership
        fields = [
            "id",
            "department",
            "department_name",
            "joined_at",
        ]
        read_only_fields = ["id", "joined_at"]


class MemberSerializer(serializers.ModelSerializer):
    departments = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True),
        many=True,
        required=False,
    )

    department_details = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id",
            "full_name",
            "year_of_study",
            "phone_number",
            "departments",
            "department_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "department_details",
            "created_at",
            "updated_at",
        ]

    def get_department_details(self, obj):
        return [
            {
                "id": membership.department_id,
                "name": membership.department.name,
            }
            for membership in obj.department_memberships.select_related(
                "department"
            ).all()
        ]

    @transaction.atomic
    def create(self, validated_data):
        departments = validated_data.pop("departments", [])

        member = Member.objects.create(**validated_data)

        DepartmentMembership.objects.bulk_create([
            DepartmentMembership(
                member=member,
                department=department,
            )
            for department in departments
        ])

        return member

    @transaction.atomic
    def update(self, instance, validated_data):
        departments = validated_data.pop("departments", None)

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        instance.save()

        if departments is not None:
            request = self.context.get("request")
            user = getattr(request, "user", None)

            if (
                user
                and user.is_authenticated
                and not user.is_superuser
                and user.role == "DEPARTMENT_LEADER"
            ):
                # Preserve memberships belonging to other departments.
                other_departments = list(
                    instance.departments.exclude(
                        leader=user
                    )
                )

                # Replace only memberships managed by this leader.
                departments_to_keep = list(departments)

                combined_departments = {
                    department.id: department
                    for department in (
                        other_departments + departments_to_keep
                    )
                }

                instance.departments.set(
                    list(combined_departments.values())
                )
            else:
                # Administrators can manage all department memberships.
                instance.departments.set(departments)

        return instance
