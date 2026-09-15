import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructureModern.css'
import { loadShortCodes, saveShortCode, deriveShortCode, accentIndex } from '../lib/academicShortCodes'
import Icon from './AcademicIcon'

const BASE = 'http://localhost:8000'
const YEARS = [1, 2, 3, 4]
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y])
const letterAt = i => String.fromCharCode(65 + i)
function defaultAcademicYear() {
  const now = new Date()
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${String(start + 1).slice(-2)}`
}
function emptyYearConfig() { return { 1: 0, 2: 0, 3: 0, 4: 0 } }

export default function AcademicStructureV2() {
  const [groups, setGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [shortCodes, setShortCodes] = useState(loadShortCodes)

  const [modal, setModal] = useState(null)
  const [department, setDepartment] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear())
  const [showAcademicYear, setShowAcademicYear] = useState(false)
  const [counts, setCounts] = useState(emptyYearConfig)
  const [existingYears, setExistingYears] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [legacyOpen, setLegacyOpen] = useState(false)
  const [legacyTarget, setLegacyTarget] = useState(null)
  const [selectedLegacyIds, setSelectedLegacyIds] = useState([])
  const [legacyBulkTarget, setLegacyBulkTarget] = useState(false)

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
    return { name, groups: rows, divisions: rows.reduce((n, g) => n + g.divisions.length, 0), academicYear: rows[0]?.academic_year || defaultAcademicYear() }
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
  const allLegacySelected = legacyClasses.length > 0 && selectedLegacyIds.length === legacyClasses.length

  function closeModal() {
    setModal(null); setError('')
    setDepartment(''); setShortCode(''); setCounts(emptyYearConfig())
    setExistingYears({}); setShowAcademicYear(false); setAcademicYear(defaultAcademicYear())
  }
  function openCreate() {
    setError(''); setMessage(''); setDepartment(''); setShortCode(''); setCounts(emptyYearConfig())
    setExistingYears({}); setAcademicYear(defaultAcademicYear()); setShowAcademicYear(false); setModal('create')
  }
  function openEdit(row) {
    setError(''); setMessage(''); setDepartment(row.name); setShortCode(shortCodes[row.name] || '')
    setAcademicYear(row.academicYear); setShowAcademicYear(false)
    const locked = {}; row.groups.forEach(g => { locked[g.year_of_study] = g })
    setExistingYears(locked); setCounts(emptyYearConfig()); setModal({ type: 'edit', name: row.name })
  }
  function toggleYear(year) {
    if (existingYears[year]) return
    setCounts(c => ({ ...c, [year]: c[year] > 0 ? 0 : 1 }))
  }
  function addChip(year) { setCounts(c => ({ ...c, [year]: Math.min(26, (c[year] || 0) + 1) })) }
  function removeChip(year) { setCounts(c => ({ ...c, [year]: Math.max(0, (c[year] || 0) - 1) })) }

  function toggleLegacy(id) {
    setSelectedLegacyIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }
  function toggleAllLegacy() {
    setSelectedLegacyIds(allLegacySelected ? [] : legacyClasses.map(c => c.class_id))
  }
  async function deleteLegacyIds(ids) {
    if (!ids.length) return
    try {
      for (const id of ids) await axios.delete(`${BASE}/classes/${id}`)
      const removed = new Set(ids)
      setSelectedLegacyIds([]); setLegacyBulkTarget(false); setLegacyTarget(null)
      setMessage(`${ids.length} legacy class${ids.length === 1 ? '' : 'es'} permanently deleted.`)
      setClasses(prev => prev.filter(c => !removed.has(c.class_id)))
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete the selected legacy classes.')
    }
  }
  async function deleteLegacy() {
    if (!legacyTarget) return
    await deleteLegacyIds([legacyTarget.class_id])
  }

  async function submitCreate(e) {
    e.preventDefault()
    const yearConfigs = YEARS.filter(y => counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim()) return setError('Enter the department name.')
    if (!yearConfigs.length) return setError('Enable at least one year and add its divisions.')
    try {
      const res = await axios.post(`${BASE}/academic-structure`, { academic_year: academicYear.trim() || defaultAcademicYear(), department: department.trim(), years: yearConfigs })
      saveShortCode(department.trim(), shortCode.trim()); setShortCodes(loadShortCodes())
      setMessage(res.data.message || `${department.trim()} was created.`); closeModal(); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not create the department.') }
  }
  async function submitEdit(e) {
    e.preventDefault()
    const originalName = modal.name; const newName = department.trim()
    if (!newName) return setError('Department name cannot be empty.')
    const newYearConfigs = YEARS.filter(y => !existingYears[y] && counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    try {
      if (newName !== originalName) await axios.put(`${BASE}/academic-structure/department`, { old_department: originalName, new_department: newName })
      if (newYearConfigs.length) await axios.post(`${BASE}/academic-structure`, { academic_year: academicYear.trim() || defaultAcademicYear(), department: newName, years: newYearConfigs })
      saveShortCode(newName, shortCode.trim()); if (newName !== originalName) saveShortCode(originalName, '')
      setShortCodes(loadShortCodes()); setMessage(`${newName} was updated.`); closeModal(); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not update the department.') }
  }
  async function confirmDeleteDepartment() {
    if (!deleteTarget) return
    try {
      const res = await axios.delete(`${BASE}/academic-structure/department`, { params: { department: deleteTarget.name } })
      saveShortCode(deleteTarget.name, ''); setShortCodes(loadShortCodes()); setMessage(res.data.message); setDeleteTarget(null); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not remove the department.') }
  }
  const isEdit = modal && modal.type === 'edit'

  return (
    <div className={`academic-page ${modal ? 'academic-page-modal-open' : ''}`}>
      <section className="academic-hero">
        <svg className="academic-hero-watermark" viewBox="0 0 620 220" fill="none" aria-hidden="true">
          <path d="M70 185V92l105-58 105 58v93" stroke="currentColor" strokeWidth="2" /><path d="M112 185v-58h54v58M203 185v-58h54v58" stroke="currentColor" strokeWidth="2" /><path d="M145 92h60M145 116h60" stroke="currentColor" strokeWidth="2" /><path d="M315 185V62l85-43 85 43v123" stroke="currentColor" strokeWidth="2" /><path d="M350 185v-55h38v55M407 185v-55h38v55" stroke="currentColor" strokeWidth="2" /><path d="M368 82h64M368 105h64" stroke="currentColor" strokeWidth="2" /><path d="M40 185h540" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="hero-left"><div className="hero-icon"><Icon name="building" size={30} stroke={1.7} /></div><div><div className="academic-eyebrow">ACADEMIC STRUCTURE</div><h1>Departments</h1><div className="hero-subtitle">Manage Departments &amp; Divisions</div><p>Each department can hold multiple years of study, and every year can have its own set of divisions.</p></div></div>
        <button className="primary-button hero-add-button" onClick={openCreate}><Icon name="plus" size={18} /> Create New Department</button>
      </section>

      <section className="academic-stats">
        <div className="stat-card stat-blue"><div className="stat-icon"><Icon name="building" size={24} /></div><div><div className="stat-label">TOTAL DEPARTMENTS</div><div className="stat-number">{departmentRows.length}</div></div><StatSpark color="#2563eb" id="dept" /></div>
        <div className="stat-card stat-green"><div className="stat-icon"><Icon name="layers" size={24} /></div><div><div className="stat-label">TOTAL YEARS</div><div className="stat-number">{totalYears}</div></div><StatSpark color="#10b981" id="years" /></div>
        <div className="stat-card stat-purple"><div className="stat-icon"><Icon name="grid" size={24} /></div><div><div className="stat-label">TOTAL DIVISIONS</div><div className="stat-number">{totalDivisions}</div></div><StatSpark color="#a855f7" id="divs" /></div>
      </section>

      {message && <div className="global-notice success"><Icon name="check" size={16} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={15} /></button></div>}
      {error && !modal && !deleteTarget && !legacyTarget && !legacyBulkTarget && <div className="global-notice error">{error}<button onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}

      <section className="dept-directory-card"><div className="dept-directory-head"><div><div className="section-kicker">DEPARTMENT DIRECTORY</div><div className="dept-directory-title-row"><div className="dept-directory-icon"><Icon name="building" size={22} /></div><div><h2>Departments</h2><p>{departmentRows.length} department{departmentRows.length === 1 ? '' : 's'} configured for {academicYear}</p></div></div></div><div className="dept-search"><Icon name="search" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments..." />{search && <button onClick={() => setSearch('')} style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}><Icon name="close" size={14} /></button>}</div></div></section>

      <section className="dept-grid">
        {filteredRows.length ? filteredRows.map(row => {
          const accent = accentIndex(row.name); const code = shortCodes[row.name] || deriveShortCode(row.name)
          return <article className={`dept-card accent-${accent}`} key={row.name}>
            <div className="dept-card-top"><div className="dept-avatar">{code.slice(0, 2)}</div><div className="dept-card-actions"><button className="dept-icon-btn" title="Edit" onClick={() => openEdit(row)}><Icon name="edit" size={15} /></button><button className="dept-icon-btn danger" title="Delete" onClick={() => { setError(''); setDeleteTarget(row) }}><Icon name="trash" size={15} /></button></div></div>
            <h3>{row.name}</h3><span className="dept-code">{code}</span><div className="dept-meta">{row.groups.length} Year{row.groups.length === 1 ? '' : 's'} &bull; {row.divisions} Division{row.divisions === 1 ? '' : 's'}</div>
            {row.groups.length ? <div className="dept-year-list">{YEARS.map(y => { const g = row.groups.find(gr => gr.year_of_study === y); if (!g) return null; return <div className="dept-year-row" key={y}><span>{yearLabel(y)}</span><b>{g.divisions.length} division{g.divisions.length === 1 ? '' : 's'}</b></div> })}</div> : <div className="dept-empty-note">No years configured yet.</div>}
          </article>
        }) : <div className="empty-departments"><div className="empty-icon"><Icon name="building" size={18} /></div><h3>{search ? 'No departments match your search' : 'No departments yet'}</h3><p>{search ? 'Try a different name.' : 'Create your first department to begin.'}</p></div>}
      </section>

      {legacyClasses.length > 0 && <section className="legacy-section">
        <button className="legacy-strip" onClick={() => setLegacyOpen(!legacyOpen)}>
          <span className="legacy-icon"><Icon name="archive" size={18} /></span>
          <span className="legacy-strip-copy"><b>Legacy classes</b><small>{legacyClasses.length} older class record{legacyClasses.length === 1 ? '' : 's'} not linked to the current academic structure</small></span>
          <span className="legacy-count">{legacyClasses.length} remaining</span><strong>{legacyOpen ? '\u2212' : '+'}</strong>
        </button>
        {legacyOpen && <div className="legacy-panel">
          <div className="legacy-panel-head"><div><div className="legacy-kicker">LEGACY DATA CLEANUP</div><h3>Remove old classes</h3><p>These records are not linked to the current academic structure. Select one or more classes to permanently remove them.</p></div><span className="legacy-status"><Icon name="archive" size={13} /> {legacyClasses.length} old records</span></div>
          <div className="legacy-bulk-bar">
            <label className="legacy-select-all"><input type="checkbox" checked={allLegacySelected} onChange={toggleAllLegacy} /><span className="legacy-checkbox" /><b>Select all</b><span>{selectedLegacyIds.length} selected</span></label>
            <span className="legacy-divider" />
            <button className="legacy-bulk-delete" disabled={!selectedLegacyIds.length} onClick={() => { setError(''); setLegacyBulkTarget(true) }}><Icon name="trash" size={14} /> Remove selected</button>
            <span className="legacy-bulk-help">Deletion is permanent.</span>
          </div>
          <div className="legacy-list">
            {legacyClasses.map(c => <div className={`legacy-row ${selectedLegacyIds.includes(c.class_id) ? 'selected' : ''}`} key={c.class_id}>
              <label className="legacy-row-check"><input type="checkbox" checked={selectedLegacyIds.includes(c.class_id)} onChange={() => toggleLegacy(c.class_id)} /><span className="legacy-checkbox" /></label>
              <div className="legacy-row-main"><b>{c.class_name}</b><small>Class ID {c.class_id} &middot; legacy record</small></div>
              <button className="legacy-delete" onClick={() => { setError(''); setLegacyTarget(c) }}><Icon name="trash" size={14} /> Remove</button>
            </div>)}
          </div>
        </div>}
      </section>}

      {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal()}>
        <div className={`academic-modal ${modal === 'create' ? 'create-mode' : 'edit-mode'}`}>
          <form onSubmit={isEdit ? submitEdit : submitCreate}>
            <div className="modal-topbar"><button type="button" className="modal-back-button" onClick={closeModal}><Icon name="arrow-left" size={15} /> Back</button><span className="modal-topbar-note">Academic Structure / {isEdit ? 'Edit Department' : 'New Department'}</span></div>
            <div className="modal-header"><div className="modal-title"><div className={`modal-icon ${isEdit ? 'edit' : ''}`}><Icon name={isEdit ? 'edit' : 'plus'} size={22} /></div><div><div className="academic-eyebrow">{isEdit ? 'EDIT DEPARTMENT' : 'NEW DEPARTMENT'}</div><h2>{isEdit ? 'Edit department' : 'Create new department'}</h2><p>Set up the department details and configure its years and divisions.</p></div></div><button type="button" className="modal-close" onClick={closeModal}><Icon name="close" size={17} /></button></div>
            <div className="modal-content-grid">
              <section className="modal-form-card">
                <div className="modal-card-heading"><div className="modal-card-icon blue"><Icon name="building" size={19} /></div><div><h3>Department details</h3><p>Enter the basic information for this department.</p></div></div>
                <Field label="DEPARTMENT NAME"><input autoFocus value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science & Engineering" /></Field>
                <Field label="SHORT CODE (OPTIONAL)"><input value={shortCode} onChange={e => setShortCode(e.target.value.toUpperCase())} placeholder="e.g. CSE" maxLength={4} /></Field>
                <div className="field-help">A short code is used on department cards and timetable labels.</div>
                <div className="modal-card-divider" />
                <div className="academic-year-block"><div className="modal-card-icon purple"><Icon name="calendar" size={18} /></div><div className="academic-year-content"><b>Academic year</b>{!showAcademicYear ? <button type="button" onClick={() => setShowAcademicYear(true)}>Current academic year <span>{academicYear}</span> · Change</button> : <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" />}</div></div>
              </section>
              <section className="modal-form-card divisions-card">
                <div className="modal-card-heading"><div className="modal-card-icon purple"><Icon name="grid" size={19} /></div><div><h3>Years &amp; divisions</h3><p>Enable the years this department offers and set the number of divisions.</p></div></div>
                <div className="year-config-list">
                  {YEARS.map(y => { const locked = existingYears[y]; const enabled = !!locked || counts[y] > 0; return <div className={`year-config-row year-color-${y} ${enabled ? 'enabled' : ''}`} key={y}>
                    <div className="year-config-head"><label onClick={() => !locked && toggleYear(y)}><span className="year-number">{y}</span><span><strong>{yearLabel(y)}</strong><small>{locked ? 'Already configured' : enabled ? 'Ready to configure divisions' : 'Not configured'}</small></span></label><div className="division-controls">{locked ? <span className="year-division-count">{locked.divisions.length} division{locked.divisions.length === 1 ? '' : 's'}</span> : <div className="year-controls"><span className="division-label">DIVISIONS</span><div className="division-stepper"><button type="button" disabled={!enabled || counts[y] <= 1} onClick={() => removeChip(y)}>−</button><b>{enabled ? counts[y] : 0}</b><button type="button" disabled={counts[y] >= 26} onClick={() => addChip(y)}>+</button></div></div>}</div></div>
                    {locked ? <><div className="chip-row">{locked.divisions.map(d => <span className="division-chip locked" key={d.division_id}>{d.division_name}</span>)}</div><div className="locked-note"><Icon name="info" size={12} /> Existing divisions are locked; you can still rename the department or add a new year.</div></> : enabled && <div className="chip-row">{Array.from({ length: counts[y] }).map((_, i) => <span className="division-chip" key={i}>{letterAt(i)}</span>)}</div>}
                  </div> })}
                </div>
              </section>
            </div>
            {error && <div className="notice error modal-inline-error">{error}</div>}
            <div className="modal-actions modal-footer-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="primary-button modal-primary"><Icon name="check" size={16} /> {isEdit ? 'Save changes' : 'Create Department'}</button></div>
          </form>
        </div>
      </div>}

      {deleteTarget && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDeleteTarget(null)}><div className="danger-modal"><div className="danger-modal-icon"><Icon name="trash" size={20} /></div><div className="academic-eyebrow danger-eyebrow">DELETE DEPARTMENT</div><h2>Delete {deleteTarget.name}?</h2><p>This will remove the department and its associated years and divisions. This action cannot be undone. (Existing class/subject/timetable records already tied to those divisions are preserved, not deleted.)</p>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button className="secondary-button" onClick={() => { setDeleteTarget(null); setError('') }}>Cancel</button><button className="delete-confirm" onClick={confirmDeleteDepartment}><Icon name="trash" size={16} /> Delete Department</button></div></div></div>}

      {legacyTarget && <div className="modal-backdrop"><div className="danger-modal"><div className="danger-modal-icon"><Icon name="trash" size={20} /></div><div className="academic-eyebrow danger-eyebrow">PERMANENT DELETE</div><h2>Remove {legacyTarget.class_name}?</h2><p>This permanently removes the legacy class and its associated subjects, teacher assignments and timetable records. This action cannot be undone.</p>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button className="secondary-button" onClick={() => { setLegacyTarget(null); setError('') }}>Cancel</button><button className="delete-confirm" onClick={deleteLegacy}><Icon name="trash" size={16} /> Remove permanently</button></div></div></div>}

      {legacyBulkTarget && <div className="modal-backdrop"><div className="danger-modal"><div className="danger-modal-icon"><Icon name="trash" size={20} /></div><div className="academic-eyebrow danger-eyebrow">REMOVE SELECTED</div><h2>Remove {selectedLegacyIds.length} legacy classes?</h2><p>This will permanently remove the selected legacy class records and their associated subjects, teacher assignments and timetable records. This action cannot be undone.</p>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button className="secondary-button" onClick={() => { setLegacyBulkTarget(false); setError('') }}>Cancel</button><button className="delete-confirm" onClick={() => deleteLegacyIds(selectedLegacyIds)}><Icon name="trash" size={16} /> Remove selected</button></div></div></div>}
    </div>
  )
}

function StatSpark({ color, id }) {
  const gid = `as-spark-${id}`
  return <div className="stat-decoration"><svg width="110" height="38" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} /><path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill={`url(#${gid})`} style={{ opacity: 0.15 }} /><defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="transparent" /></linearGradient></defs></svg></div>
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
