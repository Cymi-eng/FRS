
from rest_framework import permissions, viewsets, filters, generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Department, Member
from .serializers import DepartmentSerializer, MemberSerializer


class PublicDepartmentListView(generics.ListAPIView):
    """
    Public endpoint used by the registration page.

    Only active department IDs and names are exposed.
    No authentication is required.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_queryset(self):
        return Department.objects.filter(
            is_active=True
        ).order_by("name")

    def list(self, request, *args, **kwargs):
        departments = self.get_queryset().values("id", "name")

        return Response(list(departments))


class DepartmentAccessPermission(permissions.BasePermission):
    """
    ADMIN:
        Full department management.

    SECRETARY:
        Read-only access to all departments.

    DEPARTMENT_LEADER:
        Read-only access to assigned departments.
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


class MemberAccessPermission(permissions.BasePermission):
    """
    ADMIN:
        Full member management.

    SECRETARY:
        Read-only access to all members.

    DEPARTMENT_LEADER:
        Manage members belonging to their assigned departments.
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
            return True

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_superuser or user.role == "ADMIN":
            return True

        if user.role == "SECRETARY":
            return request.method in permissions.SAFE_METHODS

        if user.role == "DEPARTMENT_LEADER":
            return obj.departments.filter(
                leader=user
            ).exists()

        return False


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    permission_classes = [MemberAccessPermission]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "full_name",
        "phone_number",
        "year_of_study",
        "departments__name",
    ]

    ordering_fields = [
        "full_name",
        "year_of_study",
        "created_at",
    ]

    ordering = ["full_name"]

    def get_queryset(self):
        user = self.request.user

        queryset = Member.objects.prefetch_related(
            "departments",
            "department_memberships__department",
        ).distinct()

        if not user.is_authenticated:
            return queryset.none()

        if user.is_superuser or user.role in ["ADMIN", "SECRETARY"]:
            pass

        elif user.role == "DEPARTMENT_LEADER":
            queryset = queryset.filter(
                departments__leader=user
            )

        else:
            return queryset.none()

        department_id = self.request.query_params.get("department")

        if department_id:
            queryset = queryset.filter(
                departments__id=department_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        user = self.request.user

        if user.is_superuser or user.role == "ADMIN":
            serializer.save()
            return

        if user.role != "DEPARTMENT_LEADER":
            raise PermissionDenied(
                "You are not allowed to register members."
            )

        assigned_departments = Department.objects.filter(
            leader=user,
            is_active=True,
        )

        requested_departments = serializer.validated_data.get(
            "departments",
            [],
        )

        if requested_departments:
            requested_ids = {
                department.id for department in requested_departments
            }

            allowed_ids = set(
                assigned_departments.values_list("id", flat=True)
            )

            if not requested_ids.issubset(allowed_ids):
                raise PermissionDenied(
                    "You can only register members in your assigned departments."
                )

            serializer.save(departments=requested_departments)

        else:
            if assigned_departments.count() != 1:
                raise PermissionDenied(
                    "Select one of your assigned departments."
                )

            serializer.save(
                departments=list(assigned_departments)
            )

    def perform_update(self, serializer):
        user = self.request.user

        if user.is_superuser or user.role == "ADMIN":
            serializer.save()
            return

        if user.role != "DEPARTMENT_LEADER":
            raise PermissionDenied(
                "You are not allowed to update members."
            )

        assigned_departments = Department.objects.filter(
            leader=user,
            is_active=True,
        )

        requested_departments = serializer.validated_data.get(
            "departments"
        )

        if requested_departments is not None:
            requested_ids = {
                department.id for department in requested_departments
            }

            allowed_ids = set(
                assigned_departments.values_list("id", flat=True)
            )

            if not requested_ids.issubset(allowed_ids):
                raise PermissionDenied(
                    "You can only assign members to your own departments."
                )

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user

        if user.is_superuser or user.role == "ADMIN":
            instance.delete()
            return

        if user.role != "DEPARTMENT_LEADER":
            raise PermissionDenied(
                "You are not allowed to delete members."
            )

        other_departments = instance.departments.exclude(
            leader=user
        )

        if other_departments.exists():
            raise PermissionDenied(
                "This member belongs to other departments. "
                "Only an administrator can delete this shared member record."
            )

        instance.delete()
