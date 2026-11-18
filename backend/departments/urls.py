
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet,
    MemberViewSet,
    PublicDepartmentListView,
)

router = DefaultRouter()
router.register("members", MemberViewSet, basename="member")
router.register("", DepartmentViewSet, basename="department")

urlpatterns = [
    path(
        "public/",
        PublicDepartmentListView.as_view(),
        name="public-departments",
    ),
] + router.urls
