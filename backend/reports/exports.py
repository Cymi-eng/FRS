
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


def get_report_for_export(user, report_id):
    """
    Retrieve a report only when the requesting user has permission
    to access its department.
    """
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
    value = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(value))
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


def get_report_activities(report):
    return report.activities.all().order_by(
        "activity_date",
        "created_at",
    )


class ReportPDFExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_report_for_export(
            request.user,
            report_id,
        )

        buffer = BytesIO()

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title=report.title,
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
                escape(report.title),
                styles["ReportHeading"],
            )
        )

        metadata = [
            ["Department", report.department.name],
            ["Report Type", report.get_period_type_display()],
            [
                "Reporting Period",
                f"{report.start_date:%d %B %Y} - "
                f"{report.end_date:%d %B %Y}",
            ],
            ["Prepared By", str(report.created_by)],
            ["Status", report.get_status_display()],
            [
                "Submitted On",
                (
                    report.submitted_at.strftime("%d %B %Y, %H:%M")
                    if report.submitted_at
                    else "Not submitted"
                ),
            ],
        ]

        if report.reviewer:
            metadata.append(
                ["Reviewed By", str(report.reviewer)]
            )

        table = Table(
            metadata,
            colWidths=[42 * mm, 125 * mm],
        )

        table.setStyle(
            TableStyle(
                [
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
                ]
            )
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
                        escape(str(content)).replace("\n", "<br/>"),
                        styles["SmallBody"],
                    )
                )

        add_section(
            "Executive Summary",
            report.executive_summary,
        )

        add_section("Achievements", report.achievements)
        add_section("Challenges", report.challenges)
        add_section("Recommendations", report.recommendations)
        add_section(
            "Plans for the Next Period",
            report.plans_for_next_period,
        )

        activities = get_report_activities(report)

        story.append(
            Paragraph("ACTIVITY DETAILS", styles["SectionHeading"])
        )

        if not activities.exists():
            story.append(
                Paragraph(
                    "No activities are attached to this report.",
                    styles["SmallBody"],
                )
            )

        for index, activity in enumerate(activities, start=1):
            story.append(
                Paragraph(
                    f"{index}. {escape(activity.title)}",
                    styles["Heading3"],
                )
            )

            details = [
                ["Activity Type", activity.get_activity_type_display()],
                ["Date", activity.activity_date.strftime("%d %B %Y")],
                ["Location", activity.location or "Not specified"],
                ["Attendance", str(activity.attendance_count)],
                ["Description", activity.description or "Not provided"],
                ["Outcomes", activity.outcomes or "Not provided"],
                ["Challenges", activity.challenges or "Not provided"],
            ]

            activity_table = Table(
                [
                    [
                        Paragraph(
                            f"<b>{escape(str(label))}</b>",
                            styles["SmallBody"],
                        ),
                        Paragraph(
                            escape(str(value)).replace("\n", "<br/>"),
                            styles["SmallBody"],
                        ),
                    ]
                    for label, value in details
                ],
                colWidths=[35 * mm, 132 * mm],
            )

            activity_table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )

            story.append(activity_table)

            attachments = list(activity.attachments.all())

            if attachments:
                attachment_names = ", ".join(
                    attachment.file.name.split("/")[-1]
                    for attachment in attachments
                )

                story.append(
                    Paragraph(
                        f"<b>Attachments:</b> {escape(attachment_names)}",
                        styles["SmallBody"],
                    )
                )

            if activity.includes_financial_information:
                story.append(
                    Paragraph(
                        "<b>Activity Expenditure:</b> "
                        + format_amount(activity.expenditure_amount),
                        styles["SmallBody"],
                    )
                )

                if activity.financial_notes:
                    story.append(
                        Paragraph(
                            "<b>Financial Notes:</b> "
                            + escape(activity.financial_notes),
                            styles["SmallBody"],
                        )
                    )

            story.append(Spacer(1, 8))

        if report.includes_financial_report:
            story.append(
                Paragraph(
                    "FINANCIAL SUMMARY",
                    styles["SectionHeading"],
                )
            )

            story.append(
                Paragraph(
                    "<b>Total Expenditure:</b> "
                    + format_amount(report.total_expenditure),
                    styles["SmallBody"],
                )
            )

            add_section(
                "Financial Notes",
                report.financial_summary,
            )

        if report.review_comment:
            add_section(
                "Secretary's Review Comments",
                report.review_comment,
            )

        story.append(Spacer(1, 20))
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

        title = document.add_heading(report.title, level=1)
        title.alignment = 1

        document.add_heading("REPORT INFORMATION", level=2)

        metadata = [
            ("Department", report.department.name),
            ("Report Type", report.get_period_type_display()),
            (
                "Reporting Period",
                f"{report.start_date:%d %B %Y} - "
                f"{report.end_date:%d %B %Y}",
            ),
            ("Prepared By", str(report.created_by)),
            ("Status", report.get_status_display()),
            (
                "Submitted On",
                (
                    report.submitted_at.strftime("%d %B %Y, %H:%M")
                    if report.submitted_at
                    else "Not submitted"
                ),
            ),
        ]

        if report.reviewer:
            metadata.append(("Reviewed By", str(report.reviewer)))

        table = document.add_table(rows=0, cols=2)
        table.style = "Table Grid"

        for label, value in metadata:
            cells = table.add_row().cells
            cells[0].text = label
            cells[1].text = str(value)

        def add_word_section(heading_text, content):
            if content and str(content).strip():
                document.add_heading(heading_text, level=2)
                document.add_paragraph(str(content))

        add_word_section(
            "Executive Summary",
            report.executive_summary,
        )

        add_word_section("Achievements", report.achievements)
        add_word_section("Challenges", report.challenges)
        add_word_section("Recommendations", report.recommendations)
        add_word_section(
            "Plans for the Next Period",
            report.plans_for_next_period,
        )

        document.add_heading("ACTIVITY DETAILS", level=2)

        activities = get_report_activities(report)

        if not activities.exists():
            document.add_paragraph(
                "No activities are attached to this report."
            )

        for index, activity in enumerate(activities, start=1):
            document.add_heading(
                f"{index}. {activity.title}",
                level=3,
            )

            activity_details = [
                ("Activity Type", activity.get_activity_type_display()),
                ("Date", activity.activity_date.strftime("%d %B %Y")),
                ("Location", activity.location or "Not specified"),
                ("Attendance", activity.attendance_count),
                ("Description", activity.description or "Not provided"),
                ("Outcomes", activity.outcomes or "Not provided"),
                ("Challenges", activity.challenges or "Not provided"),
            ]

            activity_table = document.add_table(rows=0, cols=2)
            activity_table.style = "Table Grid"

            for label, value in activity_details:
                cells = activity_table.add_row().cells
                cells[0].text = str(label)
                cells[1].text = str(value)

            attachments = list(activity.attachments.all())

            if attachments:
                document.add_paragraph(
                    "Attachments: "
                    + ", ".join(
                        attachment.file.name.split("/")[-1]
                        for attachment in attachments
                    )
                )

            if activity.includes_financial_information:
                document.add_paragraph(
                    "Activity Expenditure: "
                    + format_amount(activity.expenditure_amount)
                )

                if activity.financial_notes:
                    document.add_paragraph(
                        "Financial Notes: " + activity.financial_notes
                    )

        if report.includes_financial_report:
            document.add_heading("FINANCIAL SUMMARY", level=2)

            document.add_paragraph(
                "Total Expenditure: "
                + format_amount(report.total_expenditure)
            )

            add_word_section(
                "Financial Notes",
                report.financial_summary,
            )

        add_word_section(
            "Secretary's Review Comments",
            report.review_comment,
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
