import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructureModern.css'

const BASE = 'http://localhost:8000'
const years = [1, 2, 3, 4]
const label = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y])

function Icon({ name, size = 18, stroke = 1.9 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    building: <><path d="M3 21h18"/><path d="M5 21V6l7-3 7 3v15"/><path d="M8 9h1M12 9h1M16 9h1M8 12h1M12 12h1M16 12h1M8 15h1M12 15h1M16 15h1"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 7.5 3 3"/></>,
    trash: <><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    archive: <><path d="M4 7h16"/><path d="M6 7v13h12V7"/><path d="M9 11h6"/><path d="m9 4 6 0 1 3H8l1-3Z"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

export default function AcademicStructureV2() {
  const [academicYear, setAcademicYear] = useState('2026-27')
  const [department, setDepartment] = useState('')
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [groups, setGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [editName, setEditName] = useState('')
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [legacyTarget, setLegacyTarget] = useState(null)

  async function load() {
    try {
      const [structure, classResponse] = await Promise.all([axios.get(`${BASE}/academic-structure`), axios.get(`${BASE}/classes`)])
      setGroups(structure.data.groups || [])
      setClasses(classResponse.data || [])
    } catch { setError('Could not load academic structure.') }
  }
  useEffect(() => { load() }, [])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const departmentRows = useMemo(() => departments.map(name => { const rows = groups.filter(g => g.department === name); return { name, groups: rows, divisions: rows.reduce((n, g) => n + g.divisions.length, 0), academicYear: rows[0]?.academic_year || '—' } }), [departments, groups])
  const visible = selectedDepartment ? departmentRows.filter(d => d.name === selectedDepartment) : departmentRows
  const selected = departmentRows.find(d => d.name === selectedDepartment)
  const activeClassIds = useMemo(() => new Set(groups.flatMap(g => (g.divisions || []).map(v => v.class_id).filter(Boolean))), [groups])
  const legacyClasses = useMemo(() => classes.filter(c => !activeClassIds.has(c.class_id)), [classes, activeClassIds])
  const totalDivisions = departmentRows.reduce((n, d) => n + d.divisions, 0)
  const closeModal = () => { setModal(null); setError('') }

  async function create(e) {
    e.preventDefault(); const yearConfigs = years.filter(y => counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim() || !academicYear.trim() || !yearConfigs.length) return setError('Enter the department, academic year, and at least one year with divisions.')
    try { const response = await axios.post(`${BASE}/academic-structure`, { academic_year: academicYear.trim(), department: department.trim(), years: yearConfigs }); setMessage(response.data.message); setCounts({1:0,2:0,3:0,4:0}); setDepartment(''); closeModal(); await load() } catch (e) { setError(e.response?.data?.detail || 'Could not create academic structure.') }
  }
  async function rename(e) { e.preventDefault(); if (!editName.trim()) return; try { const response = await axios.put(`${BASE}/academic-structure/department`, { old_department: modal.name, new_department: editName.trim() }); setMessage(response.data.message); closeModal(); await load() } catch (e) { setError(e.response?.data?.detail || 'Could not rename department.') } }
  async function removeDepartment(name) { if (!window.confirm(`Remove ${name} from the academic structure?`)) return; try { const response = await axios.delete(`${BASE}/academic-structure/department`, { params: { department: name } }); setMessage(response.data.message); if (selectedDepartment === name) setSelectedDepartment(''); await load() } catch (e) { setError(e.response?.data?.detail || 'Could not remove department.') } }
  async function deleteLegacy() { if (!legacyTarget) return; try { await axios.delete(`${BASE}/classes/${legacyTarget.class_id}`); setMessage(`${legacyTarget.class_name} was permanently deleted.`); setLegacyTarget(null); await load() } catch (e) { setError(e.response?.data?.detail || 'Could not delete legacy class.') } }

  return <div className="academic-page">
    <section className="academic-hero"><div className="hero-copy"><div className="academic-eyebrow">ACADEMIC SCHEDULING</div><h1>Academic Structure</h1><p>Set up departments, years and divisions before subjects, faculty assignments and timetable generation.</p></div><div className="hero-metrics"><div><strong>{departments.length}</strong><span>Departments</span></div><i/><div><strong>{totalDivisions}</strong><span>Divisions</span></div></div></section>
    {message && <div className="global-notice success"><Icon name="check" size={16}/>{message}<button onClick={() => setMessage('')}><Icon name="close" size={15}/></button></div>}
    {error && !modal && !legacyTarget && <div className="global-notice error">{error}<button onClick={() => setError('')}><Icon name="close" size={15}/></button></div>}
    <section className="workspace-head"><div><div className="section-kicker">YOUR ACADEMIC SETUP</div><h2>Departments</h2><p>Manage departments and their divisions for each year.</p></div><button className="create-group-button" onClick={() => { setError(''); setModal('create') }}><Icon name="plus" size={17}/> Create new academic group</button></section>
    <section className="department-table-wrap"><div className="department-table-head"><span>DEPARTMENT</span><span>ACADEMIC YEAR</span><span>YEARS & DIVISIONS</span><span>ACTIONS</span></div>{visible.length ? visible.map(d => <article className="department-row" key={d.name}><div className="department-cell department-main-cell"><div className="department-avatar">{d.name.slice(0,2).toUpperCase()}</div><div><h3>{d.name}</h3><span>{d.divisions} divisions · {d.groups.length} years configured</span></div></div><div className="department-cell academic-year-cell"><b>{d.academicYear}</b><span>Active</span></div><div className="department-cell year-divisions-cell">{years.map(y => { const group = d.groups.find(g => g.year_of_study === y); return <div className="year-block" key={y}><span>{label(y)}</span><div>{group?.divisions.map(v => <b key={v.division_id}>{v.division_name}</b>)}{!group && <em>—</em>}</div></div> })}</div><div className="department-cell row-actions"><button title="Edit" onClick={() => { setEditName(d.name); setError(''); setModal({type:'edit',name:d.name}) }}><Icon name="edit" size={16}/></button><button className="danger" title="Remove" onClick={() => removeDepartment(d.name)}><Icon name="trash" size={16}/></button><button className="view-action" title="View" onClick={() => setSelectedDepartment(selectedDepartment === d.name ? '' : d.name)}><Icon name="chevron" size={19}/></button></div></article>) : <div className="empty-departments"><div className="empty-icon"><Icon name="building" size={22}/></div><h3>No departments yet</h3><p>Create your first academic group to begin.</p><button className="create-group-button" onClick={() => setModal('create')}><Icon name="plus" size={17}/> Create academic group</button></div>}</section>
    {selected && <section className="details-panel"><div><div className="section-kicker">DEPARTMENT VIEW</div><h2>{selected.name}</h2><p>{selected.academicYear} · {selected.divisions} divisions</p></div><div className="detail-pills">{selected.groups.map(g => <div key={g.group_id}><b>{label(g.year_of_study)}</b><span>{g.divisions.map(v => v.division_name).join(', ')}</span></div>)}</div></section>}
    {legacyClasses.length > 0 && <section className="legacy-section"><button className="legacy-strip" onClick={() => setLegacyOpen(!legacyOpen)}><span className="legacy-icon"><Icon name="archive" size={18}/></span><span><b>Legacy classes</b><small>{legacyClasses.length} older class record{legacyClasses.length === 1 ? '' : 's'} not linked to the current academic structure</small></span><strong>{legacyOpen ? '−' : '+'}</strong></button>{legacyOpen && <div className="legacy-panel"><div className="legacy-panel-head"><div><h3>Legacy data cleanup</h3><p>These records are not used by the new academic structure. Delete only when you are sure their old subjects and timetables are no longer needed.</p></div><span>{legacyClasses.length}</span></div><div className="legacy-list">{legacyClasses.map(c => <div className="legacy-row" key={c.class_id}><div><b>{c.class_name}</b><small>Class ID {c.class_id} · legacy record</small></div><button className="legacy-delete" onClick={() => { setError(''); setLegacyTarget(c) }}><Icon name="trash" size={15}/> Delete permanently</button></div>)}</div></div>}</section>}
    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal()}><div className="academic-modal">{modal === 'create' ? <><div className="modal-header"><div className="modal-title"><div className="modal-icon"><Icon name="plus" size={20}/></div><div><div className="academic-eyebrow">NEW ACADEMIC GROUP</div><h2>Create academic group</h2><p>Define the department and its divisions for each year.</p></div></div><button className="modal-close" onClick={closeModal}><Icon name="close" size={17}/></button></div><form onSubmit={create}><div className="modal-field-grid"><Field label="DEPARTMENT"><input autoFocus value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science"/></Field><Field label="ACADEMIC YEAR"><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27"/></Field></div><div className="modal-section-label">DIVISIONS BY YEAR</div><div className="modal-year-grid">{years.map(y => <label className={`modal-year ${counts[y] ? 'selected':''}`} key={y}><span><b>{label(y)}</b><small>{counts[y] ? `${counts[y]} divisions · A–${String.fromCharCode(64+counts[y])}` : 'Not configured'}</small></span><input type="number" min="0" max="26" value={counts[y] || ''} onChange={e => setCounts({...counts,[y]:Number(e.target.value)})} placeholder="0"/></label>)}</div>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button modal-primary"><Icon name="check" size={16}/> Create academic group</button></div></form></> : <form onSubmit={rename}><div className="modal-header"><div className="modal-title"><div className="modal-icon edit"><Icon name="edit" size={18}/></div><div><div className="academic-eyebrow">EDIT DEPARTMENT</div><h2>Rename department</h2><p>Update the department name for all of its academic groups.</p></div></div><button type="button" className="modal-close" onClick={closeModal}><Icon name="close" size={17}/></button></div><Field label="DEPARTMENT NAME"><input autoFocus value={editName} onChange={e => setEditName(e.target.value)}/></Field>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button modal-primary"><Icon name="check" size={16}/> Save changes</button></div></form>}</div></div>}
    {legacyTarget && <div className="modal-backdrop"><div className="danger-modal"><div className="danger-modal-icon"><Icon name="trash" size={20}/></div><div className="academic-eyebrow danger-eyebrow">PERMANENT DELETE</div><h2>Delete {legacyTarget.class_name}?</h2><p>This permanently removes the legacy class and its associated subjects, teacher assignments and timetable records. This action cannot be undone.</p>{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button className="secondary-button" onClick={() => { setLegacyTarget(null); setError('') }}>Cancel</button><button className="delete-confirm" onClick={deleteLegacy}><Icon name="trash" size={16}/> Delete permanently</button></div></div></div>}
  </div>
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label> }
