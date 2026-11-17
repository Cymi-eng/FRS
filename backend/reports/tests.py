
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from departments.models import Department
from reports.models import Activity, ReportSubmission


User = get_user_model()


class ReportingModelTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(
            username="department_leader",
            password="TestPassword123!",
            role="DEPARTMENT_LEADER",
        )

        self.department = Department.objects.create(
            name="Worship Department",
            code="WOR",
            leader=self.leader,
        )

    def test_activity_can_be_created(self):
        activity = Activity.objects.create(
            department=self.department,
            created_by=self.leader,
            title="Sunday Worship Service",
            activity_date=date(2026, 11, 15),
            description="Weekly worship service",
        )

        self.assertEqual(activity.department, self.department)
        self.assertEqual(activity.created_by, self.leader)

    def test_valid_weekly_report_period(self):
        report = ReportSubmission(
            department=self.department,
            created_by=self.leader,
            period_type=ReportSubmission.PeriodType.WEEKLY,
            start_date=date(2026, 11, 9),
            end_date=date(2026, 11, 15),
            title="Weekly Department Report",
        )

        report.full_clean()

    def test_invalid_weekly_report_period_is_rejected(self):
        report = ReportSubmission(
            department=self.department,
            created_by=self.leader,
            period_type=ReportSubmission.PeriodType.WEEKLY,
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 16),
            title="Invalid Weekly Report",
        )

        with self.assertRaises(ValidationError):
            report.full_clean()

    def test_valid_monthly_report_period(self):
        report = ReportSubmission(
            department=self.department,
            created_by=self.leader,
            period_type=ReportSubmission.PeriodType.MONTHLY,
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 30),
            title="November Monthly Report",
        )

        report.full_clean()
