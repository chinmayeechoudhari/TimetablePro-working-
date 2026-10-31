import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_document(output_path):
    doc = Document()
    
    # Page setup - 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styles setup
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Calibri'
    style_normal.font.size = Pt(11)
    style_normal.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Header / Title Block
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("TimetablePro: Architecture & Workflow Guide")
    run_title.font.name = 'Calibri'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A) # Deep Navy

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(18)
    run_sub = sub_p.add_run("Two-Tier Scheduling Engine, Calendar Ingestion & Exam Lecture Suppression")
    run_sub.font.size = Pt(13)
    run_sub.font.italic = True
    run_sub.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    # Decorative Divider Line
    divider = doc.add_paragraph()
    divider.paragraph_format.space_after = Pt(14)
    pBdr = OxmlElement('w:pBdr')
    bottomBdr = OxmlElement('w:bottom')
    bottomBdr.set(qn('w:val'), 'single')
    bottomBdr.set(qn('w:sz'), '12')
    bottomBdr.set(qn('w:space'), '1')
    bottomBdr.set(qn('w:color'), '2563EB')
    pBdr.append(bottomBdr)
    divider._p.get_or_add_pPr().append(pBdr)

    # Section 1: Executive Summary
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r_h1 = h1.add_run("1. Executive Summary & Why These Changes Were Made")
    r_h1.font.size = Pt(15)
    r_h1.font.bold = True
    r_h1.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    p1 = doc.add_paragraph(
        "Conventional automated timetable software operates under a simplified assumption: it solves "
        "a single, static week (Monday through Friday, Periods 1 to 6) and assumes this pattern can repeat without modification "
        "across the entire academic session. In actual educational institutions, however, a real semester runs for 16 to 18 "
        "calendar weeks, during which two very distinct types of calendar events take place:"
    )
    p1.paragraph_format.space_after = Pt(6)

    doc.add_paragraph(
        "• Public Holidays & Vacations (e.g. Diwali break, Gandhi Jayanti, Eid): The institution is physically closed. "
        "The scheduled classes are lost, creating syllabus completion deficits. Faculty and students require compensatory / make-up "
        "classes to cover the missing curriculum.",
        style='List Bullet'
    )
    doc.add_paragraph(
        "• Scheduled Examinations (e.g. Internal Assessments, Mid-Semester Exams, End-Semester Exams): The college is open, "
        "but regular teaching cannot happen because faculty are invigilating, classrooms and labs are occupied by tests, and students "
        "are writing papers.",
        style='List Bullet'
    )

    p_problem = doc.add_paragraph()
    p_problem.paragraph_format.space_before = Pt(8)
    p_problem.paragraph_format.space_after = Pt(14)
    r_prob_bold = p_problem.add_run("The Software Flaw in Existing Solutions: ")
    r_prob_bold.bold = True
    p_problem.add_run(
        "If an administrator marked exam days as 'Closures' (holidays), traditional algorithms panicked and attempted to reschedule "
        "dozens of unnecessary make-up lectures for exam periods. Conversely, if marked as 'Open Days', regular lectures and labs were "
        "blindly scheduled at the exact same time as exams. Our new architecture resolves this dilemma cleanly."
    )

    # Section 2: The Two-Tier Architecture
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    r_h2 = h2.add_run("2. The Two-Tier Architecture & Data Flow")
    r_h2.font.size = Pt(15)
    r_h2.font.bold = True
    r_h2.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph(
        "To achieve both optimal performance and real-world flexibility, the system separates timetable generation into two distinct, "
        "cooperating engines:"
    )

    # Table for Level 1 vs Level 2
    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = "Architecture Tier"
    hdr_cells[1].text = "Engine & Code Component"
    hdr_cells[2].text = "Responsibility & Database Target"
    for cell in hdr_cells:
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 120, 120, 150, 150)
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    data_rows = [
        ("Level 1: Master Weekly Blueprint", "solver.py\n(Google OR-Tools CP-SAT)", "Solves the ideal recurring weekly pattern without calendar dates. Stores day-of-week slots in the 'timetable' database table."),
        ("Level 1.5: Calendar Ingestion", "calendar.py\n(FastAPI & SQLAlchemy)", "Ingests college circulars, regional public holidays, and custom Excel/CSV/PDF files. Stores events in 'calendar_event' with closure and suppression flags."),
        ("Level 2: Date-Aware Semester Expansion", "semester_optimize.py &\nsemester_solver.py", "Maps the weekly template across 18 real calendar weeks. Suppresses lectures on exam dates and reschedules holiday make-ups into vacant slots. Stores revisions in 'timetable_version' and 'scheduled_session'.")
    ]

    for tier, comp, resp in data_rows:
        row_cells = table.add_row().cells
        row_cells[0].text = tier
        row_cells[1].text = comp
        row_cells[2].text = resp
        for cell in row_cells:
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, 100, 100, 140, 140)
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Section 3: Deep-Dive into Components
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    r_h3 = h3.add_run("3. Step-by-Step System Workflow")
    r_h3.font.size = Pt(15)
    r_h3.font.bold = True
    r_h3.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph(
        "Step 3.1: Academic Calendar Ingestion & Event Tagging", style='Heading 2'
    )
    doc.add_paragraph(
        "The administrator configures the Academic Term (e.g. Aug 1, 2026 – Dec 31, 2026). Events are imported from "
        "the official college activity circular or uploaded via file. Every event is tagged with two essential boolean flags:"
    )

    t2 = doc.add_table(rows=1, cols=4)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    h_c = t2.rows[0].cells
    h_c[0].text = "Event Category"
    h_c[1].text = "is_closure"
    h_c[2].text = "suppresses_lectures"
    h_c[3].text = "Resulting Scheduler Behavior"
    for cell in h_c:
        set_cell_background(cell, "2563EB")
        set_cell_margins(cell, 100, 100, 120, 120)
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    ev_rows = [
        ("Public Holiday / Festival\n(e.g. Diwali, Dasara)", "True", "True", "College closed. Classes lost. Automated search finds vacant periods for make-up lectures."),
        ("Internal Assessment / Exams\n(e.g. MSE, IA, ESE)", "False", "True", "College open. Regular lectures suppressed on those dates. NO make-up classes generated."),
        ("Normal Teaching Day", "False", "False", "College open. Standard weekly timetable runs normally."),
        ("Special Working Saturday", "False", "False\n(override=True)", "Weekend override. Provides additional teaching capacity for makeup lectures.")
    ]
    for cat, ic, sl, beh in ev_rows:
        rc = t2.add_row().cells
        rc[0].text = cat
        rc[1].text = ic
        rc[2].text = sl
        rc[3].text = beh
        for i, cell in enumerate(rc):
            set_cell_background(cell, "FEFCE8" if "Internal Assessment" in cat else ("FEF2F2" if "Public Holiday" in cat else "F0FDF4"))
            set_cell_margins(cell, 80, 80, 100, 100)
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    doc.add_paragraph(
        "Step 3.2: What solver.py Generates and Where It Goes", style='Heading 2'
    )
    doc.add_paragraph(
        "solver.py is the Combinatorial Constraint Solver. It accepts global teacher preferences, classroom capacities, "
        "lab consecutive slot requirements, and max daily teaching limits. It executes CP-SAT to output a conflict-free, 1-week master template. "
        "This data is persisted in the PostgreSQL table 'timetable' with fields: class_id, subject_id, teacher_id, room_id, and slot_id. "
        "It takes less than 2 seconds to generate."
    )

    doc.add_paragraph(
        "Step 3.3: How semester_solver.py and semester_optimize.py Process the Data", style='Heading 2'
    )
    doc.add_paragraph(
        "The semester orchestrator takes the template from 'timetable' and executes a 3-step date expansion across the 18 weeks:"
    )
    doc.add_paragraph(
        "1. Calendar Projection: Every date in the term is paired with its corresponding weekday template row.",
        style='List Number'
    )
    doc.add_paragraph(
        "2. Assessment Day Interception: If a date has suppresses_lectures = True (e.g., Nov 16-21 for IA), "
        "regular lectures are cancelled with the outcome note 'Suppressed due to Internal Assessment (No lectures scheduled)'. "
        "They are not flagged as missed curriculum, so no make-up lectures are required.",
        style='List Number'
    )
    doc.add_paragraph(
        "3. Holiday Make-Up Rescheduling: For actual holidays (is_closure = True), the engine searches for vacant slots:"
        "\n   • Priority 1 (Admin Preference): If the HOD specified a preferred replacement date/period, the engine validates that slot."
        "\n   • Priority 2 (Autonomous 35-Day Search): If unspecified, the solver searches nearby weeks for a vacant period where teacher, class, and room are free, daily teacher workload is within limits, and the candidate date is neither an exam day nor a holiday.",
        style='List Number'
    )

    # Section 4: Sir's FAQ / Defense Points
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    r_h4 = h4.add_run("4. Key Takeaways & Defense Points for Presentation")
    r_h4.font.size = Pt(15)
    r_h4.font.bold = True
    r_h4.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    faqs = [
        ("Why not use a single solver for the whole semester?", 
         "A single solver trying to schedule 18 weeks at once has an astronomical search space (over 10^12 variables) and would take hours to solve or time out. Decoupling the weekly master template (solver.py) from date-aware calendar expansion (semester_solver.py) gives instantaneous master solving (<2s) and instant date adjustments (<1s)."),
        ("Where is the data stored?", 
         "The weekly template lives in the 'timetable' table. The full dated semester timetable lives in 'scheduled_session', grouped under version-controlled records in 'timetable_version' with an auditable draft/publish workflow."),
        ("Why was suppresses_lectures introduced instead of using is_closure?", 
         "is_closure represents an institution shutdown, which triggers automatic makeup compensation. Exams and Internal Assessments are normal college working days where lectures are intentionally suppressed. The new flag cleanly separates the two concepts with zero side-effects."),
        ("How does the UI represent this?", 
         "The Weekly Timetable Grid shows red banners for 'Holiday - No Classes', amber badges for 'Exam / IA - No Lectures', and gold badges for '⚡ Makeup' classes.")
    ]

    for q, a in faqs:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(6)
        p_q.paragraph_format.space_after = Pt(2)
        r_q = p_q.add_run("Q: " + q)
        r_q.bold = True
        r_q.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        
        p_a = doc.add_paragraph(a)
        p_a.paragraph_format.space_after = Pt(6)

    # Save
    doc.save(output_path)
    print("Successfully generated Word document at:", output_path)

if __name__ == "__main__":
    out_dir = r"c:\Users\Chinmayee\Desktop\TIMETABLE-PRO-llm\timetable-generator"
    out_file = os.path.join(out_dir, "TimetablePro_Architecture_and_Workflow.docx")
    create_document(out_file)
