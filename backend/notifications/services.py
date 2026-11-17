
from django.contrib.auth import get_user_model

from .models import Notification


User = get_user_model()


def notify_secretaries(report, resubmitted=False):
    """Notify all active Secretaries when a report is submitted."""

    notification_type = (
        Notification.NotificationType.REPORT_RESUBMITTED
        if resubmitted
        else Notification.NotificationType.REPORT_SUBMITTED
    )

    title = (
        "Report Resubmitted"
        if resubmitted
        else "New Report Submitted"
    )

    message = (
        f"{report.department.name} has resubmitted its "
        f"{report.get_period_type_display().lower()} report "
        f"for {report.start_date:%d %b %Y} to "
        f"{report.end_date:%d %b %Y}."
        if resubmitted
        else (
            f"{report.department.name} has submitted its "
            f"{report.get_period_type_display().lower()} report "
            f"for {report.start_date:%d %b %Y} to "
            f"{report.end_date:%d %b %Y}."
        )
    )

    secretaries = User.objects.filter(
        role="SECRETARY",
        is_active=True,
    )

    notifications = [
        Notification(
            recipient=secretary,
            notification_type=notification_type,
            title=title,
            message=message,
            report=report,
        )
        for secretary in secretaries
    ]

    if notifications:
        Notification.objects.bulk_create(notifications)


def notify_department_leader(
    report,
    notification_type,
    title,
    message,
):
    """Notify the assigned department leader about a report update."""

    leader = report.department.leader

    if leader is None or not leader.is_active:
        leader = report.created_by

    if (
        leader is None
        or not leader.is_active
        or leader.role != "DEPARTMENT_LEADER"
    ):
        return

    Notification.objects.create(
        recipient=leader,
        notification_type=notification_type,
        title=title,
        message=message,
        report=report,
    )


def notify_report_changes_requested(report):
    notify_department_leader(
        report=report,
        notification_type=Notification.NotificationType.CHANGES_REQUESTED,
        title="Report Corrections Requested",
        message=(
            f"The Secretary has requested changes to your "
            f"{report.get_period_type_display().lower()} report "
            f"for {report.department.name}. "
            f"Please review the feedback and resubmit."
        ),
    )


def notify_report_approved(report):
    notify_department_leader(
        report=report,
        notification_type=Notification.NotificationType.REPORT_APPROVED,
        title="Report Approved",
        message=(
            f"Your {report.get_period_type_display().lower()} report "
            f"for {report.department.name} has been approved."
        ),
    )
