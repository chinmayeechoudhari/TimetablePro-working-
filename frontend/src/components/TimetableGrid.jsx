import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import SubjectTypeBadge from './SubjectTypeBadge'

import { API_BASE } from '../lib/config'
const BASE = API_BASE
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
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
  }

  return <svg {...common}>{paths[name]}</svg>
}

// ── Parse a class name like "AIDS 2nd Year - B" into { dept, year, division }
function parseClassName(name) {
  // Match: <DEPT words> <N><st|nd|rd|th> Year - <DIV>
  const m = name.match(/^(.+?)\s+(\d+)(?:st|nd|rd|th)\s+Year\s+-\s+(\S+)$/i)
  if (m) return { dept: m[1].trim(), year: parseInt(m[2], 10), division: m[3].trim() }
  // Fallback – treat entire name as dept, year 1, div A
  return { dept: name, year: 1, division: 'A' }
}

function yearLabel(n) {
  const sfx = ['', 'st', 'nd', 'rd']
  return `${n}${sfx[n] || 'th'} Year`
}

function getSemesterWeeks(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return []
  const start = new Date(startDateStr + 'T12:00:00')
  const end = new Date(endDateStr + 'T12:00:00')
  const curr = new Date(start)
  const dayOfWeek = (curr.getDay() + 6) % 7 // Monday = 0
  curr.setDate(curr.getDate() - dayOfWeek)

  const weeks = []
  let weekIndex = 1
  while (curr <= end) {
    const monday = new Date(curr)
    const sunday = new Date(curr)
    sunday.setDate(sunday.getDate() + 6)
    weeks.push({
      index: weekIndex,
      monday,
      sunday,
      label: `Week ${weekIndex} (${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`,
      mondayKey: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`,
    })
    curr.setDate(curr.getDate() + 7)
    weekIndex++
  }
  return weeks
}

export default function TimetableGrid() {
  const [timetable, setTimetable] = useState([])
  const [legacyTimetable, setLegacyTimetable] = useState([])
  const [semesterVersion, setSemesterVersion] = useState(null)
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
  const [calendarEvents, setCalendarEvents] = useState([])
  const [terms, setTerms] = useState([])
  const [activeTerm, setActiveTerm] = useState(null)
  const [today] = useState(() => new Date())
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [publishNotice, setPublishNotice] = useState(null)

  // Hierarchical drill-down state for class view
  const [selDept, setSelDept] = useState(null)
  const [selYear, setSelYear] = useState(null)

  const semesterWeeks = useMemo(() => {
    return getSemesterWeeks(activeTerm?.start_date, activeTerm?.end_date)
  }, [activeTerm?.start_date, activeTerm?.end_date])

  useEffect(() => {
    if (!semesterWeeks.length) {
      setSelectedWeekIdx(0)
      return
    }
    const todayMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7), 12)
    const todayMondayKey = `${todayMonday.getFullYear()}-${String(todayMonday.getMonth() + 1).padStart(2, '0')}-${String(todayMonday.getDate()).padStart(2, '0')}`
    const matchingIdx = semesterWeeks.findIndex(w => w.mondayKey === todayMondayKey)
    if (matchingIdx >= 0) {
      setSelectedWeekIdx(matchingIdx)
    } else {
      setSelectedWeekIdx(0)
    }
  }, [semesterWeeks, today])

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    let alive = true
    axios.get(`${BASE}/calendar/terms`).then(response => {
      if (!alive) return
      const rows = response.data || []
      setTerms(rows)
      setActiveTerm(rows.find(item => item.status === 'active') || null)
    }).catch(() => { if (alive) { setTerms([]); setActiveTerm(null); setCalendarEvents([]) } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    if (!activeTerm?.term_id) {
      setCalendarEvents([])
      setSemesterVersion(null)
      setTimetable(legacyTimetable)
      return () => { alive = false }
    }
    axios.get(`${BASE}/calendar/terms/${activeTerm.term_id}/events`)
      .then(response => { if (alive) setCalendarEvents((response.data || []).filter(item => item.approval_status === 'approved')) })
      .catch(() => { if (alive) setCalendarEvents([]) })

    // The semester CP-SAT version is the source of truth for the weekly view.
    // Use the newest saved version, including a draft created after approving
    // a closure, so the admin can review the same canonical schedule before
    // publishing it. Fall back to the legacy weekly template only when no
    // semester version exists for this term.
    axios.get(`${BASE}/semester/terms/${activeTerm.term_id}/versions`)
      .then(response => {
        if (!alive) return
        const versions = response.data || []
        const chosen = versions[0] || null
        if (chosen) {
          setSemesterVersion(chosen)
          setTimetable((chosen.sessions || []).map(session => ({
            ...session,
            session_date: session.date || session.session_date,
          })))
        } else {
          setSemesterVersion(null)
          setTimetable(legacyTimetable)
        }
      })
      .catch(err => {
        console.error('Unable to load semester timetable version:', err)
        if (alive) {
          setSemesterVersion(null)
          setTimetable(legacyTimetable)
        }
      })
    return () => { alive = false }
  }, [activeTerm?.term_id, legacyTimetable])

  async function handlePublishVersion() {
    if (!semesterVersion?.version_id) return
    setPublishing(true)
    setPublishNotice(null)
    try {
      const res = await axios.post(`${BASE}/semester/versions/${semesterVersion.version_id}/publish`)
      setSemesterVersion(res.data)
      setPublishNotice(`Version ${res.data.version_number} is now officially published!`)
      setTimeout(() => setPublishNotice(null), 5000)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (detail?.message || err?.message || 'Could not publish draft.')
      alert(`Publishing failed: ${msg}`)
    } finally {
      setPublishing(false)
    }
  }

  async function handleDiscardDraft() {
    if (!semesterVersion?.version_id) return
    const confirmed = window.confirm(`Discard Draft Version ${semesterVersion.version_number}? The previously published schedule will remain active.`)
    if (!confirmed) return
    setPublishing(true)
    try {
      await axios.delete(`${BASE}/semester/versions/${semesterVersion.version_id}`)
      // Reload versions to switch back to the published version
      const versionsRes = await axios.get(`${BASE}/semester/terms/${activeTerm.term_id}/versions`)
      const versions = versionsRes.data || []
      const chosen = versions[0] || null
      if (chosen) {
        setSemesterVersion(chosen)
        setTimetable((chosen.sessions || []).map(session => ({
          ...session,
          session_date: session.date || session.session_date,
        })))
      } else {
        setSemesterVersion(null)
        setTimetable(legacyTimetable)
      }
      setPublishNotice(`Draft v${semesterVersion.version_number} was discarded.`)
      setTimeout(() => setPublishNotice(null), 4000)
    } catch (err) {
      const detail = err?.response?.data?.detail
      alert(`Could not discard draft: ${detail || err?.message}`)
    } finally {
      setPublishing(false)
    }
  }

  async function fetchAll() {
    try {
      const [ttRes, tRes, sRes, rRes, cRes, slRes, structRes] = await Promise.all([
        axios.get(`${BASE}/timetable`),
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/subjects`),
        axios.get(`${BASE}/rooms`),
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/timeslots`),
        axios.get(`${BASE}/academic-structure`).catch(() => ({ data: { groups: [] } })),
      ])
      const teacherMap = {}; tRes.data.forEach(t => { teacherMap[t.teacher_id] = t.teacher_name })
      const subjectMap = {}; sRes.data.forEach(s => { subjectMap[s.subject_id] = s.subject_name })
      setSubjectsList(sRes.data)
      const roomMap = {}; rRes.data.forEach(r => { roomMap[r.room_id] = r.room_number })
      const classMap = {}; cRes.data.forEach(c => { classMap[c.class_id] = c.class_name })
      const colors = {}; sRes.data.forEach((s, i) => { colors[s.subject_id] = COLORS[i % COLORS.length] })

      // Filter classes to only those belonging to active Academic Structure departments
      const rawClasses = cRes.data || []
      const groups = structRes.data?.groups || []
      let validClasses = rawClasses
      if (groups.length > 0) {
        const activeClassIds = new Set(groups.flatMap(g => (g.divisions || []).map(d => d.class_id).filter(Boolean)))
        if (activeClassIds.size > 0) {
          validClasses = rawClasses.filter(c => activeClassIds.has(c.class_id))
        }
      }

      setLegacyTimetable(ttRes.data); setTimetable(ttRes.data); setTeachers(teacherMap); setSubjects(subjectMap)
      setRooms(roomMap); setClasses(classMap); setSubjectColors(colors)
      setAllClasses(validClasses); setAllTeachers(tRes.data); setAllRooms(rRes.data)
      setSlots(slRes.data)

      if (validClasses.length > 0) {
        const first = validClasses[0]
        const parsed = parseClassName(first.class_name)
        setSelDept(parsed.dept)
        setSelYear(parsed.year)
        setSelected(first.class_id)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // Derived hierarchical data
  const parsedClasses = allClasses.map(c => ({ ...c, ...parseClassName(c.class_name) }))
  const depts = [...new Set(parsedClasses.map(c => c.dept))].sort()
  const yearsInDept = selDept
    ? [...new Set(parsedClasses.filter(c => c.dept === selDept).map(c => c.year))].sort((a, b) => a - b)
    : []
  const divsInYear = (selDept && selYear != null)
    ? parsedClasses.filter(c => c.dept === selDept && c.year === selYear)
    : []

  const handleDeptSelect = (dept) => {
    setSelDept(dept)
    const years = [...new Set(parsedClasses.filter(c => c.dept === dept).map(c => c.year))].sort((a, b) => a - b)
    const firstYear = years[0]
    setSelYear(firstYear)
    const firstDiv = parsedClasses.find(c => c.dept === dept && c.year === firstYear)
    if (firstDiv) setSelected(firstDiv.class_id)
  }

  const handleYearSelect = (year) => {
    setSelYear(year)
    const firstDiv = parsedClasses.find(c => c.dept === selDept && c.year === year)
    if (firstDiv) setSelected(firstDiv.class_id)
  }

  const handleDivSelect = (classId) => {
    setSelected(classId)
  }

  const getSlotId = (day, period) => {
    const s = slots.find(s => s.day === day && s.period_number === period)
    return s ? s.slot_id : null
  }

  const getCell = (fKey, fVal, day, period) => {
    const slotId = getSlotId(day, period)
    if (!slotId) return null
    const targetDate = dateKey(dateForWeekday(day))
    return timetable.find(t =>
      t[fKey] === fVal &&
      (semesterVersion
        ? (t.session_date === targetDate && t.period_number === period)
        : t.slot_id === slotId)
    ) || null
  }

  const switchView = (v) => {
    setView(v)
    if (v === 'class' && allClasses.length > 0) {
      const first = allClasses[0]
      const parsed = parseClassName(first.class_name)
      setSelDept(parsed.dept)
      setSelYear(parsed.year)
      setSelected(first.class_id)
    }
    if (v === 'teacher' && allTeachers.length > 0) setSelected(allTeachers[0].teacher_id)
    if (v === 'room' && allRooms.length > 0) setSelected(allRooms[0].room_id)
  }

  const filterOptions = () => {
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
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const currentWeek = semesterWeeks[selectedWeekIdx] || null
  const mondayThisWeek = currentWeek
    ? currentWeek.monday
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7), 12)

  const todayWeekIdx = useMemo(() => {
    const todayMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7), 12)
    const todayMondayKey = `${todayMonday.getFullYear()}-${String(todayMonday.getMonth() + 1).padStart(2, '0')}-${String(todayMonday.getDate()).padStart(2, '0')}`
    return semesterWeeks.findIndex(w => w.mondayKey === todayMondayKey)
  }, [semesterWeeks, today])

  const dateForWeekday = (weekday) => {
    const date = new Date(mondayThisWeek)
    date.setDate(date.getDate() + DAYS.indexOf(weekday))
    return date
  }
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const eventsForDate = (date) => calendarEvents.filter(event => event.start_date <= dateKey(date) && event.end_date >= dateKey(date))
  const dayCalendarState = (date) => {
    const events = eventsForDate(date)
    const workingOverride = events.some(event => event.is_working_day_override === true)
    return { events, workingOverride, closures: workingOverride ? [] : events.filter(event => event.is_closure) }
  }

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
            <td className="tt-day-cell" style={dateKey(dateForWeekday(day)) === todayKey ? { background: '#dbeafe', color: '#1d4ed8', fontWeight: 800 } : undefined}>
              <div>{day}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: dateKey(dateForWeekday(day)) === todayKey ? '#1d4ed8' : '#64748b' }}>
                {dateForWeekday(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {dateKey(dateForWeekday(day)) === todayKey ? ' · TODAY' : ''}
              </div>
              {dayCalendarState(dateForWeekday(day)).closures.map(event => <div key={event.event_id} title={event.title} style={{ fontSize: 9, marginTop: 4, padding: '3px 4px', borderRadius: 4, background: '#ffe4e6', color: '#9f1239' }}>{event.title} · NO CLASSES</div>)}
              {dayCalendarState(dateForWeekday(day)).workingOverride && <div style={{ fontSize: 9, marginTop: 4, padding: '3px 4px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>Approved working day</div>}
            </td>

            {/* PERIOD CELLS */}
            {activePeriods.map((period, pi) => {
              const closureEvents = dayCalendarState(dateForWeekday(day)).closures
              const entry = closureEvents.length ? null : getCell(fKey, fVal, day, period)
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
                      {(entry.original_session_id || entry.outcome_note || entry.is_makeup) && (
                        <div
                          style={{
                            fontSize: 9.5,
                            fontWeight: 750,
                            color: '#92400e',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: 4,
                            padding: '1px 5px',
                            marginTop: 3,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title={entry.outcome_note || 'Rescheduled makeup lecture'}
                        >
                          ⚡ Makeup
                        </div>
                      )}
                    </div>
                  ) : closureEvents.length ? (
                    <div className="tt-empty-cell" style={{ background: '#fff1f2', color: '#9f1239', fontSize: 11, fontWeight: 650, padding: 6, borderRadius: 6 }}>{closureEvents[0].title}</div>
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
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 650, color: '#1d4ed8' }}>
              Today: {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: '#64748b' }}>
              Showing dates for the current week{activeTerm ? ` · ${activeTerm.academic_year} ${activeTerm.term_name}` : ''}. Approved closures suppress class cards; approved working-day overrides take precedence.
              {semesterVersion && <span style={{ display: 'inline-block', marginLeft: 6, padding: '2px 7px', borderRadius: 999, background: semesterVersion.status === 'published' ? '#dcfce7' : '#fef3c7', color: semesterVersion.status === 'published' ? '#166534' : '#92400e', fontWeight: 800 }}>Semester v{semesterVersion.version_number} · {semesterVersion.status}</span>}
            </div>
          </div>
        </div>

        <div className="hero-actions no-print">
          {activeTerm && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
            Active semester: <strong>{activeTerm.academic_year} · {activeTerm.term_name}</strong>
          </div>}
          <button type="button" className="secondary-action" onClick={handleExport}>
            <Icon name="download" size={16} />
            Export current view
          </button>
          <button type="button" className="primary-button" onClick={handleExportAll}>
            <Icon name="printer" size={16} />
            Export all views
          </button>
          <button type="button" className="secondary-action" onClick={() => { window.location.href = '/calendar' }}>
            <Icon name="calendar" size={16} />
            Open academic calendar
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
          SEMESTER WEEK NAVIGATION TOOLBAR
      ========================================================= */}
      {semesterWeeks.length > 0 && (
        <section
          className="timetable-week-nav no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '12px 18px',
            marginBottom: 20,
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Semester Week
            </span>

            <button
              type="button"
              className="secondary-action"
              disabled={selectedWeekIdx <= 0}
              onClick={() => setSelectedWeekIdx(i => Math.max(0, i - 1))}
              style={{ padding: '6px 11px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5, opacity: selectedWeekIdx <= 0 ? 0.45 : 1, cursor: selectedWeekIdx <= 0 ? 'not-allowed' : 'pointer' }}
            >
              <Icon name="chevronLeft" size={14} />
              Prev
            </button>

            <select
              aria-label="Select semester week"
              value={selectedWeekIdx}
              onChange={e => setSelectedWeekIdx(Number(e.target.value))}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: 13,
                fontWeight: 650,
                cursor: 'pointer',
                minWidth: 240,
              }}
            >
              {semesterWeeks.map((w, idx) => (
                <option key={w.mondayKey} value={idx}>
                  {w.label} {todayWeekIdx === idx ? ' • (Current Week)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="secondary-action"
              disabled={selectedWeekIdx >= semesterWeeks.length - 1}
              onClick={() => setSelectedWeekIdx(i => Math.min(semesterWeeks.length - 1, i + 1))}
              style={{ padding: '6px 11px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5, opacity: selectedWeekIdx >= semesterWeeks.length - 1 ? 0.45 : 1, cursor: selectedWeekIdx >= semesterWeeks.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              Next
              <Icon name="chevronRight" size={14} />
            </button>

            {todayWeekIdx >= 0 && selectedWeekIdx !== todayWeekIdx && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => setSelectedWeekIdx(todayWeekIdx)}
                style={{ padding: '6px 12px', fontSize: 12, color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
              >
                Jump to Current Week
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {activeDays.some(day => dayCalendarState(dateForWeekday(day)).closures.length > 0) && (
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>●</span> Holiday / Closure in this week
              </span>
            )}

            {semesterVersion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 750,
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: semesterVersion.status === 'published' ? '#dcfce7' : '#fef3c7',
                    color: semesterVersion.status === 'published' ? '#166534' : '#92400e',
                    border: semesterVersion.status === 'published' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                  }}
                >
                  Version {semesterVersion.version_number} · {semesterVersion.status.toUpperCase()}
                </span>

                {semesterVersion.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={publishing}
                      onClick={handlePublishVersion}
                      style={{
                        padding: '4px 12px',
                        fontSize: 11.5,
                        fontWeight: 750,
                        minHeight: 28,
                        borderRadius: 6,
                        background: 'linear-gradient(135deg, #16a34a, #15803d)',
                        borderColor: '#15803d',
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                        cursor: publishing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {publishing ? 'Publishing…' : `Accept & Publish v${semesterVersion.version_number}`}
                    </button>

                    <button
                      type="button"
                      className="secondary-action"
                      disabled={publishing}
                      onClick={handleDiscardDraft}
                      style={{
                        padding: '4px 11px',
                        fontSize: 11.5,
                        fontWeight: 650,
                        minHeight: 28,
                        borderRadius: 6,
                        color: '#b91c1c',
                        borderColor: '#fca5a5',
                        background: '#fef2f2',
                        cursor: publishing ? 'not-allowed' : 'pointer',
                      }}
                      title="Discard this draft and revert to the published timetable"
                    >
                      Discard Draft
                    </button>
                  </>
                )}

                {publishNotice && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '3px 8px', borderRadius: 5 }}>
                    ✓ {publishNotice}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

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

        {/* ── Class hierarchical drill-down ── */}
        {view === 'class' && (
          <div className="class-drill-down no-print">

            {/* Level 1 – Departments */}
            <div className="drill-level">
              <span className="drill-level-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V5.5L12 2l7 3.5V21M9 21v-5h6v5"/></svg>
                Department
              </span>
              <div className="drill-chips">
                {depts.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    className={`drill-chip dept-chip ${selDept === dept ? 'active' : ''}`}
                    onClick={() => handleDeptSelect(dept)}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Level 2 – Years */}
            {selDept && (
              <div className="drill-level">
                <span className="drill-level-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  Year
                </span>
                <div className="drill-chips">
                  {yearsInDept.map(yr => (
                    <button
                      key={yr}
                      type="button"
                      className={`drill-chip year-chip ${selYear === yr ? 'active' : ''}`}
                      onClick={() => handleYearSelect(yr)}
                    >
                      {yearLabel(yr)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Level 3 – Divisions */}
            {selDept && selYear != null && (
              <div className="drill-level">
                <span className="drill-level-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Division
                </span>
                <div className="drill-chips">
                  {divsInYear.map(cls => (
                    <button
                      key={cls.class_id}
                      type="button"
                      className={`drill-chip div-chip ${selected === cls.class_id ? 'active' : ''}`}
                      onClick={() => handleDivSelect(cls.class_id)}
                    >
                      Division {cls.division}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Teacher / Room flat chips */}
        {view !== 'class' && (
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
        )}

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
           CLASS DRILL-DOWN
        ========================= */

        .class-drill-down {
          display: flex;
          flex-direction: column;
          gap: 0;
          border-bottom: 1px solid #eef1f6;
        }

        .drill-level {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 24px;
          border-bottom: 1px solid #f1f5f9;
          animation: drillIn 0.22s ease both;
        }

        .drill-level:last-child {
          border-bottom: none;
        }

        @keyframes drillIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .drill-level-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          min-width: 100px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .drill-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .drill-chip {
          padding: 6px 14px;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: #f8faff;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.13s ease;
          white-space: nowrap;
        }

        /* Department chips – blue accent */
        .drill-chip.dept-chip:hover {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .drill-chip.dept-chip.active {
          border-color: #2563eb;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          color: #1d4ed8;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.13);
        }

        /* Year chips – indigo accent */
        .drill-chip.year-chip:hover {
          border-color: #a5b4fc;
          background: #eef2ff;
          color: #4338ca;
        }
        .drill-chip.year-chip.active {
          border-color: #4f46e5;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          color: #3730a3;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.13);
        }

        /* Division chips – teal accent */
        .drill-chip.div-chip {
          padding: 6px 18px;
          font-size: 13px;
        }
        .drill-chip.div-chip:hover {
          border-color: #5eead4;
          background: #f0fdfa;
          color: #0d9488;
        }
        .drill-chip.div-chip.active {
          border-color: #0d9488;
          background: linear-gradient(135deg, #f0fdfa, #ccfbf1);
          color: #0f766e;
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.15);
          font-weight: 800;
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