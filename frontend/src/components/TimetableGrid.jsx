import { useState, useEffect } from 'react'
import axios from 'axios'
import SubjectTypeBadge from './SubjectTypeBadge'

const BASE = 'http://localhost:8000'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

/* ── Per-subject cell colour palette ── */
const COLORS = [
  { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8' },
  { bg: '#F0FDF4', border: '#16A34A', text: '#15803D' },
  { bg: '#FEF3C7', border: '#D97706', text: '#B45309' },
  { bg: '#FDF4FF', border: '#9333EA', text: '#7E22CE' },
  { bg: '#FFF1F2', border: '#E11D48', text: '#BE123C' },
  { bg: '#F0FDFA', border: '#0D9488', text: '#0F766E' },
  { bg: '#FFF7ED', border: '#EA580C', text: '#C2410C' },
  { bg: '#EEF2FF', border: '#4F46E5', text: '#4338CA' },
]

function Icon({ name, size = 20, stroke = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    grid: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    user: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
      </>
    ),
    door: (
      <>
        <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h9A1.5 1.5 0 0 1 17 4.5V21" />
        <path d="M3 21h18" />
        <path d="M13.5 12h.01" />
      </>
    ),
    school: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V5.5L12 2l7 3.5V21" />
        <path d="M9 21v-5h6v5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4.5 19.5h15" />
      </>
    ),
    printer: (
      <>
        <path d="M6.5 9V3.5h11V9" />
        <rect x="4" y="9" width="16" height="8" rx="1.5" />
        <path d="M6.5 15h11v6h-11z" />
      </>
    ),
    layers: (
      <>
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </>
    ),
    calendarOff: (
      <>
        <path d="M3.5 5h13" />
        <path d="M3.5 5v13.5A2.5 2.5 0 0 0 6 21h9" />
        <path d="M16.5 3.5v3" />
        <path d="M8 3.5v3" />
        <path d="m16 16 5 5" />
        <path d="m21 16-5 5" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function TimetableGrid() {
  const [timetable, setTimetable] = useState([])
  const [teachers, setTeachers] = useState({})
  const [subjects, setSubjects] = useState({})
  const [rooms, setRooms] = useState({})
  const [classes, setClasses] = useState({})
  const [subjectColors, setSubjectColors] = useState({})
  const [allClasses, setAllClasses] = useState([])
  const [allTeachers, setAllTeachers] = useState([])
  const [allRooms, setAllRooms] = useState([])
  const [slots, setSlots] = useState([])
  const [view, setView] = useState('class')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subjectsList, setSubjectsList] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const [ttRes, tRes, sRes, rRes, cRes, slRes] = await Promise.all([
        axios.get(`${BASE}/timetable`),
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/subjects`),
        axios.get(`${BASE}/rooms`),
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/timeslots`),
      ])
      const teacherMap = {}; tRes.data.forEach(t => { teacherMap[t.teacher_id] = t.teacher_name })
      const subjectMap = {}; sRes.data.forEach(s => { subjectMap[s.subject_id] = s.subject_name })
      setSubjectsList(sRes.data)
      const roomMap = {}; rRes.data.forEach(r => { roomMap[r.room_id] = r.room_number })
      const classMap = {}; cRes.data.forEach(c => { classMap[c.class_id] = c.class_name })
      const colors = {}; sRes.data.forEach((s, i) => { colors[s.subject_id] = COLORS[i % COLORS.length] })

      setTimetable(ttRes.data); setTeachers(teacherMap); setSubjects(subjectMap)
      setRooms(roomMap); setClasses(classMap); setSubjectColors(colors)
      setAllClasses(cRes.data); setAllTeachers(tRes.data); setAllRooms(rRes.data)
      setSlots(slRes.data)
      if (cRes.data.length > 0) setSelected(cRes.data[0].class_id)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const getSlotId = (day, period) => {
    const s = slots.find(s => s.day === day && s.period_number === period)
    return s ? s.slot_id : null
  }

  const getCell = (fKey, fVal, day, period) => {
    const slotId = getSlotId(day, period)
    if (!slotId) return null
    return timetable.find(t => t[fKey] === fVal && t.slot_id === slotId) || null
  }

  const switchView = (v) => {
    setView(v)
    if (v === 'class' && allClasses.length > 0) setSelected(allClasses[0].class_id)
    if (v === 'teacher' && allTeachers.length > 0) setSelected(allTeachers[0].teacher_id)
    if (v === 'room' && allRooms.length > 0) setSelected(allRooms[0].room_id)
  }

  const filterOptions = () => {
    if (view === 'class') return allClasses.map(c => ({ id: c.class_id, label: c.class_name }))
    if (view === 'teacher') return allTeachers.map(t => ({ id: t.teacher_id, label: t.teacher_name }))
    if (view === 'room') return allRooms.map(r => ({ id: r.room_id, label: r.room_number }))
    return []
  }

  const getSelectedLabel = () => {
    if (view === 'class') return classes[selected] || ''
    if (view === 'teacher') return teachers[selected] || ''
    if (view === 'room') return rooms[selected] || ''
    return ''
  }

  const filterKey = view === 'class' ? 'class_id' : view === 'teacher' ? 'teacher_id' : 'room_id'
  const activeDays = DAYS.filter(day => slots.some(s => s.day === day))
  const activePeriods = PERIODS.filter(p => slots.some(s => s.period_number === p))
  const visibleSubjectIds = new Set(
    timetable
      .filter(t => t[filterKey] === selected)
      .map(t => t.subject_id)
  )
  const visibleSubjects = subjectsList.filter(s => visibleSubjectIds.has(s.subject_id))

  function handleExport() {
    const styleId = 'print-style'
    let style = document.getElementById(styleId)
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style) }
    style.innerHTML = `@media print {
      body * { visibility: hidden; }
      #print-area, #print-area * { visibility: visible; }
      #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
      .no-print { display: none !important; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10px; }
      th { background: #f5f5f5; font-weight: 700; }
    }`
    window.print()
  }

  function handleExportAll() {
    const styleId = 'print-style-all'
    let style = document.getElementById(styleId)
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style) }
    style.innerHTML = `@media print {
      body * { visibility: hidden; }
      #print-all-area, #print-all-area * { visibility: visible; }
      #print-all-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
      .no-print { display: none !important; }
      .print-section { page-break-after: always; padding: 16px 0; }
      .print-section:last-child { page-break-after: avoid; }
      table { border-collapse: collapse; width: 100%; margin-top: 8px; }
      th, td { border: 1px solid #ddd; padding: 5px 7px; font-size: 10px; }
      th { background: #f5f5f5; font-weight: 700; text-align: center; }
      .print-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
      .print-sub { font-size: 11px; color: #666; margin-bottom: 8px; }
    }`
    window.print()
  }

  const renderGrid = (fKey, fVal, showTeacher, showClass, showRoom) => (
    <table className="tt-table">

      {/* HEADER → PERIODS AS COLUMNS */}
      <thead>
        <tr>
          <th className="tt-th tt-th-day">Day</th>
          {activePeriods.map(period => (
            <th key={period} className="tt-th">P{period}</th>
          ))}
        </tr>
      </thead>

      {/* BODY → DAYS AS ROWS */}
      <tbody>
        {activeDays.map((day, di) => (
          <tr key={day}>

            {/* DAY LABEL */}
            <td className="tt-day-cell">{day}</td>

            {/* PERIOD CELLS */}
            {activePeriods.map((period, pi) => {
              const entry = getCell(fKey, fVal, day, period)
              const color = entry
                ? (subjectColors[entry.subject_id] || COLORS[0])
                : null

              return (
                <td key={period} className="tt-td">
                  {entry ? (
                    <div
                      className="tt-entry"
                      style={{
                        background: color.bg,
                        borderLeftColor: color.border,
                        animationDelay: `${(di * activePeriods.length + pi) * 18}ms`,
                      }}
                    >
                      <SubjectTypeBadge
                        name={subjects[entry.subject_id] || `S${entry.subject_id}`}
                        type={subjectsList.find(s => s.subject_id === entry.subject_id)?.subject_type}
                      />
                      {showTeacher && (
                        <div className="tt-meta">
                          <Icon name="user" size={11} />
                          {teachers[entry.teacher_id] || `T${entry.teacher_id}`}
                        </div>
                      )}
                      {showClass && (
                        <div className="tt-meta">
                          <Icon name="school" size={11} />
                          {classes[entry.class_id] || `C${entry.class_id}`}
                        </div>
                      )}
                      {showRoom && (
                        <div className="tt-meta">
                          <Icon name="door" size={11} />
                          {rooms[entry.room_id] || `R${entry.room_id}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="tt-empty-cell">—</div>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  if (loading) return (
    <div className="timetable-page">
      <div className="loading-state">
        <span className="loading-spinner" />
        Loading timetable...
      </div>
      <style>{loadingStyles}</style>
    </div>
  )

  if (timetable.length === 0) return (
    <div className="timetable-page">
      <div className="empty-state empty-state-standalone">
        <div className="empty-icon">
          <Icon name="calendarOff" size={27} />
        </div>
        <h3>No timetable generated yet</h3>
        <p>Go to the Generate page and run the solver first.</p>
      </div>
      <style>{loadingStyles}</style>
    </div>
  )

  return (
    <div className="timetable-page">

      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="timetable-hero">

        <div className="timetable-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <rect x="70" y="40" width="480" height="140" rx="12" stroke="currentColor" strokeWidth="2" />
            <path d="M70 85h480" stroke="currentColor" strokeWidth="2" />
            <path d="M190 40v140" stroke="currentColor" strokeWidth="2" />
            <path d="M310 40v140" stroke="currentColor" strokeWidth="2" />
            <path d="M430 40v140" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="hero-left">
          <div className="hero-icon">
            <Icon name="grid" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">ACADEMIC SCHEDULING</div>
            <h1>Timetable</h1>
            <div className="hero-subtitle">Generated Schedule</div>
            <p>Browse the generated schedule by class, teacher, or room.</p>
          </div>
        </div>

        <div className="hero-actions no-print">
          <button type="button" className="secondary-action" onClick={handleExport}>
            <Icon name="download" size={16} />
            Export current view
          </button>
          <button type="button" className="primary-button" onClick={handleExportAll}>
            <Icon name="printer" size={16} />
            Export all views
          </button>
        </div>

      </section>


      {/* =========================================================
          STAT CHIPS
      ========================================================= */}

      <section className="timetable-chip-row">
        <div className="tt-chip">
          <Icon name="layers" size={16} />
          <span>Slots assigned</span>
          <strong>{timetable.length}</strong>
        </div>
        <div className="tt-chip">
          <Icon name="school" size={16} />
          <span>Classes</span>
          <strong>{allClasses.length}</strong>
        </div>
        <div className="tt-chip">
          <Icon name="user" size={16} />
          <span>Teachers</span>
          <strong>{allTeachers.length}</strong>
        </div>
        <div className="tt-chip">
          <Icon name="door" size={16} />
          <span>Rooms</span>
          <strong>{allRooms.length}</strong>
        </div>
      </section>


      {/* =========================================================
          GRID CARD
      ========================================================= */}

      <section className="directory-card">

        <div className="directory-header">
          <div className="directory-title-block">
            <div className="directory-eyebrow">SCHEDULE VIEW</div>

            <div className="directory-title-row">
              <div className="directory-main-icon">
                <Icon name="grid" size={22} />
              </div>

              <div>
                <h2>{getSelectedLabel() || 'Select a view'}</h2>
                <p>
                  {view === 'class'
                    ? `Class-wise timetable for ${getSelectedLabel()}`
                    : view === 'teacher'
                    ? `Teacher-wise timetable for ${getSelectedLabel()}`
                    : `Room-wise timetable for ${getSelectedLabel()}`}
                </p>
              </div>
            </div>
          </div>

          <div className="view-tabs no-print">
            {[
              { key: 'class', label: 'Class-wise', icon: 'grid' },
              { key: 'teacher', label: 'Teacher-wise', icon: 'user' },
              { key: 'room', label: 'Room-wise', icon: 'door' },
            ].map(v => (
              <button
                key={v.key}
                type="button"
                className={`view-tab ${view === v.key ? 'active' : ''}`}
                onClick={() => switchView(v.key)}
              >
                <Icon name={v.icon} size={14} />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-chip-row no-print">
          {filterOptions().map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`filter-chip ${selected === opt.id ? 'active' : ''}`}
              onClick={() => setSelected(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {selected && (
          <div id="print-area" className="tt-grid-wrapper" key={`${view}-${selected}`}>
            <div style={{ display: 'none' }} className="print-title">
              {view === 'class' ? 'Class' : view === 'teacher' ? 'Teacher' : 'Room'}: {getSelectedLabel()}
            </div>
            <div className="tt-table-scroll">
              {renderGrid(filterKey, selected, view !== 'teacher', view !== 'class', view !== 'room')}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="tt-legend no-print">
          <span className="tt-legend-label">
            {view === 'class'
              ? `Subjects in ${getSelectedLabel()}`
              : view === 'teacher'
              ? `Subjects for ${getSelectedLabel()}`
              : `Subjects in ${getSelectedLabel()}`}
          </span>

          {visibleSubjects.map((s, i) => {
            const color = subjectColors[s.subject_id] || COLORS[0]
            return (
              <div
                key={s.subject_id}
                className="tt-legend-chip"
                style={{
                  background: color.bg,
                  borderColor: color.border,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span className="tt-legend-dot" style={{ background: color.border }} />
                <SubjectTypeBadge name={s.subject_name} type={s.subject_type} showName={false} />
                <span className="tt-legend-name">{s.subject_name}</span>
              </div>
            )
          })}
        </div>

      </section>


      {/* Hidden print-all block — unchanged structure */}
      <div id="print-all-area" style={{ display: 'none' }}>
        {allClasses.map(c => (
          <div key={c.class_id} className="print-section">
            <div className="print-title">Class: {c.class_name}</div>
            <div className="print-sub">Class-wise timetable</div>
            {renderGrid('class_id', c.class_id, true, false, true)}
          </div>
        ))}
        {allTeachers.map(t => (
          <div key={t.teacher_id} className="print-section">
            <div className="print-title">Teacher: {t.teacher_name}</div>
            <div className="print-sub">Teacher-wise timetable</div>
            {renderGrid('teacher_id', t.teacher_id, false, true, true)}
          </div>
        ))}
        {allRooms.map(r => (
          <div key={r.room_id} className="print-section">
            <div className="print-title">Room: {r.room_number}</div>
            <div className="print-sub">Room-wise timetable</div>
            {renderGrid('room_id', r.room_id, true, true, false)}
          </div>
        ))}
      </div>

      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .timetable-page {
          width: 100%;
          min-height: 100%;
          box-sizing: border-box;
          padding: 8px 4px 48px;
          color: #13203a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        /* =========================
           HERO
        ========================= */

        .timetable-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          min-height: 150px;
          padding: 26px 30px;
          margin-bottom: 18px;
          border: 1px solid #dfe7f4;
          border-radius: 24px;
          background: linear-gradient(135deg, #ffffff 0%, #f8faff 58%, #f2f5ff 100%);
          box-shadow: 0 12px 36px rgba(28, 52, 96, 0.06);
        }

        .hero-left {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border: 1px solid #cbdcff;
          border-radius: 18px;
          background: linear-gradient(145deg, #eff5ff, #e0eaff);
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
          animation: iconFloat 3.2s ease-in-out infinite;
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #3564bb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .timetable-hero h1 {
          margin: 0;
          color: #101b35;
          font-size: 30px;
          line-height: 1.08;
          letter-spacing: -0.035em;
          font-weight: 800;
        }

        .hero-subtitle {
          margin-top: 6px;
          color: #4a5d84;
          font-size: 15px;
          line-height: 1.3;
          font-weight: 650;
        }

        .timetable-hero p {
          margin: 6px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 420px;
        }

        .timetable-watermark {
          position: absolute;
          z-index: 1;
          right: 40px;
          bottom: -22px;
          width: min(40%, 520px);
          color: #8fa8e7;
          opacity: 0.1;
          pointer-events: none;
        }

        .timetable-watermark svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .hero-actions {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #245de8;
          border-radius: 10px;
          background: linear-gradient(135deg, #326bf0, #2458db);
          color: white;
          font-size: 12.5px;
          font-weight: 750;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(37, 99, 235, 0.18);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        }

        .primary-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .secondary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 1px solid #c9d9ff;
          border-radius: 10px;
          background: #f4f7ff;
          color: #245dd6;
          font-size: 12.5px;
          font-weight: 750;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .secondary-action:hover {
          background: #eaf1ff;
          transform: translateY(-1px);
        }

        /* =========================
           STAT CHIPS
        ========================= */

        .timetable-chip-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .tt-chip {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 13px;
          border: 1px solid #e2e8f0;
          background: white;
          box-shadow: 0 6px 18px rgba(30, 48, 87, 0.04);
          color: #2563eb;
          animation: chipIn 0.4s ease both;
        }

        .tt-chip:nth-child(2) { animation-delay: 60ms; }
        .tt-chip:nth-child(3) { animation-delay: 120ms; }
        .tt-chip:nth-child(4) { animation-delay: 180ms; }

        @keyframes chipIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tt-chip span {
          color: #94a3b8;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .tt-chip strong {
          color: #1f2c48;
          font-size: 18px;
          font-weight: 800;
        }

        /* =========================
           DIRECTORY CARD
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px rgba(28, 48, 90, 0.055);
        }

        .directory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px;
          flex-wrap: wrap;
          border-bottom: 1px solid #e7ecf3;
        }

        .directory-eyebrow {
          margin-bottom: 7px;
          color: #7483a0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .directory-title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .directory-main-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 14px;
          background: #edf3ff;
        }

        .directory-title-row h2 {
          margin: 0;
          color: #15213d;
          font-size: 19px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .directory-title-row p {
          margin: 3px 0 0;
          color: #71809d;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .view-tabs {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          border-radius: 11px;
          background: #f1f5f9;
        }

        .view-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #64748b;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-tab:hover {
          color: #334155;
        }

        .view-tab.active {
          background: white;
          color: #1d4ed8;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
        }

        .filter-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 16px 24px;
          border-bottom: 1px solid #eef1f6;
        }

        .filter-chip {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1.5px solid #cbd5e1;
          background: white;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.13s ease;
        }

        .filter-chip:hover {
          border-color: #93c5fd;
          background: #f6f9ff;
        }

        .filter-chip.active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
        }

        /* =========================
           GRID / TABLE
        ========================= */

        .tt-grid-wrapper {
          padding: 18px 24px 8px;
          animation: gridFadeIn 0.28s ease both;
        }

        @keyframes gridFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tt-table-scroll {
          overflow-x: auto;
          border: 1px solid #e5eaf3;
          border-radius: 14px;
        }

        .tt-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .tt-th {
          padding: 11px 12px;
          font-size: 10px;
          font-weight: 800;
          color: #62718d;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          text-align: center;
          border: 1px solid #eef1f6;
          background: #f8faff;
          white-space: nowrap;
        }

        .tt-th-day {
          width: 100px;
        }

        .tt-day-cell {
          padding: 11px 12px;
          font-size: 11.5px;
          font-weight: 800;
          color: #55617a;
          text-align: center;
          border: 1px solid #eef1f6;
          background: #f8faff;
          white-space: nowrap;
        }

        .tt-td {
          padding: 4px;
          border: 1px solid #eef1f6;
          vertical-align: top;
          background: white;
        }

        .tt-entry {
          border-left: 3px solid;
          border-radius: 9px;
          padding: 8px 9px;
          min-height: 52px;
          box-sizing: border-box;
          animation: entryIn 0.32s ease both;
          transition: transform 0.14s ease, box-shadow 0.14s ease;
        }

        .tt-entry:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.09);
        }

        @keyframes entryIn {
          from { opacity: 0; transform: translateY(5px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .tt-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          color: #55617a;
          font-size: 10px;
          font-weight: 600;
        }

        .tt-empty-cell {
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          font-size: 15px;
        }

        /* =========================
           LEGEND
        ========================= */

        .tt-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 16px 24px 22px;
        }

        .tt-legend-label {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          margin-right: 4px;
        }

        .tt-legend-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid;
          border-radius: 999px;
          padding: 5px 12px;
          animation: chipIn 0.32s ease both;
        }

        .tt-legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tt-legend-name {
          font-size: 11px;
          font-weight: 700;
          color: #1f2c48;
        }

        /* =========================
           LOADING / EMPTY STATE
        ========================= */

        .empty-state {
          margin: 14px;
          padding: 60px 25px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfcff, #f8faff);
          text-align: center;
        }

        .empty-state-standalone {
          margin: 40px auto;
          max-width: 480px;
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          color: #2563eb;
          border-radius: 17px;
          background: #edf3ff;
        }

        .empty-state h3 {
          margin: 0;
          color: #1a2742;
          font-size: 16px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 380px;
          margin: 7px auto 0;
          color: #7c899f;
          font-size: 12.5px;
          line-height: 1.5;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 900px) {
          .timetable-chip-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .timetable-hero {
            padding: 22px;
          }

          .timetable-hero h1 {
            font-size: 26px;
          }

          .timetable-watermark {
            display: none;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero-actions {
            width: 100%;
          }

          .hero-actions button {
            flex: 1;
          }
        }

        @media print {
          .timetable-hero,
          .timetable-chip-row {
            display: none !important;
          }
        }

      `}</style>

    </div>
  )
}

const loadingStyles = `
  .timetable-page { width: 100%; box-sizing: border-box; padding: 8px 4px 48px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  .loading-state {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 80px 24px; color: #7c899f; font-size: 13px; font-weight: 600;
  }
  .loading-spinner {
    width: 20px; height: 20px; border: 3px solid #dbeafe; border-top-color: #2563eb;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-state {
    margin: 40px auto; max-width: 480px; padding: 60px 25px;
    border: 1px dashed #cad5e5; border-radius: 14px;
    background: linear-gradient(180deg, #fbfcff, #f8faff); text-align: center;
  }
  .empty-icon {
    width: 58px; height: 58px; display: flex; align-items: center; justify-content: center;
    margin: 0 auto 14px; color: #2563eb; border-radius: 17px; background: #edf3ff;
  }
  .empty-state h3 { margin: 0; color: #1a2742; font-size: 16px; font-weight: 800; }
  .empty-state p { max-width: 380px; margin: 7px auto 0; color: #7c899f; font-size: 12.5px; line-height: 1.5; }
`