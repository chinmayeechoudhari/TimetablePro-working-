import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructureModern.css'

const BASE = 'http://localhost:8000'
const YEARS = [1, 2, 3, 4]
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y])
const letterAt = i => String.fromCharCode(65 + i)
const ACCENTS = 6
const SHORT_CODE_KEY = 'timetablepro.department_short_codes'

// Short codes have no backing column on the backend (Department is just a
// free-text string on AcademicGroup — see backend/app/models/models.py).
// We persist an optional user-entered code per department name in this
// browser's localStorage so it survives reloads without requiring a schema
// change. It is NOT synced across users/devices.
function loadShortCodes() {
  try { return JSON.parse(localStorage.getItem(SHORT_CODE_KEY) || '{}') } catch { return {} }
}
function saveShortCode(name, code) {
  const map = loadShortCodes()
  if (code) map[name] = code; else delete map[name]
  localStorage.setItem(SHORT_CODE_KEY, JSON.stringify(map))
}
function deriveShortCode(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}
function defaultAcademicYear() {
  const now = new Date()
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${String(start + 1).slice(-2)}`
}
function accentIndex(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return hash % ACCENTS
}
function emptyYearConfig() {
  return { 1: 0, 2: 0, 3: 0, 4: 0 }
}

function Icon({ name, size = 18, stroke = 1.9 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    building: <><path d="M3 21h18" /><path d="M5 21V6l7-3 7 3v15" /><path d="M8 9h1M12 9h1M16 9h1M8 12h1M12 12h1M16 12h1M8 15h1M12 15h1M16 15h1" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 7.5 3 3" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    archive: <><path d="M4 7h16" /><path d="M6 7v13h12V7" /><path d="M9 11h6" /><path d="m9 4 6 0 1 3H8l1-3Z" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2.2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.5v.01" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

export default function AcademicStructureV2() {
  const [groups, setGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [shortCodes, setShortCodes] = useState(loadShortCodes)

  // create / edit modal
  const [modal, setModal] = useState(null) // null | 'create' | { type: 'edit', name }
  const [department, setDepartment] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear())
  const [showAcademicYear, setShowAcademicYear] = useState(false)
  const [counts, setCounts] = useState(emptyYearConfig)
  const [existingYears, setExistingYears] = useState({}) // year -> group (locked, from backend)

  // delete department confirmation
  const [deleteTarget, setDeleteTarget] = useState(null)

  // legacy cleanup
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [legacyTarget, setLegacyTarget] = useState(null)

  async function load() {
    try {
      const [structure, classResponse] = await Promise.all([
        axios.get(`${BASE}/academic-structure`),
        axios.get(`${BASE}/classes`),
      ])
      setGroups(structure.data.groups || [])
      setClasses(classResponse.data || [])
    } catch {
      setError('Could not load academic structure.')
    }
  }
  useEffect(() => { load() }, [])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const departmentRows = useMemo(() => departments.map(name => {
    const rows = groups.filter(g => g.department === name)
    return {
      name,
      groups: rows,
      divisions: rows.reduce((n, g) => n + g.divisions.length, 0),
      academicYear: rows[0]?.academic_year || defaultAcademicYear(),
    }
  }), [departments, groups])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return departmentRows
    return departmentRows.filter(d => d.name.toLowerCase().includes(q))
  }, [departmentRows, search])

  const totalYears = departmentRows.reduce((n, d) => n + d.groups.length, 0)
  const totalDivisions = departmentRows.reduce((n, d) => n + d.divisions, 0)

  const activeClassIds = useMemo(() => new Set(groups.flatMap(g => (g.divisions || []).map(v => v.class_id).filter(Boolean))), [groups])
  const legacyClasses = useMemo(() => classes.filter(c => !activeClassIds.has(c.class_id)), [classes, activeClassIds])

  function closeModal() {
    setModal(null); setError('')
    setDepartment(''); setShortCode(''); setCounts(emptyYearConfig())
    setExistingYears({}); setShowAcademicYear(false); setAcademicYear(defaultAcademicYear())
  }

  function openCreate() {
    setError(''); setMessage('')
    setDepartment(''); setShortCode(''); setCounts(emptyYearConfig())
    setExistingYears({}); setAcademicYear(defaultAcademicYear()); setShowAcademicYear(false)
    setModal('create')
  }

  function openEdit(row) {
    setError(''); setMessage('')
    setDepartment(row.name)
    setShortCode(shortCodes[row.name] || '')
    setAcademicYear(row.academicYear)
    setShowAcademicYear(false)
    const locked = {}
    row.groups.forEach(g => { locked[g.year_of_study] = g })
    setExistingYears(locked)
    setCounts(emptyYearConfig())
    setModal({ type: 'edit', name: row.name })
  }

  function toggleYear(year) {
    if (existingYears[year]) return // locked, already configured on the backend
    setCounts(c => ({ ...c, [year]: c[year] > 0 ? 0 : 1 }))
  }
  function addChip(year) {
    setCounts(c => ({ ...c, [year]: Math.min(26, (c[year] || 0) + 1) }))
  }
  function removeChip(year) {
    setCounts(c => ({ ...c, [year]: Math.max(0, (c[year] || 0) - 1) }))
  }

  async function submitCreate(e) {
    e.preventDefault()
    const yearConfigs = YEARS.filter(y => counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim()) return setError('Enter the department name.')
    if (!yearConfigs.length) return setError('Enable at least one year and add its divisions.')
    try {
      const res = await axios.post(`${BASE}/academic-structure`, {
        academic_year: academicYear.trim() || defaultAcademicYear(),
        department: department.trim(),
        years: yearConfigs,
      })
      saveShortCode(department.trim(), shortCode.trim())
      setShortCodes(loadShortCodes())
      setMessage(res.data.message || `${department.trim()} was created.`)
      closeModal()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the department.')
    }
  }

  async function submitEdit(e) {
    e.preventDefault()
    const originalName = modal.name
    const newName = department.trim()
    if (!newName) return setError('Department name cannot be empty.')
    const newYearConfigs = YEARS.filter(y => !existingYears[y] && counts[y] > 0)
      .map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))

    try {
      if (newName !== originalName) {
        await axios.put(`${BASE}/academic-structure/department`, { old_department: originalName, new_department: newName })
      }
      if (newYearConfigs.length) {
        await axios.post(`${BASE}/academic-structure`, {
          academic_year: academicYear.trim() || defaultAcademicYear(),
          department: newName,
          years: newYearConfigs,
        })
      }
      saveShortCode(newName, shortCode.trim())
      if (newName !== originalName) saveShortCode(originalName, '')
      setShortCodes(loadShortCodes())
      setMessage(`${newName} was updated.`)
      closeModal()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update the department.')
    }
  }

  async function confirmDeleteDepartment() {
    if (!deleteTarget) return
    try {
      const res = await axios.delete(`${BASE}/academic-structure/department`, { params: { department: deleteTarget.name } })
      saveShortCode(deleteTarget.name, '')
      setShortCodes(loadShortCodes())
      setMessage(res.data.message)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not remove the department.')
    }
  }

  async function deleteLegacy() {
    if (!legacyTarget) return
    try {
      await axios.delete(`${BASE}/classes/${legacyTarget.class_id}`)
      setMessage(`${legacyTarget.class_name} was permanently deleted.`)
      setLegacyTarget(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete the legacy class.')
    }
  }

  const isEdit = modal && modal.type === 'edit'

  return (
    <div className="academic-page">

      {/* HERO */}
      <section className="academic-hero">
        <svg className="academic-hero-watermark" viewBox="0 0 620 220" fill="none" aria-hidden="true">
          <path d="M70 185V92l105-58 105 58v93" stroke="currentColor" strokeWidth="2" />
          <path d="M112 185v-58h54v58M203 185v-58h54v58" stroke="currentColor" strokeWidth="2" />
          <path d="M145 92h60M145 116h60" stroke="currentColor" strokeWidth="2" />
          <path d="M315 185V62l85-43 85 43v123" stroke="currentColor" strokeWidth="2" />
          <path d="M350 185v-55h38v55M407 185v-55h38v55" stroke="currentColor" strokeWidth="2" />
          <path d="M368 82h64M368 105h64" stroke="currentColor" strokeWidth="2" />
          <path d="M40 185h540" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="hero-left">
          <div className="hero-icon"><Icon name="building" size={30} stroke={1.7} /></div>
          <div>
            <div className="academic-eyebrow">ACADEMIC STRUCTURE</div>
            <h1>Departments</h1>
            <div className="hero-subtitle">Manage Departments &amp; Divisions</div>
            <p>Each department can hold multiple years of study, and every year can have its own set of divisions.</p>
          </div>
        </div>

        <button className="primary-button hero-add-button" onClick={openCreate}>
          <Icon name="plus" size={18} /> Create New Department
        </button>
      </section>

      {/* SUMMARY STATS */}
      <section className="academic-stats">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Icon name="building" size={24} /></div>
          <div><div className="stat-label">TOTAL DEPARTMENTS</div><div className="stat-number">{departmentRows.length}</div></div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-icon"><Icon name="layers" size={24} /></div>
          <div><div className="stat-label">TOTAL YEARS</div><div className="stat-number">{totalYears}</div></div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-icon"><Icon name="grid" size={24} /></div>
          <div><div className="stat-label">TOTAL DIVISIONS</div><div className="stat-number">{totalDivisions}</div></div>
        </div>
      </section>

      {message && <div className="global-notice success"><Icon name="check" size={16} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={15} /></button></div>}
      {error && !modal && !deleteTarget && !legacyTarget && <div className="global-notice error">{error}<button onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}

      {/* DIRECTORY */}
      <section className="dept-directory-head">
        <div>
          <div className="section-kicker">DEPARTMENT DIRECTORY</div>
          <h2>All departments</h2>
          <p>{departmentRows.length} department{departmentRows.length === 1 ? '' : 's'} configured for {academicYear}</p>
        </div>
        <div className="dept-search">
          <Icon name="search" size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments..." />
          {search && <button onClick={() => setSearch('')} style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}><Icon name="close" size={14} /></button>}
        </div>
      </section>

      <section className="dept-grid">
        {filteredRows.length ? filteredRows.map(row => {
          const accent = accentIndex(row.name)
          const code = shortCodes[row.name] || deriveShortCode(row.name)
          return (
            <article className={`dept-card accent-${accent}`} key={row.name}>
              <div className="dept-card-top">
                <div className="dept-avatar">{code.slice(0, 2)}</div>
                <div className="dept-card-actions">
                  <button className="dept-icon-btn" title="Edit" onClick={() => openEdit(row)}><Icon name="edit" size={15} /></button>
                  <button className="dept-icon-btn danger" title="Delete" onClick={() => { setError(''); setDeleteTarget(row) }}><Icon name="trash" size={15} /></button>
                </div>
              </div>

              <h3>{row.name}</h3>
              <span className="dept-code">{code}</span>
              <div className="dept-meta">{row.groups.length} Year{row.groups.length === 1 ? '' : 's'} &bull; {row.divisions} Division{row.divisions === 1 ? '' : 's'}</div>

              {row.groups.length ? (
                <div className="dept-year-list">
                  {YEARS.map(y => {
                    const g = row.groups.find(gr => gr.year_of_study === y)
                    if (!g) return null
                    return <div className="dept-year-row" key={y}><span>{yearLabel(y)}</span><b>{g.divisions.length} division{g.divisions.length === 1 ? '' : 's'}</b></div>
                  })}
                </div>
              ) : <div className="dept-empty-note">No years configured yet.</div>}
            </article>
          )
        }) : (
          <div className="empty-departments">
            <div className="empty-icon"><Icon name="building" size={22} /></div>
            <h3>{search ? 'No departments match your search' : 'No departments yet'}</h3>
            <p>{search ? 'Try a different name.' : 'Create your first department to begin.'}</p>
            {!search && <button className="primary-button" onClick={openCreate}><Icon name="plus" size={16} /> Create New Department</button>}
          </div>
        )}
      </section>

      {/* LEGACY CLASSES */}
      {legacyClasses.length > 0 && (
        <section className="legacy-section">
          <button className="legacy-strip" onClick={() => setLegacyOpen(!legacyOpen)}>
            <span className="legacy-icon"><Icon name="archive" size={18} /></span>
            <span><b>Legacy classes</b><small>{legacyClasses.length} older class record{legacyClasses.length === 1 ? '' : 's'} not linked to the current academic structure</small></span>
            <strong>{legacyOpen ? '\u2212' : '+'}</strong>
          </button>
          {legacyOpen && (
            <div className="legacy-panel">
              <div className="legacy-panel-head">
                <div><h3>Legacy data cleanup</h3><p>These records are not used by the new academic structure. Delete only when you are sure their old subjects and timetables are no longer needed.</p></div>
                <span>{legacyClasses.length}</span>
              </div>
              <div className="legacy-list">
                {legacyClasses.map(c => (
                  <div className="legacy-row" key={c.class_id}>
                    <div><b>{c.class_name}</b><small>Class ID {c.class_id} &middot; legacy record</small></div>
                    <button className="legacy-delete" onClick={() => { setError(''); setLegacyTarget(c) }}><Icon name="trash" size={15} /> Delete permanently</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal()}>
          <div className="academic-modal">
            <form onSubmit={isEdit ? submitEdit : submitCreate}>
              <div className="modal-header">
                <div className="modal-title">
                  <div className={`modal-icon ${isEdit ? 'edit' : ''}`}><Icon name={isEdit ? 'edit' : 'plus'} size={19} /></div>
                  <div>
                    <div className="academic-eyebrow">{isEdit ? 'EDIT DEPARTMENT' : 'NEW DEPARTMENT'}</div>
                    <h2>{isEdit ? 'Edit department' : 'Create new department'}</h2>
                    <p>Define the department and its divisions for each year.</p>
                  </div>
                </div>
                <button type="button" className="modal-close" onClick={closeModal}><Icon name="close" size={17} /></button>
              </div>

              <div className="modal-field-grid">
                <Field label="DEPARTMENT NAME">
                  <input autoFocus value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science" />
                </Field>
                <Field label="SHORT CODE (OPTIONAL)">
                  <input value={shortCode} onChange={e => setShortCode(e.target.value.toUpperCase())} placeholder="e.g. CS" maxLength={4} />
                </Field>
              </div>

              {!showAcademicYear ? (
                <button type="button" className="secondary-button" style={{ marginBottom: 8 }} onClick={() => setShowAcademicYear(true)}>
                  Academic year: {academicYear} (change)
                </button>
              ) : (
                <Field label="ACADEMIC YEAR">
                  <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" />
                </Field>
              )}

              <div className="modal-section-label">YEARS &amp; DIVISIONS</div>
              <div className="year-config-list">
                {YEARS.map(y => {
                  const locked = existingYears[y]
                  const enabled = !!locked || counts[y] > 0
                  return (
                    <div className={`year-config-row ${enabled ? 'enabled' : ''}`} key={y}>
                      <div className="year-config-head">
                        <label onClick={() => !locked && toggleYear(y)}>
                          <span className={`year-toggle ${enabled ? 'on' : ''}`} />
                          {yearLabel(y)}
                        </label>
                        <span className="year-division-count">
                          {locked ? `${locked.divisions.length} division${locked.divisions.length === 1 ? '' : 's'} · A\u2013${locked.divisions[locked.divisions.length - 1]?.division_name || 'A'}`
                            : enabled ? `${counts[y]} division${counts[y] === 1 ? '' : 's'} · A\u2013${letterAt(Math.max(0, counts[y] - 1))}` : 'Not configured'}
                        </span>
                      </div>

                      {locked && (
                        <>
                          <div className="chip-row">
                            {locked.divisions.map(d => <span className="division-chip locked" key={d.division_id}>{d.division_name}</span>)}
                          </div>
                          <div className="locked-note"><Icon name="info" size={12} /> Already created &mdash; resizing an existing year's divisions needs a small backend addition (see notes below). You can still rename the department or add a brand-new year here.</div>
                        </>
                      )}

                      {!locked && enabled && (
                        <div className="chip-row">
                          {Array.from({ length: counts[y] }).map((_, i) => (
                            <span className="division-chip" key={i}>
                              {letterAt(i)}
                              {i === counts[y] - 1 && <button type="button" onClick={() => removeChip(y)} aria-label="Remove division"><Icon name="close" size={10} /></button>}
                            </span>
                          ))}
                          <button type="button" className="add-chip-btn" disabled={counts[y] >= 26} onClick={() => addChip(y)}><Icon name="plus" size={13} /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {error && <div className="notice error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>Cancel</button>
                <button className="primary-button modal-primary"><Icon name="check" size={16} /> {isEdit ? 'Save changes' : 'Create Department'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DEPARTMENT CONFIRMATION */}
      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="danger-modal">
            <div className="danger-modal-icon"><Icon name="trash" size={20} /></div>
            <div className="academic-eyebrow danger-eyebrow">DELETE DEPARTMENT</div>
            <h2>Delete {deleteTarget.name}?</h2>
            <p>This will remove the department and its associated years and divisions. This action cannot be undone. (Existing class/subject/timetable records already tied to those divisions are preserved, not deleted.)</p>
            {error && <div className="notice error">{error}</div>}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => { setDeleteTarget(null); setError('') }}>Cancel</button>
              <button className="delete-confirm" onClick={confirmDeleteDepartment}><Icon name="trash" size={16} /> Delete Department</button>
            </div>
          </div>
        </div>
      )}

      {/* LEGACY DELETE CONFIRMATION */}
      {legacyTarget && (
        <div className="modal-backdrop">
          <div className="danger-modal">
            <div className="danger-modal-icon"><Icon name="trash" size={20} /></div>
            <div className="academic-eyebrow danger-eyebrow">PERMANENT DELETE</div>
            <h2>Delete {legacyTarget.class_name}?</h2>
            <p>This permanently removes the legacy class and its associated subjects, teacher assignments and timetable records. This action cannot be undone.</p>
            {error && <div className="notice error">{error}</div>}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => { setLegacyTarget(null); setError('') }}>Cancel</button>
              <button className="delete-confirm" onClick={deleteLegacy}><Icon name="trash" size={16} /> Delete permanently</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}