import os
import sys
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 36, "TIMETABLE-PRO · Technical Architecture & System Workflow")
            self.drawRightString(letter[0] - 54, letter[1] - 36, "Date-Aware Semester Scheduling")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.75)
            self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Footer
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(54, 46, letter[0] - 54, 46)
        self.drawString(54, 32, "TIMETABLE-PRO · INSTITUTIONAL SCHEDULING PLATFORM")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 32, page_text)
        self.restoreState()

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1e3a8a'),
        spaceAfter=4,
    )

    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#475569'),
        spaceAfter=14,
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=12,
        spaceAfter=6,
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#2563eb'),
        spaceBefore=8,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    tbl_hdr_style = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )

    tbl_cell_style = ParagraphStyle(
        'TblCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1f2937'),
    )

    tbl_bold_cell = ParagraphStyle(
        'TblBoldCell',
        parent=tbl_cell_style,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1e3a8a'),
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("TimetablePro: Architecture & Workflow Guide", title_style))
    story.append(Paragraph("Two-Tier Scheduling Engine, Calendar Ingestion & Exam Lecture Suppression", sub_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceBefore=2, spaceAfter=14))

    # Section 1
    story.append(Paragraph("1. Executive Summary & Why These Changes Were Made", h1_style))
    story.append(Paragraph(
        "Conventional automated timetable software operates under a simplified assumption: it solves "
        "a single, static week (Monday through Friday, Periods 1 to 6) and assumes this pattern can repeat without modification "
        "across the entire academic session. In actual educational institutions, however, a real semester runs for 16 to 18 "
        "calendar weeks, during which two very distinct types of calendar events take place:",
        body_style
    ))
    story.append(Paragraph(
        "&bull; <b>Public Holidays & Vacations (e.g., Diwali break, Gandhi Jayanti):</b> The institution is physically closed. "
        "The scheduled classes are lost, creating syllabus completion deficits. Faculty and students require compensatory / make-up "
        "classes to cover the missing curriculum.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Scheduled Examinations (e.g., Internal Assessments, MSE, ESE):</b> The college is open, "
        "but regular teaching cannot happen because faculty are invigilating, classrooms and labs are occupied by tests, and students "
        "are writing papers.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>The Software Flaw in Existing Solutions:</b> If an administrator marked exam days as 'Closures' (holidays), traditional algorithms "
        "panicked and attempted to reschedule dozens of unnecessary make-up lectures for exam periods. Conversely, if marked as 'Open Days', "
        "regular lectures and labs were blindly scheduled at the exact same time as exams. Our new architecture resolves this cleanly.",
        body_style
    ))

    # Section 2
    story.append(Spacer(1, 6))
    story.append(Paragraph("2. The Two-Tier Architecture & Data Flow", h1_style))
    story.append(Paragraph(
        "To achieve both optimal performance and real-world flexibility, the system separates timetable generation into two distinct, "
        "cooperating engines:",
        body_style
    ))

    t1_data = [
        [Paragraph("Architecture Tier", tbl_hdr_style), Paragraph("Engine & Code Component", tbl_hdr_style), Paragraph("Responsibility & Database Target", tbl_hdr_style)],
        [
            Paragraph("Level 1: Master Weekly Blueprint", tbl_bold_cell),
            Paragraph("<b>solver.py</b><br/>(Google OR-Tools CP-SAT)", tbl_cell_style),
            Paragraph("Solves the ideal recurring weekly pattern without calendar dates. Stores day-of-week slots in the <b>timetable</b> database table.", tbl_cell_style)
        ],
        [
            Paragraph("Level 1.5: Calendar Ingestion", tbl_bold_cell),
            Paragraph("<b>calendar.py</b><br/>(FastAPI & SQLAlchemy)", tbl_cell_style),
            Paragraph("Ingests college circulars, regional public holidays, and custom Excel/CSV/PDF files. Stores events in <b>calendar_event</b> with closure and suppression flags.", tbl_cell_style)
        ],
        [
            Paragraph("Level 2: Date-Aware Semester Expansion", tbl_bold_cell),
            Paragraph("<b>semester_optimize.py</b> &<br/><b>semester_solver.py</b>", tbl_cell_style),
            Paragraph("Maps weekly template across 18 real calendar weeks. Suppresses lectures on exam dates and reschedules holiday make-ups into vacant slots. Stores revisions in <b>timetable_version</b> and <b>scheduled_session</b>.", tbl_cell_style)
        ],
    ]
    t1 = Table(t1_data, colWidths=[130, 140, 234])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f8fafc'), colors.white]),
    ]))
    story.append(t1)

    # Section 3
    story.append(Spacer(1, 8))
    story.append(Paragraph("3. Step-by-Step System Workflow", h1_style))
    story.append(Paragraph("3.1 Academic Calendar Ingestion & Event Tagging", h2_style))
    story.append(Paragraph(
        "Events are imported from the official circular or uploaded via file. Every event is tagged with two operational flags:",
        body_style
    ))

    t2_data = [
        [Paragraph("Event Category", tbl_hdr_style), Paragraph("is_closure", tbl_hdr_style), Paragraph("suppresses_lectures", tbl_hdr_style), Paragraph("Resulting Scheduler Behavior", tbl_hdr_style)],
        [
            Paragraph("Public Holiday / Festival<br/>(e.g., Diwali, Dasara)", tbl_bold_cell),
            Paragraph("<b>True</b>", tbl_cell_style),
            Paragraph("<b>True</b>", tbl_cell_style),
            Paragraph("College closed. Classes lost. Automated search finds vacant periods for make-up lectures.", tbl_cell_style)
        ],
        [
            Paragraph("Internal Assessment / Exams<br/>(e.g., MSE, IA, ESE)", tbl_bold_cell),
            Paragraph("<b>False</b>", tbl_cell_style),
            Paragraph("<b>True</b>", tbl_cell_style),
            Paragraph("College open. Regular lectures suppressed on those dates. <b>NO make-up classes generated</b>.", tbl_cell_style)
        ],
        [
            Paragraph("Normal Teaching Day", tbl_bold_cell),
            Paragraph("False", tbl_cell_style),
            Paragraph("False", tbl_cell_style),
            Paragraph("College open. Standard weekly timetable runs normally.", tbl_cell_style)
        ],
        [
            Paragraph("Special Working Saturday", tbl_bold_cell),
            Paragraph("False", tbl_cell_style),
            Paragraph("False (override)", tbl_cell_style),
            Paragraph("Weekend override. Provides additional teaching capacity for makeup lectures.", tbl_cell_style)
        ],
    ]
    t2 = Table(t2_data, colWidths=[130, 60, 100, 214])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2563eb')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#fef2f2'), colors.HexColor('#fefce8'), colors.white, colors.HexColor('#f0fdf4')]),
    ]))
    story.append(t2)

    story.append(Spacer(1, 6))
    story.append(Paragraph("3.2 What solver.py Generates and Where It Goes", h2_style))
    story.append(Paragraph(
        "<b>solver.py</b> is the Combinatorial Constraint Solver. It accepts global teacher preferences, classroom capacities, "
        "lab consecutive slot requirements, and max daily teaching limits. It executes CP-SAT to output a conflict-free, 1-week master template. "
        "This data is persisted in the PostgreSQL table <b>timetable</b> with fields: class_id, subject_id, teacher_id, room_id, and slot_id. "
        "It takes less than 2 seconds to generate.",
        body_style
    ))

    story.append(Paragraph("3.3 How semester_solver.py and semester_optimize.py Process the Data", h2_style))
    story.append(Paragraph(
        "The semester orchestrator takes the template from <b>timetable</b> and executes a 3-step date expansion across the 18 weeks:<br/>"
        "1. <b>Calendar Projection:</b> Every date in the term is paired with its corresponding weekday template row.<br/>"
        "2. <b>Assessment Day Interception:</b> If a date has <code>suppresses_lectures = True</code> (e.g., Nov 16-21 for IA), "
        "regular lectures are cancelled with the outcome note <i>'Suppressed due to Internal Assessment (No lectures scheduled)'</i>. "
        "They are not flagged as missed curriculum, so no make-up lectures are required.<br/>"
        "3. <b>Holiday Make-Up Rescheduling:</b> For actual holidays (<code>is_closure = True</code>), the engine searches for vacant slots:<br/>"
        "&nbsp;&nbsp;&nbsp;&bull; <i>Priority 1 (Admin Preference):</i> If the HOD specified a preferred replacement date/period, the engine validates that slot.<br/>"
        "&nbsp;&nbsp;&nbsp;&bull; <i>Priority 2 (Autonomous 35-Day Search):</i> If unspecified, the solver searches nearby weeks for a vacant period where teacher, class, and room are free, daily teacher workload is within limits, and the candidate date is neither an exam day nor a holiday.",
        body_style
    ))

    # Section 4
    story.append(Spacer(1, 6))
    story.append(Paragraph("4. Key Takeaways & Defense Points for Oral Presentation", h1_style))

    qas = [
        ("Why not use a single solver for the whole semester?",
         "A single solver trying to schedule 18 weeks at once has an astronomical search space (over 10^12 variables) and would take hours to solve or time out. Decoupling the weekly master template (solver.py) from date-aware calendar expansion (semester_solver.py) gives instantaneous master solving (<2s) and instant date adjustments (<1s)."),
        ("Where is the data stored?",
         "The weekly template lives in the <b>timetable</b> table. The full dated semester timetable lives in <b>scheduled_session</b>, grouped under version-controlled records in <b>timetable_version</b> with an auditable draft/publish workflow."),
        ("Why was suppresses_lectures introduced instead of using is_closure?",
         "is_closure represents an institution shutdown, which triggers automatic makeup compensation. Exams and Internal Assessments are normal college working days where lectures are intentionally suppressed. The new flag cleanly separates the two concepts with zero side-effects."),
        ("How does the UI represent this?",
         "The Weekly Timetable Grid shows red banners for 'Holiday - No Classes', amber badges for 'Exam / IA - No Lectures', and gold badges for '⚡ Makeup' classes.")
    ]

    for q, a in qas:
        story.append(Paragraph(f"<b>Q: {q}</b>", ParagraphStyle('Q', parent=body_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#1e3a8a'), spaceAfter=2)))
        story.append(Paragraph(a, ParagraphStyle('A', parent=body_style, spaceAfter=6)))

    doc.build(story, canvasmaker=NumberedCanvas)
    print("Successfully generated PDF document at:", output_path)

if __name__ == "__main__":
    out_dir = r"c:\Users\Chinmayee\Desktop\TIMETABLE-PRO-llm\timetable-generator"
    out_file = os.path.join(out_dir, "TimetablePro_Architecture_and_Workflow.pdf")
    build_pdf(out_file)
