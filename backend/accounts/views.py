
from django.contrib.auth import update_session_auth_hash

from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import (
    PasswordChangeSerializer,
    UserManagementSerializer,
    UserProfileSerializer,
)


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

        user.is_active = True
        user.save(update_fields=["is_active"])

        return Response({
            "detail": "User account activated successfully."
        })
