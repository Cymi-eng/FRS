
from django.urls import include, path

from rest_framework.routers import DefaultRouter

from .views import (
    CurrentUserView,
    LeaderRegistrationView,
    PasswordChangeView,
    UserManagementViewSet,
)


router = DefaultRouter()

router.register(
    "users",
    UserManagementViewSet,
    basename="user-management",
)


urlpatterns = [
    path(
        "register/",
        LeaderRegistrationView.as_view(),
        name="leader-registration",
    ),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path(
        "change-password/",
        PasswordChangeView.as_view(),
        name="change-password",
    ),
    path("", include(router.urls)),
]
