import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 10h17" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    alertTriangle: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.5h.01" />
      </>
    ),
    sync: (
      <>
        <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
        <path d="M21 4v4h-4" />
        <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
        <path d="M3 20v-4h4" />
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
    bolt: (
      <>
        <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function TimeSlotForm() {
  const [slots, setSlots] = useState([])
  const [selectedDays, setSelectedDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
  const [periodsPerDay, setPeriodsPerDay] = useState(6)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchSlots() }, [])

  async function fetchSlots() {
    try {
      const res = await axios.get(`${BASE}/timeslots`)
      setSlots(res.data)
    } catch {
      setError('Could not load timeslots')
    }
  }

  function toggleDay(day) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function handleGenerate() {
    if (selectedDays.length === 0) {
      setError('Please select at least one day')
      return
    }

    setGenerating(true)
    setMessage('')
    setError('')

    try {
      for (const slot of slots) {
        await axios.delete(`${BASE}/timeslots/${slot.slot_id}`)
      }

      const orderedDays = ALL_DAYS.filter(d => selectedDays.includes(d))

      for (const day of orderedDays) {
        for (let p = 1; p <= parseInt(periodsPerDay); p++) {
          await axios.post(`${BASE}/timeslots`, { day, period_number: p })
        }
      }

      setMessage(`Generated ${orderedDays.length * periodsPerDay} slots — ${orderedDays.length} days × ${periodsPerDay} periods`)
      fetchSlots()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error generating slots')
    } finally {
      setGenerating(false)
    }
  }

  const orderedSelectedDays = ALL_DAYS.filter(d => selectedDays.includes(d))
  const totalSlots = selectedDays.length * periodsPerDay

  // Whether the database already reflects the current on-screen selection.
  const isSynced = useMemo(() => {
    if (slots.length === 0) return false
    if (slots.length !== totalSlots) return false

    const savedDays = [...new Set(slots.map(s => s.day))].sort()
    const currentDays = [...orderedSelectedDays].sort()

    if (savedDays.length !== currentDays.length) return false
    if (savedDays.some((d, i) => d !== currentDays[i])) return false

    return orderedSelectedDays.every(day => {
      const count = slots.filter(s => s.day === day).length
      return count === parseInt(periodsPerDay)
    })
  }, [slots, orderedSelectedDays, periodsPerDay, totalSlots])

  const hasSavedSlots = slots.length > 0

  return (
    <div className="timeslots-page">

      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="timeslots-hero">

        <div className="timeslots-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <circle cx="150" cy="105" r="78" stroke="currentColor" strokeWidth="2" />
            <path d="M150 60v45l32 20" stroke="currentColor" strokeWidth="2" />
            <path d="M300 40h230" stroke="currentColor" strokeWidth="2" />
            <path d="M300 90h230" stroke="currentColor" strokeWidth="2" />
            <path d="M300 140h230" stroke="currentColor" strokeWidth="2" />
            <path d="M300 190h150" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="hero-left">

          <div className="hero-icon">
            <Icon name="clock" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">ACADEMIC SCHEDULING</div>

            <h1>Time Slots</h1>

            <div className="hero-subtitle">Weekly Schedule Configuration</div>

            <p>Configure working days and the number of periods available each day.</p>
          </div>

        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="stats-grid">

        <div className="stat-card stat-slate">
          <div className="stat-icon">
            <Icon name="calendar" size={24} />
          </div>
          <div>
            <div className="stat-label">SELECTED DAYS</div>
            <div className="stat-number">{selectedDays.length}</div>
          </div>
          <div className="stat-decoration">
            <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
              <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill="url(#slate-gradient)" style={{ opacity: 0.15 }} />
              <defs>
                <linearGradient id="slate-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">
            <Icon name="clock" size={24} />
          </div>
          <div>
            <div className="stat-label">PERIODS / DAY</div>
            <div className="stat-number">{periodsPerDay}</div>
          </div>
          <div className="stat-decoration">
            <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#purple-gradient)" style={{ opacity: 0.15 }} />
              <defs>
                <linearGradient id="purple-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="stat-card stat-blue">
          <div className="stat-icon">
            <Icon name="grid" size={24} />
          </div>
          <div>
            <div className="stat-label">TOTAL SLOTS</div>
            <div className="stat-number">{totalSlots}</div>
          </div>
          <div className="stat-decoration">
            <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#blue-gradient)" style={{ opacity: 0.15 }} />
              <defs>
                <linearGradient id="blue-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

      </section>


      {/* =========================================================
          MAIN LAYOUT
      ========================================================= */}

      <div className="timeslots-layout">

        {/* ---------------- CONFIG PANEL ---------------- */}

        <div className="form-card config-card">

          <div className="form-header">
            <div className="form-title-group">
              <div className="form-icon">
                <Icon name="clock" size={21} />
              </div>

              <div>
                <div className="form-heading">Configure Schedule</div>
                <div className="form-sub">
                  Select working days and choose how many periods each day should contain.
                </div>
              </div>
            </div>
          </div>

          <div className="field-wrap">
            <label>Working Days</label>

            <div className="day-chip-row">
              {ALL_DAYS.map(day => {
                const active = selectedDays.includes(day)

                return (
                  <button
                    key={day}
                    type="button"
                    className={`day-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>

            <span className="field-hint">
              Choose the weekdays that should be available for timetable generation.
            </span>
          </div>

          <div className="field-wrap">
            <label>Periods Per Day</label>

            <div className="period-number-row">
              {[4, 5, 6, 7, 8, 9].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`period-number ${periodsPerDay === n ? 'active' : ''}`}
                  onClick={() => setPeriodsPerDay(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="summary-strip">
              <span>{selectedDays.length} days</span>
              <span className="dot" />
              <span>{periodsPerDay} periods/day</span>
              <span className="dot" />
              <strong>{totalSlots} total slots</strong>
            </div>
          </div>

          {hasSavedSlots && !isSynced && (
            <div className="warning-box">
              <Icon name="alertTriangle" size={16} />
              <span>
                {slots.length} saved slot{slots.length !== 1 ? 's' : ''} will be replaced
                when you generate this schedule.
              </span>
            </div>
          )}

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

          <button
            type="button"
            className="primary-button generate-button"
            onClick={handleGenerate}
            disabled={generating || selectedDays.length === 0}
          >
            {generating ? (
              'Generating...'
            ) : (
              <>
                <Icon name="bolt" size={17} />
                Generate {totalSlots} Slots
              </>
            )}
          </button>

        </div>

        {/* ---------------- PREVIEW PANEL ---------------- */}

        <section className="directory-card preview-card">

          <div className="directory-header">

            <div className="directory-title-block">
              <div className="directory-eyebrow">WEEKLY PREVIEW</div>

              <div className="directory-title-row">
                <div className="directory-main-icon">
                  <Icon name="grid" size={22} />
                </div>

                <div>
                  <h2>Schedule Preview</h2>
                  <p>Updates live as you adjust days and periods.</p>
                </div>
              </div>
            </div>

            <div className={`sync-badge ${isSynced ? 'synced' : 'unsynced'}`}>
              <Icon name={isSynced ? 'check' : 'sync'} size={13} />
              {isSynced
                ? 'Saved'
                : hasSavedSlots
                ? 'Unsaved changes'
                : 'Not generated yet'}
            </div>

          </div>

          {orderedSelectedDays.length > 0 ? (
            <div className="preview-grid">
              {orderedSelectedDays.map(day => (
                <div key={day} className="preview-day-card">
                  <div className="preview-day-title">{day}</div>

                  <div className="preview-period-list">
                    {Array.from({ length: periodsPerDay }, (_, i) => (
                      <span key={i} className="preview-period-pill">
                        P{i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="calendar" size={26} />
              </div>
              <h3>No working days selected</h3>
              <p>Select at least one working day to see a live preview of the weekly schedule.</p>
            </div>
          )}

        </section>

      </div>

      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .timeslots-page {
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

        .timeslots-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          min-height: 150px;
          padding: 26px 30px;
          margin-bottom: 22px;
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

        .timeslots-hero h1 {
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

        .timeslots-hero p {
          margin: 6px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 460px;
        }

        .timeslots-watermark {
          position: absolute;
          z-index: 1;
          right: 50px;
          bottom: -20px;
          width: min(42%, 560px);
          color: #8fa8e7;
          opacity: 0.11;
          pointer-events: none;
        }

        .timeslots-watermark svg {
          display: block;
          width: 100%;
          height: auto;
        }

        /* =========================
           BUTTONS
        ========================= */

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 20px;
          border: 1px solid #245de8;
          border-radius: 11px;
          background: linear-gradient(135deg, #326bf0, #2458db);
          color: white;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(37, 99, 235, 0.20);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.03);
          box-shadow: 0 12px 25px rgba(37, 99, 235, 0.25);
        }

        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .generate-button {
          width: 100%;
          height: 48px;
          font-size: 14px;
          margin-top: 4px;
        }

        /* =========================
           STATS
        ========================= */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
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

        .stat-slate .stat-icon { color: #475569; background: #eef2f6; }
        .stat-blue .stat-icon { color: #2563eb; background: #eaf1ff; }
        .stat-purple .stat-icon { color: #7041d9; background: #f0eaff; }

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

        .stat-slate .stat-number { color: #334155; }
        .stat-blue .stat-number { color: #2563eb; }
        .stat-purple .stat-number { color: #7041d9; }

        .stat-decoration {
          position: absolute;
          right: 0;
          bottom: 0;
          opacity: 0.8;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        }

        .stat-slate .stat-decoration { }
        .stat-blue .stat-decoration { }
        .stat-purple .stat-decoration { }

        /* =========================
           MESSAGES
        ========================= */

        .message {
          display: flex;
          align-items: center;
          gap: 9px;
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

        .timeslots-layout {
          display: grid;
          grid-template-columns: minmax(320px, 400px) 1fr;
          gap: 20px;
          align-items: start;
        }

        /* =========================
           CONFIG CARD
        ========================= */

        .form-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          padding: 24px 26px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        }

        .config-card {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
        }

        .form-title-group {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .form-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 13px;
          background: #edf3ff;
        }

        .form-heading {
          font-size: 16px;
          font-weight: 800;
          color: #101b35;
          margin-bottom: 3px;
        }

        .form-sub {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .field-wrap label {
          display: block;
          margin-bottom: 10px;
          color: #35445f;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .field-hint {
          display: block;
          margin-top: 9px;
          color: #8a97aa;
          font-size: 10px;
          line-height: 1.4;
        }

        .day-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .day-chip {
          min-width: 60px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.13s ease;
        }

        .day-chip:hover {
          border-color: #93c5fd;
          background: #f4f8ff;
        }

        .day-chip.active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
        }

        .period-number-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .period-number {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          background: #f8fafc;
          color: #64748b;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.13s ease;
        }

        .period-number:hover {
          border-color: #93c5fd;
          background: #f4f8ff;
        }

        .period-number.active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
        }

        .summary-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
          font-size: 11px;
          color: #64748b;
        }

        .summary-strip strong {
          color: #1d4ed8;
          font-weight: 800;
        }

        .dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #cbd5e1;
        }

        .warning-box {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px 13px;
          border-radius: 11px;
          border: 1px solid #fde68a;
          border-left: 3px solid #d97706;
          background: #fffbeb;
          color: #92400e;
          font-size: 11px;
          line-height: 1.5;
        }

        /* =========================
           PREVIEW CARD
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px rgba(28, 48, 90, 0.055);
        }

        .preview-card {
          min-height: 100%;
        }

        .directory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
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
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 13px;
          background: #edf3ff;
        }

        .directory-title-row h2 {
          margin: 0;
          color: #15213d;
          font-size: 17px;
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

        .sync-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .sync-badge.synced {
          color: #147447;
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .sync-badge.unsynced {
          color: #9a5b0a;
          border: 1px solid #fbdd9a;
          background: #fff8ea;
        }

        .preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
          gap: 14px;
          padding: 22px;
        }

        .preview-day-card {
          border: 1px solid #e5eaf3;
          border-radius: 14px;
          background: #fbfcfe;
          padding: 14px;
        }

        .preview-day-title {
          margin-bottom: 11px;
          color: #35445f;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .preview-period-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-period-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          border-radius: 8px;
          background: #edf3ff;
          border: 1px solid #c9d9ff;
          color: #245bd2;
          font-size: 11px;
          font-weight: 750;
        }

        /* =========================
           EMPTY STATE
        ========================= */

        .empty-state {
          margin: 20px;
          padding: 52px 25px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfcff, #f8faff);
          text-align: center;
        }

        .empty-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 13px;
          color: #2563eb;
          border-radius: 16px;
          background: #edf3ff;
        }

        .empty-state h3 {
          margin: 0;
          color: #1a2742;
          font-size: 15px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 380px;
          margin: 7px auto 0;
          color: #7c899f;
          font-size: 12px;
          line-height: 1.5;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1050px) {
          .timeslots-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 800px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .timeslots-hero {
            padding: 22px;
          }

          .timeslots-hero h1 {
            font-size: 26px;
          }

          .timeslots-watermark {
            display: none;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .timeslots-page { color: #ffffff; }
        [data-theme='dark'] .timeslots-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .timeslots-hero h1 { color: #ffffff !important; }
        [data-theme='dark'] .hero-subtitle { color: #ffffff !important; }
        [data-theme='dark'] .eyebrow { color: #a855f7 !important; }
        [data-theme='dark'] .hero-left p { color: #8a99ad !important; }
        [data-theme='dark'] .hero-icon { background: #141d33 !important; border-color: #1e2f57 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .primary-button { background: linear-gradient(135deg, #4f46e5, #4338ca) !important; border-color: #3730a3 !important; }
        [data-theme='dark'] .stat-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .stat-label { color: #8a99ad !important; }
        [data-theme='dark'] .stat-number { color: #ffffff !important; }
        [data-theme='dark'] .directory-card, [data-theme='dark'] .preview-card, [data-theme='dark'] .config-card { background: #0d1322 !important; border-color: #1a2338 !important; color: #ffffff !important; }
        [data-theme='dark'] .directory-title-row h2 { color: #ffffff !important; }
        [data-theme='dark'] .directory-title-row p { color: #8a99ad !important; }
        [data-theme='dark'] .directory-main-icon { background: #141d33 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .day-chip, [data-theme='dark'] .period-chip { background: #141d33 !important; color: #8a99ad !important; border-color: #1e2f4a !important; }
        [data-theme='dark'] .day-chip.active, [data-theme='dark'] .period-chip.active { background: #2563eb !important; color: #ffffff !important; border-color: #2563eb !important; }
        [data-theme='dark'] .slot-preview-cell { background: #111827 !important; border-color: #1e293b !important; color: #ffffff !important; }

      `}</style>

    </div>
  )
}