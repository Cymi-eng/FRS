
import re
from io import BytesIO
from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from docx import Document
from docx.shared import Inches, Pt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .models import ReportSubmission


HISTORICAL_STATUSES = {
    ReportSubmission.Status.SUBMITTED,
    ReportSubmission.Status.UNDER_REVIEW,
    ReportSubmission.Status.APPROVED,
}


def get_report_for_export(user, report_id):
    """Retrieve a report only when the user can access its department."""

    report = get_object_or_404(
        ReportSubmission.objects.select_related(
            "department",
            "created_by",
            "reviewer",
        ).prefetch_related(
            "activities",
            "activities__attachments",
        ),
        pk=report_id,
    )

    if user.is_superuser or user.role in ["ADMIN", "SECRETARY"]:
        return report

    if user.role == "DEPARTMENT_LEADER":
        department = user.led_departments.filter(
            is_active=True
        ).first()

        if department and report.department_id == department.id:
            return report

    raise PermissionDenied(
        "You do not have permission to export this report."
    )


def safe_filename(value):
    value = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "-",
        str(value),
    )
    return value.strip("-") or "department-report"


def format_amount(value):
    try:
        return f"KES {float(value):,.2f}"
    except (TypeError, ValueError):
        return "KES 0.00"


def get_report_filename(report, extension):
    department = safe_filename(report.department.code)
    period = safe_filename(report.period_type.lower())
    start = report.start_date.strftime("%Y%m%d")
    end = report.end_date.strftime("%Y%m%d")

    return (
        f"{department}-{period}-report-{start}-{end}.{extension}"
    )


def uses_historical_snapshot(report):
    return (
        report.status in HISTORICAL_STATUSES
        and isinstance(report.compiled_snapshot, dict)
        and bool(report.compiled_snapshot.get("activities"))
    )


def get_export_data(report):
    """
    Return immutable snapshot data for submitted reports.

    Drafts and correction-requested reports use their current
    editable database records.
    """

    if uses_historical_snapshot(report):
        snapshot = report.compiled_snapshot

        return {
            "report": snapshot.get("report", {}),
            "department": snapshot.get("department", {}),
            "activities": snapshot.get("activities", []),
            "activity_count": snapshot.get("activity_count", 0),
            "total_attendance": snapshot.get("total_attendance", 0),
            "calculated_activity_expenditure": snapshot.get(
                "calculated_activity_expenditure",
                "0.00",
            ),
            "prepared_by": snapshot.get("prepared_by", ""),
            "generated_at": snapshot.get("generated_at", ""),
            "is_snapshot": True,
        }

    activities = report.activities.all().order_by(
        "activity_date",
        "created_at",
    ).prefetch_related(
        "attachments",
        "attachments__uploaded_by",
    )

    activity_data = []

    for activity in activities:
        attachments = []

        for attachment in activity.attachments.all():
            attachments.append({
                "file_name": attachment.file.name.split("/")[-1],
                "caption": attachment.caption,
                "uploaded_by": (
                    attachment.uploaded_by.get_full_name()
                    or attachment.uploaded_by.username
                ),
                "uploaded_at": attachment.uploaded_at.isoformat(),
            })

        activity_data.append({
            "id": activity.id,
            "activity_type": activity.activity_type,
            "activity_type_display": activity.get_activity_type_display(),
            "title": activity.title,
            "activity_date": activity.activity_date.isoformat(),
            "location": activity.location,
            "description": activity.description,
            "attendance_count": activity.attendance_count,
            "outcomes": activity.outcomes,
            "challenges": activity.challenges,
            "includes_financial_information": (
                activity.includes_financial_information
            ),
            "expenditure_amount": str(activity.expenditure_amount),
            "financial_notes": activity.financial_notes,
            "attachments": attachments,
        })

    return {
        "report": {
            "title": report.title,
            "executive_summary": report.executive_summary,
            "achievements": report.achievements,
            "challenges": report.challenges,
            "recommendations": report.recommendations,
            "plans_for_next_period": report.plans_for_next_period,
            "general_remarks": report.general_remarks,
            "includes_financial_report": report.includes_financial_report,
            "financial_summary": report.financial_summary,
            "total_expenditure": str(report.total_expenditure),
        },
        "department": {
            "name": report.department.name,
            "code": report.department.code,
        },
        "activities": activity_data,
        "activity_count": len(activity_data),
        "total_attendance": sum(
            item["attendance_count"] for item in activity_data
        ),
        "calculated_activity_expenditure": str(
            sum(
                (
                    float(item["expenditure_amount"])
                    for item in activity_data
                    if item["includes_financial_information"]
                ),
                0,
            )
        ),
        "prepared_by": (
            report.created_by.get_full_name()
            or report.created_by.username
        ),
        "generated_at": "",
        "is_snapshot": False,
    }


def display_date(value):
    if not value:
        return "Not specified"

    try:
        from datetime import date

        parsed = date.fromisoformat(str(value)[:10])
        return parsed.strftime("%d %B %Y")
    except (ValueError, TypeError):
        return str(value)


def report_title(report, data):
    return (
        data["report"].get("title")
        or report.title
        or (
            f"{report.department.name} "
            f"{report.get_period_type_display()} Report"
        )
    )


def safe_pdf_text(value):
    return escape(str(value or "")).replace("\n", "<br/>")


class ReportPDFExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_report_for_export(
            request.user,
            report_id,
        )

        data = get_export_data(report)
        report_data = data["report"]
        activities = data["activities"]

        buffer = BytesIO()

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=report_title(report, data),
            author="Moi University Main Altar",
        )

        styles = getSampleStyleSheet()

        styles.add(
            ParagraphStyle(
                name="ChurchHeading",
                parent=styles["Title"],
                alignment=TA_CENTER,
                fontSize=17,
                leading=22,
                spaceAfter=5,
            )
        )

        styles.add(
            ParagraphStyle(
                name="ReportHeading",
                parent=styles["Heading1"],
                alignment=TA_CENTER,
                fontSize=13,
                leading=17,
                spaceAfter=14,
            )
        )

        styles.add(
            ParagraphStyle(
                name="SectionHeading",
                parent=styles["Heading2"],
                fontSize=12,
                leading=15,
                spaceBefore=12,
                spaceAfter=6,
            )
        )

        styles.add(
            ParagraphStyle(
                name="SmallBody",
                parent=styles["BodyText"],
                fontSize=9,
                leading=13,
                spaceAfter=5,
            )
        )

        story = []

        story.append(
            Paragraph(
                "MOI UNIVERSITY MAIN ALTAR",
                styles["ChurchHeading"],
            )
        )

        story.append(
            Paragraph(
                escape(report_title(report, data)),
                styles["ReportHeading"],
            )
        )

        metadata = [
            ["Department", data["department"].get(
                "name",
                report.department.name,
            )],
            ["Report Type", report.get_period_type_display()],
            [
                "Reporting Period",
                (
                    f"{display_date(report.start_date)} - "
                    f"{display_date(report.end_date)}"
                ),
            ],
            ["Prepared By", data["prepared_by"]],
            ["Status", report.get_status_display()],
            [
                "Submitted On",
                (
                    report.submitted_at.strftime("%d %B %Y, %H:%M")
                    if report.submitted_at
                    else "Not submitted"
                ),
            ],
            ["Total Activities", str(data["activity_count"])],
            ["Total Attendance", str(data["total_attendance"])],
        ]

        if report.reviewer:
            metadata.append([
                "Reviewed By",
                (
                    report.reviewer.get_full_name()
                    or report.reviewer.username
                ),
            ])

        table = Table(
            metadata,
            colWidths=[42 * mm, 125 * mm],
        )

        table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])
        )

        story.append(table)
        story.append(Spacer(1, 12))

        def add_section(heading, content):
            if content and str(content).strip():
                story.append(
                    Paragraph(
                        escape(heading),
                        styles["SectionHeading"],
                    )
                )

                story.append(
                    Paragraph(
                        safe_pdf_text(content),
                        styles["SmallBody"],
                    )
                )

        add_section(
            "Executive Summary",
            report_data.get("executive_summary"),
        )

        add_section(
            "Achievements",
            report_data.get("achievements"),
        )

        add_section(
            "Challenges",
            report_data.get("challenges"),
        )

        add_section(
            "Recommendations",
            report_data.get("recommendations"),
        )

        add_section(
            "Plans for the Next Period",
            report_data.get("plans_for_next_period"),
        )

        add_section(
            "General Remarks",
            report_data.get("general_remarks"),
        )

        story.append(
            Paragraph(
                "ACTIVITY DETAILS",
                styles["SectionHeading"],
            )
        )

        if not activities:
            story.append(
                Paragraph(
                    "No activities are attached to this report.",
                    styles["SmallBody"],
                )
            )

        for index, activity in enumerate(activities, start=1):
            story.append(
                Paragraph(
                    f"{index}. {escape(str(activity.get('title', 'Untitled Activity')))}",
                    styles["Heading3"],
                )
            )

            details = [
                [
                    "Activity Type",
                    activity.get(
                        "activity_type_display",
                        activity.get("activity_type", "Not specified"),
                    ),
                ],
                [
                    "Date",
                    display_date(activity.get("activity_date")),
                ],
                [
                    "Location",
                    activity.get("location") or "Not specified",
                ],
                [
                    "Attendance",
                    str(activity.get("attendance_count", 0)),
                ],
                [
                    "Description",
                    activity.get("description") or "Not provided",
                ],
                [
                    "Outcomes",
                    activity.get("outcomes") or "Not provided",
                ],
                [
                    "Challenges",
                    activity.get("challenges") or "Not provided",
                ],
            ]

            activity_table = Table(
                [
                    [
                        Paragraph(
                            f"<b>{escape(str(label))}</b>",
                            styles["SmallBody"],
                        ),
                        Paragraph(
                            safe_pdf_text(value),
                            styles["SmallBody"],
                        ),
                    ]
                    for label, value in details
                ],
                colWidths=[35 * mm, 132 * mm],
            )

            activity_table.setStyle(
                TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )

            story.append(activity_table)

            attachments = activity.get("attachments", [])

            if attachments:
                attachment_names = ", ".join(
                    item.get("file_name", "Attachment")
                    for item in attachments
                )

                story.append(
                    Paragraph(
                        f"<b>Attachments:</b> {escape(attachment_names)}",
                        styles["SmallBody"],
                    )
                )

            if activity.get("includes_financial_information"):
                story.append(
                    Paragraph(
                        "<b>Activity Expenditure:</b> "
                        + format_amount(
                            activity.get("expenditure_amount")
                        ),
                        styles["SmallBody"],
                    )
                )

                if activity.get("financial_notes"):
                    story.append(
                        Paragraph(
                            "<b>Financial Notes:</b> "
                            + safe_pdf_text(
                                activity["financial_notes"]
                            ),
                            styles["SmallBody"],
                        )
                    )

            story.append(Spacer(1, 8))

        if report_data.get("includes_financial_report"):
            story.append(
                Paragraph(
                    "FINANCIAL SUMMARY",
                    styles["SectionHeading"],
                )
            )

            story.append(
                Paragraph(
                    "<b>Total Expenditure:</b> "
                    + format_amount(
                        report_data.get("total_expenditure")
                    ),
                    styles["SmallBody"],
                )
            )

            add_section(
                "Financial Notes",
                report_data.get("financial_summary"),
            )

        add_section(
            "Secretary's Review Comments",
            report.review_comment,
        )

        story.append(Spacer(1, 20))

        if data["is_snapshot"]:
            story.append(
                Paragraph(
                    "Historical snapshot generated: "
                    + escape(data["generated_at"]),
                    styles["SmallBody"],
                )
            )

        story.append(
            Paragraph(
                "Generated by the Moi University Main Altar "
                "Departmental Reporting System.",
                styles["SmallBody"],
            )
        )

        document.build(story)

        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/pdf",
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{get_report_filename(report, "pdf")}"'
        )

        return response


class ReportWordExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_report_for_export(
            request.user,
            report_id,
        )

        data = get_export_data(report)
        report_data = data["report"]
        activities = data["activities"]

        document = Document()

        section = document.sections[0]
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

        document.styles["Normal"].font.name = "Arial"
        document.styles["Normal"].font.size = Pt(10)

        heading = document.add_heading(
            "MOI UNIVERSITY MAIN ALTAR",
            level=0,
        )
        heading.alignment = 1

        title = document.add_heading(
            report_title(report, data),
            level=1,
        )
        title.alignment = 1

        document.add_heading(
            "REPORT INFORMATION",
            level=2,
        )

        metadata = [
            (
                "Department",
                data["department"].get(
                    "name",
                    report.department.name,
                ),
            ),
            (
                "Report Type",
                report.get_period_type_display(),
            ),
            (
                "Reporting Period",
                (
                    f"{display_date(report.start_date)} - "
                    f"{display_date(report.end_date)}"
                ),
            ),
            (
                "Prepared By",
                data["prepared_by"],
            ),
            (
                "Status",
                report.get_status_display(),
            ),
            (
                "Submitted On",
                (
                    report.submitted_at.strftime("%d %B %Y, %H:%M")
                    if report.submitted_at
                    else "Not submitted"
                ),
            ),
            (
                "Total Activities",
                data["activity_count"],
            ),
            (
                "Total Attendance",
                data["total_attendance"],
            ),
        ]

        if report.reviewer:
            metadata.append((
                "Reviewed By",
                (
                    report.reviewer.get_full_name()
                    or report.reviewer.username
                ),
            ))

        table = document.add_table(rows=0, cols=2)
        table.style = "Table Grid"

        for label, value in metadata:
            cells = table.add_row().cells
            cells[0].text = str(label)
            cells[1].text = str(value)

        def add_word_section(heading_text, content):
            if content and str(content).strip():
                document.add_heading(
                    heading_text,
                    level=2,
                )
                document.add_paragraph(str(content))

        add_word_section(
            "Executive Summary",
            report_data.get("executive_summary"),
        )

        add_word_section(
            "Achievements",
            report_data.get("achievements"),
        )

        add_word_section(
            "Challenges",
            report_data.get("challenges"),
        )

        add_word_section(
            "Recommendations",
            report_data.get("recommendations"),
        )

        add_word_section(
            "Plans for the Next Period",
            report_data.get("plans_for_next_period"),
        )

        add_word_section(
            "General Remarks",
            report_data.get("general_remarks"),
        )

        document.add_heading(
            "ACTIVITY DETAILS",
            level=2,
        )

        if not activities:
            document.add_paragraph(
                "No activities are attached to this report."
            )

        for index, activity in enumerate(activities, start=1):
            document.add_heading(
                f"{index}. {activity.get('title', 'Untitled Activity')}",
                level=3,
            )

            activity_details = [
                (
                    "Activity Type",
                    activity.get(
                        "activity_type_display",
                        activity.get("activity_type", "Not specified"),
                    ),
                ),
                (
                    "Date",
                    display_date(activity.get("activity_date")),
                ),
                (
                    "Location",
                    activity.get("location") or "Not specified",
                ),
                (
                    "Attendance",
                    activity.get("attendance_count", 0),
                ),
                (
                    "Description",
                    activity.get("description") or "Not provided",
                ),
                (
                    "Outcomes",
                    activity.get("outcomes") or "Not provided",
                ),
                (
                    "Challenges",
                    activity.get("challenges") or "Not provided",
                ),
            ]

            activity_table = document.add_table(
                rows=0,
                cols=2,
            )
            activity_table.style = "Table Grid"

            for label, value in activity_details:
                cells = activity_table.add_row().cells
                cells[0].text = str(label)
                cells[1].text = str(value)

            attachments = activity.get("attachments", [])

            if attachments:
                document.add_paragraph(
                    "Attachments: "
                    + ", ".join(
                        item.get("file_name", "Attachment")
                        for item in attachments
                    )
                )

            if activity.get("includes_financial_information"):
                document.add_paragraph(
                    "Activity Expenditure: "
                    + format_amount(
                        activity.get("expenditure_amount")
                    )
                )

                if activity.get("financial_notes"):
                    document.add_paragraph(
                        "Financial Notes: "
                        + str(activity["financial_notes"])
                    )

        if report_data.get("includes_financial_report"):
            document.add_heading(
                "FINANCIAL SUMMARY",
                level=2,
            )

            document.add_paragraph(
                "Total Expenditure: "
                + format_amount(
                    report_data.get("total_expenditure")
                )
            )

            add_word_section(
                "Financial Notes",
                report_data.get("financial_summary"),
            )

        add_word_section(
            "Secretary's Review Comments",
            report.review_comment,
        )

        if data["is_snapshot"]:
            add_word_section(
                "Historical Snapshot Generated",
                data["generated_at"],
            )

        document.add_paragraph("")

        footer = document.add_paragraph(
            "Generated by the Moi University Main Altar "
            "Departmental Reporting System."
        )
        footer.alignment = 1

        buffer = BytesIO()
        document.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            ),
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{get_report_filename(report, "docx")}"'
        )

        return response
