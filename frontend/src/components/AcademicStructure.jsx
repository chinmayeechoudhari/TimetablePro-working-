import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const years = [1, 2, 3, 4]
const label = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y])

export default function AcademicStructure() {
  const [academicYear, setAcademicYear] = useState('2026-27')
  const [department, setDepartment] = useState('')
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [groups, setGroups] = useState([])
  const [legacyClasses, setLegacyClasses] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [editName, setEditName] = useState('')
  const [linkingClass, setLinkingClass] = useState(null)
  const [linkForm, setLinkForm] = useState({ groupId: '', division: '' })

  async function load() {
    try {
      const data = (await axios.get(`${BASE}/academic-structure`)).data
      setGroups(data.groups || []); setLegacyClasses(data.legacy_classes || [])
    } catch { setError('Could not load academic structure.') }
  }
  useEffect(() => { load() }, [])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort((a, b) => a.localeCompare(b)), [groups])
  const departmentData = departments.map(name => {
    const rows = groups.filter(g => g.department === name)
    return { name, groups: rows, divisions: rows.reduce((n, g) => n + g.divisions.length, 0) }
  })
  const selectedGroup = groups.find(g => String(g.group_id) === String(linkForm.groupId))

  function openCreate() { setMessage(''); setError(''); setModal('create') }
  function closeModal() { setModal(null); setError('') }

  async function submit(e) {
    e.preventDefault(); setMessage(''); setError('')
    const selected = years.filter(y => counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim() || !academicYear.trim() || !selected.length) { setError('Enter department, academic year, and at least one year with divisions.'); return }
    try {
      const r = await axios.post(`${BASE}/academic-structure`, { academic_year: academicYear.trim(), department: department.trim(), years: selected })
      setMessage(r.data.message); setCounts({ 1: 0, 2: 0, 3: 0, 4: 0 }); setSelectedDepartment(department.trim()); closeModal(); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not create structure.') }
  }

  function openEdit(name) { setEditName(name); setError(''); setModal({ type: 'edit', name }) }
  async function saveEdit(e) {
    e.preventDefault(); if (!editName.trim()) return
    try {
      const r = await axios.put(`${BASE}/academic-structure/department`, { old_department: modal.name, new_department: editName.trim() })
      setMessage(r.data.message); setSelectedDepartment(editName.trim()); closeModal(); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not rename department.') }
  }

  async function removeDepartment(name) {
    if (!window.confirm(`Remove ${name} from the academic structure?\n\nExisting class records are preserved. This removes only its academic-group links.`)) return
    try {
      const r = await axios.delete(`${BASE}/academic-structure/department`, { params: { department: name } })
      setMessage(r.data.message); if (selectedDepartment === name) setSelectedDepartment(''); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not remove department.') }
  }

  function openLinker(item) { setLinkingClass(item); setLinkForm({ groupId: '', division: '' }); setError('') }
  async function linkExistingClass(e) {
    e.preventDefault(); const group = groups.find(g => String(g.group_id) === String(linkForm.groupId)); if (!linkingClass || !group || !linkForm.division) return
    try {
      const r = await axios.post(`${BASE}/academic-structure/adopt-class`, { class_id: linkingClass.class_id, academic_year: group.academic_year, department: group.department, year_of_study: group.year_of_study, division_name: linkForm.division })
      setMessage(r.data.message); setLinkingClass(null); setError(''); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not link existing class.') }
  }

  return <div className="academic-page">
    <section className="academic-hero">
      <div className="hero-copy"><div className="academic-eyebrow">ACADEMIC SETUP</div><h1>Academic Structure</h1><p>Build a clear hierarchy of departments, years and divisions for your timetable.</p></div>
      <div className="hero-metrics"><div><strong>{departments.length}</strong><span>Departments</span></div><i></i><div><strong>{groups.reduce((n, g) => n + g.divisions.length, 0)}</strong><span>Divisions</span></div></div>
    </section>

    {message && <div className="global-notice success">✓ {message}<button onClick={() => setMessage('')}>×</button></div>}
    {error && !modal && !linkingClass && <div className="global-notice error">! {error}</div>}

    <section className="workspace-head"><div><div className="section-kicker">YOUR ACADEMIC SETUP</div><h2>Departments</h2><p>Manage every department, its academic years and divisions.</p></div><button className="create-group-button" onClick={openCreate}><span>＋</span> Create new academic group</button></section>

    <section className="department-grid">
      {departmentData.length === 0 ? <div className="empty-departments"><div className="empty-icon">⌘</div><h3>No departments yet</h3><p>Create your first academic group to get started.</p><button className="create-group-button" onClick={openCreate}>Create academic group</button></div> : departmentData.map(dep => <article className="department-card-large" key={dep.name}>
        <div className="department-card-top"><div className="department-avatar">{dep.name.slice(0, 2).toUpperCase()}</div><div className="department-title"><h3>{dep.name}</h3><span>{dep.divisions} division{dep.divisions !== 1 ? 's' : ''} · {dep.groups.length} year{dep.groups.length !== 1 ? 's' : ''}</span></div><div className="card-actions"><button title="Edit department" onClick={() => openEdit(dep.name)}>✎</button><button className="danger" title="Remove department" onClick={() => removeDepartment(dep.name)}>⌫</button></div></div>
        <div className="department-years">{years.map(y => { const row = dep.groups.find(g => g.year_of_study === y); return <div className={`year-row ${row ? 'has-data' : ''}`} key={y}><span>{label(y)}</span>{row ? <div className="mini-divisions">{row.divisions.map(d => <b key={d.division_id}>{d.division_name}</b>)}</div> : <em>—</em>}</div> })}</div>
        <div className="department-footer"><span>Academic year</span><b>{dep.groups[0]?.academic_year || '—'}</b><button className="view-link" onClick={() => setSelectedDepartment(dep.name)}>{selectedDepartment === dep.name ? 'Selected' : 'View details'} →</button></div>
      </article>)}
    </section>

    {selectedDepartment && <section className="details-panel"><div><div className="section-kicker">DEPARTMENT VIEW</div><h2>{selectedDepartment}</h2><p>Quick view of the academic groups configured for this department.</p></div><div className="detail-pills">{groups.filter(g => g.department === selectedDepartment).map(g => <div key={g.group_id}><b>{label(g.year_of_study)}</b><span>{g.divisions.length} divisions</span></div>)}</div></section>}

    {legacyClasses.length > 0 && <section className="legacy-strip"><div><b>Existing classes need attention</b><p>Older classes are still safe. Link them to the new structure without deleting their existing records.</p></div><div className="legacy-count">{legacyClasses.length}</div><button className="secondary-button" onClick={() => document.getElementById('legacy-classes')?.scrollIntoView({ behavior: 'smooth' })}>Review →</button></section>}
    {legacyClasses.length > 0 && <section id="legacy-classes" className="legacy-card"><div className="section-heading"><span className="step-badge amber">!</span><div><h2>Existing classes</h2><p>Created by the previous workflow and preserved.</p></div></div><div className="legacy-list">{legacyClasses.map(item => <div className="legacy-row" key={item.class_id}><div><b>{item.class_name}</b><small>Existing class · ID {item.class_id}</small></div><button className="secondary-button" onClick={() => openLinker(item)}>Link class →</button></div>)}</div></section>}

    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal()}><div className="academic-modal">
      {modal === 'create' && <><div className="modal-header"><div><div className="modal-icon">＋</div><div><span className="academic-eyebrow">NEW ACADEMIC GROUP</span><h2>Create new academic group</h2><p>Add a department and configure how many divisions each year has.</p></div></div><button className="modal-close" onClick={closeModal}>×</button></div><form onSubmit={submit}><div className="modal-field-grid"><Field label="DEPARTMENT"><input autoFocus value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science" /></Field><Field label="ACADEMIC YEAR"><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" /></Field></div><div className="modal-section-label">DIVISIONS BY YEAR</div><div className="modal-year-grid">{years.map(y => <label className={`modal-year ${counts[y] ? 'selected' : ''}`} key={y}><span><b>{label(y)}</b><small>{counts[y] ? `${counts[y]} division${counts[y] > 1 ? 's' : ''}` : 'Not selected'}</small></span><input type="number" min="0" max="26" value={counts[y] || ''} onChange={e => setCounts({ ...counts, [y]: Number(e.target.value) })} placeholder="0" /></label>)}</div>{error && <div className="notice error">! {error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button">Create academic group →</button></div></form></>}
      {modal?.type === 'edit' && <form onSubmit={saveEdit}><div className="modal-header"><div><div className="modal-icon edit">✎</div><div><span className="academic-eyebrow">EDIT DEPARTMENT</span><h2>Rename department</h2><p>Update the department name across its academic groups.</p></div></div><button type="button" className="modal-close" onClick={closeModal}>×</button></div><Field label="DEPARTMENT NAME"><input autoFocus value={editName} onChange={e => setEditName(e.target.value)} /></Field>{error && <div className="notice error">! {error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button">Save changes →</button></div></form>}
    </div></div>}

    {linkingClass && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setLinkingClass(null)}><form className="academic-modal" onSubmit={linkExistingClass}><div className="modal-header"><div><div className="modal-icon amber">↗</div><div><span className="academic-eyebrow">RECOVER EXISTING CLASS</span><h2>Link {linkingClass.class_name}</h2><p>Your existing class and related records stay untouched.</p></div></div><button type="button" className="modal-close" onClick={() => setLinkingClass(null)}>×</button></div><Field label="ACADEMIC GROUP"><select value={linkForm.groupId} onChange={e => setLinkForm({ groupId: e.target.value, division: '' })} required><option value="">Select department & year</option>{groups.map(g => <option key={g.group_id} value={g.group_id}>{g.department} · {label(g.year_of_study)} · {g.academic_year}</option>)}</select></Field><Field label="DIVISION"><select value={linkForm.division} onChange={e => setLinkForm({ ...linkForm, division: e.target.value })} required disabled={!linkForm.groupId}><option value="">Select division</option>{selectedGroup?.divisions.map(d => <option key={d.division_id} value={d.division_name}>{d.division_name}</option>)}</select></Field>{error && <div className="notice error">! {error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setLinkingClass(null)}>Cancel</button><button className="create-group-button">Link existing class →</button></div></form></div>}
  </div>
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
