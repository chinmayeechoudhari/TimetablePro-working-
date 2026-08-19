import { useState, useEffect } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    userCheck: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m17 11 2 2 4-4" />
      </>
    ),
    grid: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    ban: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 12.8 12.8" />
      </>
    ),
    alertTriangle: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    x: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    chevronDown: (
      <>
        <path d="m6 9 6 6 6-6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.5h.01" />
      </>
    ),
    bolt: (
      <>
        <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" />
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
    calendarCheck: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 10h17" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="m9 15 2 2 4-4" />
      </>
    ),
    dot: (
      <>
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      </>
    ),
    cursorClick: (
      <>
        <path d="m9.5 9.5 8.5 3-3.3 1.5-1.5 3.3-3.7-7.8Z" />
        <path d="M12 3v2" />
        <path d="M5.6 5.6l1.4 1.4" />
        <path d="M3 12h2" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

export default function TeacherAvailabilityForm() {
  const [teachers, setTeachers] = useState([])
  const [slots, setSlots] = useState([])
  const [records, setRecords] = useState([])
  const [timetable, setTimetable] = useState([])
  const [subjects, setSubjects] = useState({})
  const [teacherId, setTeacherId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pulsingSlot, setPulsingSlot] = useState(null)
  const [busyDay, setBusyDay] = useState(null)

  useEffect(() => {
    fetchAll()
    const handleUpdate = (e) => {
      fetchAll()
      if (e?.detail?.teacherId) {
        setTeacherId(String(e.detail.teacherId))
      }
    }
    window.addEventListener('availabilityUpdated', handleUpdate)
    return () => window.removeEventListener('availabilityUpdated', handleUpdate)
  }, [])

  async function fetchAll() {
    try {
      const [tRes, sRes, rRes, ttRes, subRes] = await Promise.all([
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/timeslots`),
        axios.get(`${BASE}/teacher-availabilities`),
        axios.get(`${BASE}/timetable`),
        axios.get(`${BASE}/subjects`),
      ])
      setTeachers(tRes.data)
      setSlots(sRes.data)
      setRecords(rRes.data)
      setTimetable(ttRes.data)
      const subMap = {}
      subRes.data.forEach(s => { subMap[s.subject_id] = s.subject_name })
      setSubjects(subMap)
      if (tRes.data.length > 0 && !teacherId) setTeacherId(String(tRes.data[0].teacher_id))
    } catch {
      setError('Could not load data. Make sure the backend is running.')
    }
  }

  const getTeacherName = (id) =>
    teachers.find(t => t.teacher_id === parseInt(id))?.teacher_name || `Teacher ${id}`

  const sortedSlots = [...slots].sort((a, b) =>
    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.period_number - b.period_number
  )

  // Slots where this teacher is currently assigned in the timetable
  const assignedSlotIds = new Set(
    timetable
      .filter(e => e.teacher_id === parseInt(teacherId))
      .map(e => e.slot_id)
  )

  // Unavailability rules for selected teacher
  const teacherRules = records.filter(
    r => r.teacher_id === parseInt(teacherId) && !r.is_available
  )
  const unavailableSlotIds = new Set(teacherRules.map(r => r.slot_id))

  function triggerPulse(slotId) {
    setPulsingSlot(slotId)
    setTimeout(() => setPulsingSlot(current => (current === slotId ? null : current)), 380)
  }

  async function markUnavailable(slotId) {
    setMessage(''); setError('')
    triggerPulse(slotId)

    const alreadyExists = records.find(
      r => r.teacher_id === parseInt(teacherId) && r.slot_id === slotId
    )
    try {
      if (alreadyExists) {
        await axios.put(
          `${BASE}/teacher-availabilities/${teacherId}/${slotId}`,
          { is_available: false }
        )
      } else {
        await axios.post(`${BASE}/teacher-availabilities`, {
          teacher_id: parseInt(teacherId),
          slot_id: slotId,
          is_available: false
        })
      }
      setMessage('Marked unavailable')
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error setting availability')
    }
  }

  async function removeRule(slotId) {
    setMessage(''); setError('')
    triggerPulse(slotId)

    try {
      await axios.delete(`${BASE}/teacher-availabilities/${teacherId}/${slotId}`)
      setMessage('Unavailability rule removed')
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error removing rule')
    }
  }

  // Toggle an entire day: if every period in the day is already marked
  // unavailable, restore the whole day; otherwise mark every remaining
  // period in that day unavailable.
  async function toggleDayUnavailable(day) {
    setMessage(''); setError('')

    const daySlots = sortedSlots.filter(s => s.day === day)
    if (daySlots.length === 0) return

    const allUnavailable = daySlots.every(s => unavailableSlotIds.has(s.slot_id))

    setBusyDay(day)

    try {
      if (allUnavailable) {
        await Promise.all(
          daySlots.map(s =>
            axios.delete(`${BASE}/teacher-availabilities/${teacherId}/${s.slot_id}`)
          )
        )
        setMessage(`${day} marked fully available`)
      } else {
        await Promise.all(
          daySlots.map(s => {
            if (unavailableSlotIds.has(s.slot_id)) return Promise.resolve()

            const exists = records.find(
              r => r.teacher_id === parseInt(teacherId) && r.slot_id === s.slot_id
            )

            if (exists) {
              return axios.put(
                `${BASE}/teacher-availabilities/${teacherId}/${s.slot_id}`,
                { is_available: false }
              )
            }

            return axios.post(`${BASE}/teacher-availabilities`, {
              teacher_id: parseInt(teacherId),
              slot_id: s.slot_id,
              is_available: false
            })
          })
        )
        setMessage(`${day} marked fully unavailable`)
      }

      await fetchAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error updating day availability')
    } finally {
      setBusyDay(null)
    }
  }

  // Assigned lectures for selected teacher (for the side panel)
  const assignedLectures = timetable
    .filter(e => e.teacher_id === parseInt(teacherId))
    .map(e => {
      const slot = slots.find(s => s.slot_id === e.slot_id)
      return { ...e, slot }
    })
    .filter(e => e.slot)
    .sort((a, b) =>
      DAYS.indexOf(a.slot.day) - DAYS.indexOf(b.slot.day) ||
      a.slot.period_number - b.slot.period_number
    )

  const hasTeacher = !!teacherId
  const conflictCount = teacherRules.filter(r => assignedSlotIds.has(r.slot_id)).length

  return (
    <div className="availability-page">

      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="availability-hero">

        <div className="availability-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <circle cx="150" cy="80" r="34" stroke="currentColor" strokeWidth="2" />
            <path d="M90 190v-20a60 60 0 0 1 120 0v20" stroke="currentColor" strokeWidth="2" />
            <rect x="330" y="45" width="230" height="140" rx="10" stroke="currentColor" strokeWidth="2" />
            <path d="M330 90h230" stroke="currentColor" strokeWidth="2" />
            <path d="M380 45v-10" stroke="currentColor" strokeWidth="2" />
            <path d="M510 45v-10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="hero-left">

          <div className="hero-icon">
            <Icon name="userCheck" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">ACADEMIC SCHEDULING</div>

            <h1>Availability</h1>

            <div className="hero-subtitle">Teacher Availability Management</div>

            <p>Select a teacher to view their lectures and manage unavailability rules.</p>
          </div>

        </div>

      </section>


      {/* =========================================================
          REGENERATE REMINDER — moved to top, always noticeable
          whenever this teacher has active unavailability rules.
      ========================================================= */}

      {hasTeacher && teacherRules.length > 0 && (
        <div className={`regen-banner ${conflictCount > 0 ? 'regen-urgent' : ''}`}>
          <div className="regen-icon">
            <span className="regen-icon-halo" />
            <Icon name="bolt" size={19} />
          </div>

          <div className="regen-text">
            <strong>
              {conflictCount > 0
                ? `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} need attention`
                : 'Regenerate the timetable to apply these changes'}
            </strong>
            <span>
              Go to <strong>Generate</strong> and re-run the solver — it will automatically
              assign a replacement teacher for any conflicting slots.
            </span>
          </div>
        </div>
      )}


      {/* =========================================================
          TEACHER SELECTOR
      ========================================================= */}

      <section className="teacher-switcher">

        <div className="switcher-left">
          <div className={`switcher-avatar ${!hasTeacher ? 'switcher-avatar-empty' : ''}`}>
            {hasTeacher ? getInitials(getTeacherName(teacherId)) : <Icon name="userCheck" size={20} />}
          </div>

          <div className="switcher-text">
            <div className="switcher-label">ACTIVE TEACHER</div>

            <div className="select-shell">
              <select
                value={teacherId}
                onChange={e => { setTeacherId(e.target.value); setMessage(''); setError('') }}
              >
                <option value="">— Select a teacher —</option>
                {teachers.map(t => (
                  <option key={t.teacher_id} value={t.teacher_id}>{t.teacher_name}</option>
                ))}
              </select>
              <span className="select-chevron">
                <Icon name="chevronDown" size={16} />
              </span>
            </div>
          </div>
        </div>

        <div className="switcher-badges">
          {hasTeacher && (
            <div className={`badge-pill ${assignedLectures.length > 0 ? 'badge-blue' : 'badge-neutral'}`}>
              <Icon name="book" size={13} />
              {assignedLectures.length} lecture{assignedLectures.length !== 1 ? 's' : ''} assigned
            </div>
          )}

          {teacherRules.length > 0 && (
            <div className="badge-pill badge-red">
              <Icon name="ban" size={13} />
              {teacherRules.length} unavailability rule{teacherRules.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      {hasTeacher && (
        <section className="stats-grid">

          <div className="stat-card stat-blue">
            <div className="stat-icon">
              <Icon name="book" size={24} />
            </div>
            <div>
              <div className="stat-label">ASSIGNED LECTURES</div>
              <div className="stat-number">{assignedLectures.length}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill="url(#blue-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="blue-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="stat-card stat-red">
            <div className="stat-icon">
              <Icon name="ban" size={24} />
            </div>
            <div>
              <div className="stat-label">UNAVAILABILITY RULES</div>
              <div className="stat-number">{teacherRules.length}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#red-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="red-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="stat-card stat-amber">
            <div className="stat-icon">
              <Icon name="alertTriangle" size={24} />
            </div>
            <div>
              <div className="stat-label">CONFLICTS</div>
              <div className="stat-number">{conflictCount}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#amber-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="amber-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

        </section>
      )}


      {/* =========================================================
          MESSAGES
      ========================================================= */}

      {message && (
        <div className="message success-message">
          <Icon name="check" size={16} />
          {message}
        </div>
      )}

      {error && (
        <div className="message error-message">
          <Icon name="alertTriangle" size={16} />
          {error}
        </div>
      )}


      {/* =========================================================
          MAIN LAYOUT
      ========================================================= */}

      <div className="availability-layout">

        {/* ---------------- SLOT PICKER (bigger, primary panel) ---------------- */}

        <div className={`form-card picker-card ${!hasTeacher ? 'picker-card-disabled' : ''}`}>

          <div className="form-header">
            <div className="form-title-group">
              <div className="form-icon">
                <Icon name="grid" size={22} />
              </div>

              <div>
                <div className="form-heading">Mark Unavailable Slots</div>
                <div className="form-sub">Click any period to toggle its unavailability rule.</div>
              </div>
            </div>
          </div>

          <div className="picker-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-assigned" />
              Currently assigned lecture
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-unavailable" />
              Unavailability rule set
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-conflict" />
              Conflict — assigned but marked unavailable
            </span>
          </div>

          <div className="removal-hint">
            <span className="removal-hint-icon">
              <span className="removal-hint-halo" />
              <Icon name="cursorClick" size={14} />
            </span>
            Tip: click a highlighted period again to remove its rule instantly.
          </div>

          {sortedSlots.length === 0 && (
            <div className="picker-empty">No timeslots configured yet.</div>
          )}

          <div className="picker-days">
            {DAYS.filter(d => sortedSlots.some(s => s.day === d)).map(day => {
              const daySlots = sortedSlots.filter(s => s.day === day)
              const dayFullyOff = daySlots.every(s => unavailableSlotIds.has(s.slot_id))

              return (
                <div key={day} className="picker-day-block">
                  <div className="picker-day-header">
                    <div className="picker-day-title">{day}</div>

                    <button
                      type="button"
                      className={`day-toggle ${dayFullyOff ? 'day-toggle-active' : ''}`}
                      onClick={() => toggleDayUnavailable(day)}
                      disabled={busyDay === day}
                    >
                      <Icon name={dayFullyOff ? 'calendarCheck' : 'calendarOff'} size={13} />
                      {busyDay === day
                        ? 'Updating…'
                        : dayFullyOff
                        ? 'Restore day'
                        : 'Mark full day off'}
                    </button>
                  </div>

                  <div className="picker-period-row">
                    {daySlots.map(s => {
                      const isAssigned = assignedSlotIds.has(s.slot_id)
                      const isUnavailable = unavailableSlotIds.has(s.slot_id)
                      const isConflict = isAssigned && isUnavailable

                      return (
                        <button
                          key={s.slot_id}
                          type="button"
                          title={
                            isUnavailable ? 'Click to remove this rule' :
                              isAssigned ? 'Assigned — click to mark unavailable' :
                                'Click to mark unavailable'
                          }
                          className={[
                            'period-toggle',
                            isConflict ? 'period-conflict' : isUnavailable ? 'period-unavailable' : isAssigned ? 'period-assigned' : '',
                            pulsingSlot === s.slot_id ? 'period-pulse' : '',
                          ].join(' ').trim()}
                          onClick={() =>
                            isUnavailable ? removeRule(s.slot_id) : markUnavailable(s.slot_id)
                          }
                        >
                          P{s.period_number}
{isConflict && <Icon name="alertTriangle" size={9} stroke={2.2} />}
{isUnavailable && !isConflict && <Icon name="x" size={9} stroke={2.2} />}
{isAssigned && !isUnavailable && <Icon name="dot" size={7} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

        </div>


        {/* ---------------- CURRENT LECTURES (right, compact) ---------------- */}

        <section className="directory-card lectures-card">

          <div className="directory-header">
            <div className="directory-title-block">
              <div className="directory-eyebrow">TEACHING SCHEDULE</div>

              <div className="directory-title-row">
                <div className="directory-main-icon">
                  <Icon name="book" size={22} />
                </div>

                <div>
                  <h2>Current Lectures</h2>
                  <p>
                    {hasTeacher
                      ? `Assigned timetable slots for ${getTeacherName(teacherId)}.`
                      : 'Select a teacher above to view their schedule.'}
                  </p>
                </div>
              </div>
            </div>

            {hasTeacher && (
              <div className="result-count">
                {assignedLectures.length} lecture{assignedLectures.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {assignedLectures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="book" size={26} />
              </div>
              <h3>
                {hasTeacher ? 'No lectures assigned yet' : 'No teacher selected'}
              </h3>
              <p>
                {hasTeacher
                  ? 'Generate a timetable first to see lectures assigned to this teacher.'
                  : 'Choose a teacher from the selector above to get started.'}
              </p>
            </div>
          ) : (
            <div className="lecture-table-wrapper">
              <table className="lecture-table">
                <thead>
                  <tr>
                    <th>DAY</th>
                    <th className="period-column">PERIOD</th>
                    <th>SUBJECT</th>
                    <th className="status-column">STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {assignedLectures.map(e => {
                    const isUnavailable = unavailableSlotIds.has(e.slot_id)

                    return (
                      <tr key={`${e.slot_id}`}>
                        <td className="day-cell">{e.slot.day}</td>

                        <td className="period-cell">
                          <span className="period-pill">P{e.slot.period_number}</span>
                        </td>

                        <td>
                          <div className="subject-name-cell">
                            <div className="subject-icon">
                              <Icon name="book" size={16} />
                            </div>
                            {subjects[e.subject_id] || `Subject ${e.subject_id}`}
                          </div>
                        </td>

                        <td className="status-cell">
                          {isUnavailable ? (
                            <span className="type-badge type-badge-lab">
                              <Icon name="alertTriangle" size={11} />
                              Conflict
                            </span>
                          ) : (
                            <span className="type-badge type-badge-theory">
                              <Icon name="check" size={11} />
                              Available
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </section>

      </div>

      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .availability-page {
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

        .availability-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          min-height: 150px;
          padding: 26px 30px;
          margin-bottom: 16px;
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
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #3564bb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .availability-hero h1 {
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

        .availability-hero p {
          margin: 6px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 460px;
        }

        .availability-watermark {
          position: absolute;
          z-index: 1;
          right: 50px;
          bottom: -14px;
          width: min(42%, 560px);
          color: #8fa8e7;
          opacity: 0.11;
          pointer-events: none;
        }

        .availability-watermark svg {
          display: block;
          width: 100%;
          height: auto;
        }

        /* =========================
           REGENERATE REMINDER BANNER
        ========================= */

        .regen-banner {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 15px;
          min-height: 66px;
          margin-bottom: 16px;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid #fde68a;
          border-left: 4px solid #d97706;
          background: linear-gradient(135deg, #fffbeb 0%, #fff7e0 100%);
          box-shadow: 0 8px 22px rgba(217, 119, 6, 0.09);
        }

        .regen-banner.regen-urgent {
          border-color: #f2c5c1;
          border-left-color: #dc2626;
          background: linear-gradient(135deg, #fff5f4 0%, #ffefee 100%);
          box-shadow: 0 8px 22px rgba(220, 38, 38, 0.10);
        }

        .regen-icon {
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fde68a;
        }

        .regen-urgent .regen-icon {
          color: #b91c1c;
          background: #fee2e2;
          border: 1px solid #f2c5c1;
        }

        .regen-icon-halo {
          position: absolute;
          inset: -6px;
          border-radius: 16px;
          border: 2px solid currentColor;
          opacity: 0.35;
          animation: regenHalo 1.8s ease-out infinite;
        }

        @keyframes regenHalo {
          0% { transform: scale(0.85); opacity: 0.5; }
          70% { transform: scale(1.28); opacity: 0; }
          100% { transform: scale(1.28); opacity: 0; }
        }

        .regen-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 12px;
          line-height: 1.5;
          color: #78350f;
        }

        .regen-urgent .regen-text {
          color: #7f1d1d;
        }

        .regen-text strong {
          font-size: 13.5px;
          font-weight: 800;
        }

        /* =========================
           TEACHER SWITCHER
        ========================= */

        .teacher-switcher {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
          min-height: 84px;
          margin-bottom: 18px;
          padding: 15px 22px;
          border: 1px solid #dce4f0;
          border-radius: 17px;
          background: white;
          box-shadow: 0 6px 20px rgba(30, 48, 87, 0.04);
        }

        .switcher-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .switcher-avatar {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 850;
        }

        .switcher-avatar-empty {
          background: #f1f5f9;
          border: 1px solid #dde5ef;
          color: #94a3b8;
        }

        .switcher-label {
          margin-bottom: 6px;
          color: #7483a0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .select-shell {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .select-shell select {
          appearance: none;
          -webkit-appearance: none;
          min-width: 230px;
          height: 42px;
          padding: 0 38px 0 14px;
          border: 1.5px solid #93c5fd;
          border-radius: 10px;
          background: #f4f8ff;
          color: #1d4ed8;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .select-shell select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .select-chevron {
          position: absolute;
          right: 12px;
          display: flex;
          pointer-events: none;
          color: #2563eb;
        }

        .switcher-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 13px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .badge-blue {
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .badge-neutral {
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .badge-red {
          color: #b42318;
          background: #fff5f4;
          border: 1px solid #f1c5c1;
        }

        /* =========================
           STATS
        ========================= */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          min-height: 92px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 18px 21px;
          border: 1px solid #dfe6f2;
          border-radius: 17px;
          background: white;
          box-shadow: 0 7px 22px rgba(30, 48, 87, 0.045);
        }

        .stat-icon {
          position: relative;
          z-index: 2;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
        }

        .stat-blue .stat-icon { color: #2563eb; background: #eaf1ff; }
        .stat-red .stat-icon { color: #d12c2c; background: #fdeeee; }
        .stat-amber .stat-icon { color: #b45309; background: #fef3c7; }

        .stat-label {
          position: relative;
          z-index: 2;
          color: #60708e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .stat-number {
          position: relative;
          z-index: 2;
          margin-top: 2px;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .stat-blue .stat-number { color: #2563eb; }
        .stat-red .stat-number { color: #d12c2c; }
        .stat-amber .stat-number { color: #b45309; }

        .stat-decoration {
          position: absolute;
          right: 0;
          bottom: 0;
          opacity: 0.8;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        }

        .stat-blue .stat-decoration { }
        .stat-red .stat-decoration { }
        .stat-amber .stat-decoration { }

        /* =========================
           MESSAGES
        ========================= */

        .message {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 18px;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .success-message {
          color: #147447;
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .error-message {
          color: #b42318;
          border: 1px solid #f1c5c1;
          background: #fff5f4;
        }

        /* =========================
           LAYOUT
        ========================= */

        .availability-layout {
          display: grid;
          grid-template-columns: minmax(420px, 1.15fr) minmax(320px, 0.85fr);
          gap: 20px;
          align-items: start;
        }

        /* =========================
           PICKER CARD (primary, larger)
        ========================= */

        .form-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          padding: 26px 28px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        }

        .picker-card-disabled {
          opacity: 0.55;
          pointer-events: none;
        }

        .form-header {
          margin-bottom: 18px;
        }

        .form-title-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .form-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 13px;
          background: #edf3ff;
        }

        .form-heading {
          font-size: 17px;
          font-weight: 800;
          color: #101b35;
          margin-bottom: 3px;
        }

        .form-sub {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .picker-legend {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-bottom: 12px;
          padding: 13px 15px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #eaeef4;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #55617a;
          font-size: 11.5px;
          font-weight: 600;
        }

        .legend-swatch {
          width: 13px;
          height: 13px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .legend-swatch-assigned {
          background: #eff6ff;
          border: 1.5px solid #2563eb;
        }

        .legend-swatch-unavailable {
          background: #fef2f2;
          border: 1.5px solid #dc2626;
        }

        .legend-swatch-conflict {
          background: #fef3c7;
          border: 1.5px solid #d97706;
        }

        .removal-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 10px 14px;
          border-radius: 11px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.4;
        }

        .removal-hint-icon {
          position: relative;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 8px;
          background: #dbeafe;
        }

        .removal-hint-halo {
          position: absolute;
          inset: -4px;
          border-radius: 10px;
          border: 2px solid #2563eb;
          opacity: 0.4;
          animation: regenHalo 1.8s ease-out infinite;
        }

        .picker-empty {
          color: #94a3b8;
          font-size: 12px;
          padding: 8px 2px;
        }

        .picker-days {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .picker-day-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 9px;
        }

        .picker-day-title {
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .day-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 999px;
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.13s ease;
        }

        .day-toggle:hover:not(:disabled) {
          border-color: #cbd5e1;
          background: #f1f5f9;
        }

        .day-toggle:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .day-toggle.day-toggle-active {
          border-color: #dc2626;
          background: #fef2f2;
          color: #dc2626;
        }

        .picker-period-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

        .period-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 9px;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
}
        .period-toggle:hover {
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }

        .period-toggle.period-assigned {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .period-toggle.period-unavailable {
          border-color: #dc2626;
          background: #fef2f2;
          color: #dc2626;
        }

        .period-toggle.period-conflict {
          border-color: #d97706;
          background: #fef3c7;
          color: #92400e;
          box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.15);
        }

        .period-toggle.period-pulse {
          animation: periodPulse 0.38s ease;
        }

        @keyframes periodPulse {
          0% { transform: scale(1); }
          35% { transform: scale(1.18); box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }

        /* =========================
           DIRECTORY CARD (lectures, right)
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px rgba(28, 48, 90, 0.055);
        }

        .lectures-card {
          display: flex;
          flex-direction: column;
        }

        .directory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 22px;
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
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 12px;
          background: #edf3ff;
        }

        .directory-title-row h2 {
          margin: 0;
          color: #15213d;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .directory-title-row p {
          margin: 3px 0 0;
          color: #71809d;
          font-size: 11px;
          line-height: 1.5;
        }

        .result-count {
          color: #3e609d;
          border: 1px solid #cddcff;
          border-radius: 999px;
          background: #f3f7ff;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        /* =========================
           TABLE (compact, scrollable so it never runs away)
        ========================= */

        .lecture-table-wrapper {
          margin: 14px;
          overflow: hidden;
          border: 1px solid #e1e7f0;
          border-radius: 14px;
        }

        .lecture-table-wrapper table {
          display: block;
          max-height: 460px;
          overflow-y: auto;
        }

        .lecture-table {
          width: 100%;
          border-collapse: collapse;
        }

        .lecture-table thead,
        .lecture-table tbody,
        .lecture-table tr {
          display: table;
          width: 100%;
          table-layout: fixed;
        }

        .lecture-table thead {
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .lecture-table th {
          height: 38px;
          padding: 0 14px;
          border-bottom: 1px solid #dfe6ef;
          background: #f8faff;
          color: #62718d;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
        }

        .lecture-table th.period-column,
        .lecture-table th.status-column { text-align: center; width: 100px; }

        .lecture-table td {
          height: 52px;
          padding: 9px 14px;
          border-bottom: 1px solid #e7ebf2;
          background: white;
          vertical-align: middle;
          font-size: 12.5px;
        }

        .lecture-table tbody tr:last-child td { border-bottom: 0; }
        .lecture-table tbody tr:hover td { background: #fbfcff; }

        .day-cell {
          color: #15213d;
          font-weight: 750;
        }

        .period-cell,
        .status-cell {
          text-align: center;
        }

        .period-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          padding: 4px 8px;
          border-radius: 999px;
          background: #edf3ff;
          border: 1px solid #c9d9ff;
          color: #245bd2;
          font-size: 11px;
          font-weight: 750;
        }

        .subject-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: #1f2c48;
        }

        .subject-icon {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 8px;
          color: #2563eb;
          background: #edf3ff;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 22px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: 850;
          letter-spacing: 0.03em;
        }

        .type-badge-theory {
          color: #147447;
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .type-badge-lab {
          color: #92400e;
          border: 1px solid #fde68a;
          background: #fef3c7;
        }

        /* =========================
           EMPTY STATE
        ========================= */

        .empty-state {
          margin: 14px;
          padding: 44px 22px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfcff, #f8faff);
          text-align: center;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          color: #2563eb;
          border-radius: 15px;
          background: #edf3ff;
        }

        .empty-state h3 {
          margin: 0;
          color: #1a2742;
          font-size: 14px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 320px;
          margin: 6px auto 0;
          color: #7c899f;
          font-size: 12px;
          line-height: 1.5;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1100px) {
          .availability-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .availability-hero {
            padding: 22px;
          }

          .availability-hero h1 {
            font-size: 26px;
          }

          .availability-watermark {
            display: none;
          }

          .teacher-switcher {
            flex-direction: column;
            align-items: flex-start;
          }

          .select-shell select {
            min-width: 200px;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .picker-day-header {
            flex-wrap: wrap;
          }

          .form-card {
            padding: 20px;
          }
        }

        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .availability-page { color: #ffffff; }
        [data-theme='dark'] .availability-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .availability-hero h1 { color: #ffffff !important; }
        [data-theme='dark'] .hero-subtitle { color: #ffffff !important; }
        [data-theme='dark'] .eyebrow { color: #a855f7 !important; }
        [data-theme='dark'] .hero-left p { color: #8a99ad !important; }
        [data-theme='dark'] .hero-icon { background: #141d33 !important; border-color: #1e2f57 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .primary-button { background: linear-gradient(135deg, #4f46e5, #4338ca) !important; border-color: #3730a3 !important; }
        [data-theme='dark'] .stat-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .stat-label { color: #8a99ad !important; }
        [data-theme='dark'] .stat-number { color: #ffffff !important; }
        [data-theme='dark'] .directory-card, [data-theme='dark'] .form-card, [data-theme='dark'] .picker-card { background: #0d1322 !important; border-color: #1a2338 !important; color: #ffffff !important; }
        [data-theme='dark'] .teacher-switcher { background: #0d1322 !important; border-color: #1a2338 !important; }

      `}</style>

    </div>
  )
}