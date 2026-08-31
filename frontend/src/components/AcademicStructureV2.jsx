import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructure.css'
import './AcademicStructureModern.css'

const BASE = 'http://localhost:8000'
const years = [1, 2, 3, 4]
const label = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y])

export default function AcademicStructureV2() {
  const [academicYear, setAcademicYear] = useState('2026-27')
  const [department, setDepartment] = useState('')
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [groups, setGroups] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [editName, setEditName] = useState('')

  async function load() {
    try {
      const data = (await axios.get(`${BASE}/academic-structure`)).data
      setGroups(data.groups || [])
    } catch {
      setError('Could not load academic structure.')
    }
  }
  useEffect(() => { load() }, [])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const data = departments.map(name => {
    const rows = groups.filter(g => g.department === name)
    return { name, groups: rows, divisions: rows.reduce((n, g) => n + g.divisions.length, 0), academicYear: rows[0]?.academic_year || '—' }
  })
  const selected = data.find(d => d.name === selectedDepartment)
  const closeModal = () => { setModal(null); setError('') }

  async function create(e) {
    e.preventDefault()
    const selectedYears = years.filter(y => counts[y] > 0).map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim() || !academicYear.trim() || !selectedYears.length) {
      setError('Enter department, academic year, and at least one year with divisions.')
      return
    }
    try {
      const response = await axios.post(`${BASE}/academic-structure`, { academic_year: academicYear.trim(), department: department.trim(), years: selectedYears })
      setMessage(response.data.message)
      setCounts({ 1: 0, 2: 0, 3: 0, 4: 0 }); setDepartment(''); closeModal(); await load()
    } catch (e) { setError(e.response?.data?.detail || 'Could not create academic structure.') }
  }

  async function rename(e) {
    e.preventDefault(); if (!editName.trim()) return
    try {
      const response = await axios.put(`${BASE}/academic-structure/department`, { old_department: modal.name, new_department: editName.trim() })
      setMessage(response.data.message); closeModal(); await load()
    } catch (e) { setError(e.response?.data?.detail || 'Could not rename department.') }
  }

  async function remove(name) {
    if (!window.confirm(`Remove ${name} from the academic structure?`)) return
    try {
      const response = await axios.delete(`${BASE}/academic-structure/department`, { params: { department: name } })
      setMessage(response.data.message); if (selectedDepartment === name) setSelectedDepartment(''); await load()
    } catch (e) { setError(e.response?.data?.detail || 'Could not remove department.') }
  }

  return <div className="academic-page">
    <section className="academic-hero">
      <div className="hero-copy"><div className="academic-eyebrow">ACADEMIC SETUP</div><h1>Academic Structure</h1><p>Set up departments, years and divisions before adding subjects and faculty assignments.</p></div>
      <div className="hero-metrics"><div><strong>{departments.length}</strong><span>Departments</span></div><i/><div><strong>{data.reduce((n, d) => n + d.divisions, 0)}</strong><span>Divisions</span></div></div>
    </section>
    {message && <div className="global-notice success">✓ {message}<button onClick={() => setMessage('')}>×</button></div>}
    {error && !modal && <div className="global-notice error">! {error}<button onClick={() => setError('')}>×</button></div>}

    <section className="workspace-head"><div><div className="section-kicker">YOUR ACADEMIC SETUP</div><h2>Departments</h2><p>Manage departments and their divisions for each year.</p></div><button className="create-group-button" onClick={() => { setError(''); setModal('create') }}><span>＋</span>Create new academic group</button></section>

    <section className="department-table-wrap">
      <div className="department-table-head"><span>DEPARTMENT</span><span>ACADEMIC YEAR</span><span>YEARS & DIVISIONS</span><span>ACTIONS</span></div>
      {data.length ? data.map(d => <article className="department-row" key={d.name}>
        <div className="department-cell department-main-cell"><div className="department-avatar">{d.name.slice(0,2).toUpperCase()}</div><div><h3>{d.name}</h3><span>{d.divisions} divisions · {d.groups.length} years configured</span></div></div>
        <div className="department-cell academic-year-cell"><b>{d.academicYear}</b><span>Active</span></div>
        <div className="department-cell year-divisions-cell">{years.map(y => { const group = d.groups.find(g => g.year_of_study === y); return <div className="year-block" key={y}><span>{label(y)}</span><div>{group?.divisions.map(v => <b key={v.division_id}>{v.division_name}</b>)}{!group && <em>—</em>}</div></div> })}</div>
        <div className="department-cell row-actions"><button title="Edit department" onClick={() => { setEditName(d.name); setError(''); setModal({ type:'edit', name:d.name }) }}>✎</button><button className="danger" title="Remove department" onClick={() => remove(d.name)}>⌫</button><button className="view-action" title="View details" onClick={() => setSelectedDepartment(selectedDepartment === d.name ? '' : d.name)}>›</button></div>
      </article>) : <div className="empty-departments"><div className="empty-icon">⌘</div><h3>No departments yet</h3><p>Create your first academic group to start building the timetable structure.</p><button className="create-group-button" onClick={() => setModal('create')}>Create academic group</button></div>}
    </section>

    {selected && <section className="details-panel"><div><div className="section-kicker">DEPARTMENT VIEW</div><h2>{selected.name}</h2><p>{selected.academicYear} · {selected.divisions} divisions</p></div><div className="detail-pills">{selected.groups.map(g => <div key={g.group_id}><b>{label(g.year_of_study)}</b><span>{g.divisions.map(v => v.division_name).join(', ')}</span></div>)}</div></section>}
    <section className="structure-note"><div className="note-icon">✦</div><div><b>How this structure is used</b><p>Subjects added for a department and year are shared by all divisions of that year. Each division receives its own timetable during generation.</p></div></section>

    {modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeModal()}><div className="academic-modal">
      {modal === 'create' ? <><div className="modal-header"><div><div className="modal-icon">＋</div><div><span className="academic-eyebrow">NEW ACADEMIC GROUP</span><h2>Create academic group</h2><p>Add one department and configure its yearly divisions.</p></div></div><button className="modal-close" onClick={closeModal}>×</button></div>
        <form onSubmit={create}><div className="modal-field-grid"><Field label="DEPARTMENT"><input autoFocus value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science"/></Field><Field label="ACADEMIC YEAR"><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27"/></Field></div><div className="modal-section-label">DIVISIONS BY YEAR</div><div className="modal-year-grid">{years.map(y => <label className={`modal-year ${counts[y] ? 'selected':''}`} key={y}><span><b>{label(y)}</b><small>{counts[y] ? `${counts[y]} divisions` : 'Not configured'}</small></span><input type="number" min="0" max="26" value={counts[y] || ''} onChange={e => setCounts({...counts,[y]:Number(e.target.value)})} placeholder="0"/></label>)}</div>{error && <div className="notice error">! {error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button">Create academic group →</button></div></form>
      </> : <form onSubmit={rename}><div className="modal-header"><div><div className="modal-icon edit">✎</div><div><span className="academic-eyebrow">EDIT DEPARTMENT</span><h2>Rename department</h2><p>Update the department name across its academic groups.</p></div></div><button type="button" className="modal-close" onClick={closeModal}>×</button></div><Field label="DEPARTMENT NAME"><input autoFocus value={editName} onChange={e => setEditName(e.target.value)}/></Field>{error && <div className="notice error">! {error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal}>Cancel</button><button className="create-group-button">Save changes →</button></div></form>}
    </div></div>}
  </div>
}
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label> }
