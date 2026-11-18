
from django.contrib.auth import update_session_auth_hash
from django.db import transaction

from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny

from .models import User
from .serializers import (
    PasswordChangeSerializer,
    UserManagementSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)

from departments.models import Department


class IsSystemAdministrator(permissions.BasePermission):
    """
    Only ADMIN users and Django superusers can manage accounts.
    """

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (user.is_superuser or user.role == User.Role.ADMIN)
        )


class LeaderRegistrationView(CreateAPIView):
    """
    Public registration for Department Leaders.
    Every new account requires administrator approval.
    """

    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        request.user.set_password(
            serializer.validated_data["new_password"]
        )
        request.user.save(update_fields=["password"])

        update_session_auth_hash(request, request.user)

        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


class UserManagementViewSet(viewsets.ModelViewSet):
    serializer_class = UserManagementSerializer
    permission_classes = [IsSystemAdministrator]

    queryset = User.objects.all().order_by("username")

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "username",
        "first_name",
        "last_name",
        "email",
        "phone_number",
    ]

    ordering_fields = [
        "username",
        "first_name",
        "date_joined",
    ]

    ordering = ["username"]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise PermissionDenied(
                "You cannot delete your own administrator account."
            )

        if instance.is_superuser:
            raise PermissionDenied(
                "Superuser accounts cannot be deleted through this API."
            )

        instance.delete()

    @action(detail=False, methods=["get"], url_path="pending-approvals")
    def pending_approvals(self, request):
        pending_users = self.get_queryset().filter(
            role=User.Role.DEPARTMENT_LEADER,
            approval_status=User.ApprovalStatus.PENDING,
            is_active=False,
        ).prefetch_related("requested_departments").order_by("date_joined")

        serializer = self.get_serializer(pending_users, many=True)

        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=pk)

            if user.role != User.Role.DEPARTMENT_LEADER:
                return Response(
                    {
                        "detail": (
                            "Only Department Leader accounts "
                            "can be approved here."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.approval_status != User.ApprovalStatus.PENDING:
                return Response(
                    {"detail": "This account is not awaiting approval."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            requested_departments = list(
                user.requested_departments.all()
            )

            if not requested_departments:
                return Response(
                    {
                        "detail": (
                            "This applicant has not requested any departments."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            department_ids = [
                department.id for department in requested_departments
            ]

            departments = list(
                Department.objects.select_for_update().filter(
                    id__in=department_ids,
                    is_active=True,
                )
            )

            if len(departments) != len(department_ids):
                return Response(
                    {
                        "detail": (
                            "One or more requested departments are inactive "
                            "or no longer available. Review the application."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            conflicts = [
                department.name
                for department in departments
                if department.leader_id not in (None, user.id)
            ]

            if conflicts:
                return Response(
                    {
                        "detail": (
                            "These departments already have another leader: "
                            + ", ".join(conflicts)
                        ),
                        "conflicting_departments": conflicts,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            for department in departments:
                department.leader = user
                department.save(update_fields=["leader"])

            user.approval_status = User.ApprovalStatus.APPROVED
            user.is_active = True
            user.save(update_fields=["approval_status", "is_active"])

        return Response({
            "detail": (
                f"Account for {user.username} approved successfully. "
                "Requested departments have been assigned."
            ),
            "username": user.username,
            "approval_status": user.approval_status,
            "is_active": user.is_active,
            "assigned_departments": [
                department.name for department in departments
            ],
        })

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        user = self.get_object()

        if user.role != User.Role.DEPARTMENT_LEADER:
            return Response(
                {
                    "detail": (
                        "Only Department Leader accounts "
                        "can be rejected here."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.approval_status != User.ApprovalStatus.PENDING:
            return Response(
                {"detail": "This account is not awaiting approval."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.approval_status = User.ApprovalStatus.REJECTED
        user.is_active = False
        user.save(update_fields=["approval_status", "is_active"])

        return Response({
            "detail": f"Account request for {user.username} rejected.",
            "username": user.username,
            "approval_status": user.approval_status,
            "is_active": user.is_active,
        })

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()

        if user.pk == request.user.pk:
            raise PermissionDenied(
                "You cannot deactivate your own account."
            )

        if user.is_superuser:
            raise PermissionDenied(
                "Superuser accounts cannot be deactivated here."
            )

        user.is_active = False
        user.save(update_fields=["is_active"])

        return Response({
            "detail": "User account deactivated successfully."
        })

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        user = self.get_object()

        if user.is_superuser:
            raise PermissionDenied(
                "Superuser accounts cannot be modified here."
            )

        if user.approval_status == User.ApprovalStatus.PENDING:
            return Response(
                {
                    "detail": (
                        "Approve this account through the approval endpoint."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.approval_status == User.ApprovalStatus.REJECTED:
            return Response(
                {"detail": "Rejected accounts cannot be activated."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save(update_fields=["is_active"])

        return Response({
            "detail": "User account activated successfully."
        })
