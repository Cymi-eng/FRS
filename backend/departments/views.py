
from rest_framework import permissions, viewsets, filters
from rest_framework.exceptions import PermissionDenied

from .models import Department
from .serializers import DepartmentSerializer


class DepartmentAccessPermission(permissions.BasePermission):
    """
    ADMIN:
        Full department management.

    SECRETARY:
        Read-only access to all departments.

    DEPARTMENT_LEADER:
        Read-only access to their assigned department.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        if user.role == "SECRETARY":
            return request.method in permissions.SAFE_METHODS

        if user.role == "DEPARTMENT_LEADER":
            return request.method in permissions.SAFE_METHODS

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_superuser or user.role == "ADMIN":
            return True

        if request.method not in permissions.SAFE_METHODS:
            return False

        if user.role == "SECRETARY":
            return True

        if user.role == "DEPARTMENT_LEADER":
            return obj.leader_id == user.id

        return False


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [DepartmentAccessPermission]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "code",
        "description",
        "leader__username",
        "leader__first_name",
        "leader__last_name",
    ]

    ordering_fields = [
        "name",
        "code",
        "created_at",
        "updated_at",
    ]

    ordering = ["name"]

    def get_queryset(self):
        user = self.request.user

        queryset = Department.objects.select_related("leader")

        if not user.is_authenticated:
            return queryset.none()

        if user.is_superuser or user.role in ["ADMIN", "SECRETARY"]:
            pass

        elif user.role == "DEPARTMENT_LEADER":
            queryset = queryset.filter(leader=user)

        else:
            return queryset.none()

        active = self.request.query_params.get("is_active")

        if active is not None:
            if active.lower() in ["true", "1"]:
                queryset = queryset.filter(is_active=True)
            elif active.lower() in ["false", "0"]:
                queryset = queryset.filter(is_active=False)

        leader_id = self.request.query_params.get("leader")

        if leader_id and (
            user.is_superuser or user.role in ["ADMIN", "SECRETARY"]
        ):
            queryset = queryset.filter(leader_id=leader_id)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user

        if not (user.is_superuser or user.role == "ADMIN"):
            raise PermissionDenied(
                "Only administrators can create departments."
            )

        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user

        if not (user.is_superuser or user.role == "ADMIN"):
            raise PermissionDenied(
                "Only administrators can update departments."
            )

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user

        if not (user.is_superuser or user.role == "ADMIN"):
            raise PermissionDenied(
                "Only administrators can delete departments."
            )

        instance.delete()
