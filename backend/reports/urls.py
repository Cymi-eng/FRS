
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityAttachmentViewSet,
    ActivitySummaryView,
    ActivityViewSet,
    ReportSubmissionViewSet,
)
from .exports import (
    ReportPDFExportView,
    ReportWordExportView,
)

router = DefaultRouter()

router.register("activities", ActivityViewSet, basename="activity")
router.register(
    "attachments",
    ActivityAttachmentViewSet,
    basename="activity-attachment",
)
router.register(
    "submissions",
    ReportSubmissionViewSet,
    basename="report-submission",
)

urlpatterns = [
    path("", include(router.urls)),
    path(
        "activity-summary/",
        ActivitySummaryView.as_view(),
        name="activity-summary",
    ),
    path(
        "submissions/<int:report_id>/export/pdf/",
        ReportPDFExportView.as_view(),
        name="report-export-pdf",
    ),
    path(
        "submissions/<int:report_id>/export/word/",
        ReportWordExportView.as_view(),
        name="report-export-word",
    ),
]
