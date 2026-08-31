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
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [linkingClass, setLinkingClass] = useState(null)
  const [linkForm, setLinkForm] = useState({ groupId: '', division: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = (await axios.get(`${BASE}/academic-structure`)).data
      setGroups(data.groups || [])
      setLegacyClasses(data.legacy_classes || [])
    } catch {
      setError('Could not load academic structure.')
    }
  }

  useEffect(() => { load() }, [])

  const departments = useMemo(
    () => [...new Set(groups.map(g => g.department))].sort((a, b) => a.localeCompare(b)),
    [groups],
  )

  const visibleGroups = selectedDepartment
    ? groups.filter(g => g.department === selectedDepartment)
    : groups

  const selectedGroup = groups.find(g => String(g.group_id) === String(linkForm.groupId))
  const availableDivisions = selectedGroup
    ? selectedGroup.divisions.map(d => d.division_name)
    : []

  async function submit(e) {
    e.preventDefault(); setMessage(''); setError('')
    const selected = years
      .filter(y => counts[y] > 0)
      .map(y => ({ year_of_study: y, division_count: Number(counts[y]) }))
    if (!department.trim() || !academicYear.trim() || !selected.length) {
      setError('Enter department, academic year, and at least one year with divisions.'); return
    }
    try {
      const r = await axios.post(`${BASE}/academic-structure`, {
        academic_year: academicYear.trim(), department: department.trim(), years: selected,
      })
      setMessage(r.data.message)
      setCounts({ 1: 0, 2: 0, 3: 0, 4: 0 })
      setSelectedDepartment(department.trim())
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create structure.')
    }
  }

  function openLinker(item) {
    setLinkingClass(item)
    setLinkForm({ groupId: '', division: '' })
    setMessage(''); setError('')
  }

  async function linkExistingClass(e) {
    e.preventDefault()
    if (!linkingClass || !linkForm.groupId || !linkForm.division) return
    const group = groups.find(g => String(g.group_id) === String(linkForm.groupId))
    try {
      const r = await axios.post(`${BASE}/academic-structure/adopt-class`, {
        class_id: linkingClass.class_id,
        academic_year: group.academic_year,
        department: group.department,
        year_of_study: group.year_of_study,
        division_name: linkForm.division,
      })
      setMessage(r.data.message)
      setError('')
      setLinkingClass(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not link existing class.')
    }
  }

  return (
    <div className="academic-page">
      <section className="academic-hero">
        <div>
          <div className="academic-eyebrow">STEP 1 · ACADEMIC SETUP</div>
          <h1>Build your academic structure</h1>
          <p>Set up departments and the divisions under each year. Every division becomes its own timetable.</p>
        </div>
        <div className="hero-stat"><strong>{departments.length}</strong><span>Departments</span></div>
        <div className="hero-stat"><strong>{groups.reduce((n, g) => n + g.divisions.length, 0)}</strong><span>Divisions</span></div>
      </section>

      <section className="structure-layout">
        <div className="structure-main">
          <div className="academic-card create-card">
            <div className="section-heading">
              <div><span className="step-badge">1</span><div><h2>Create academic group</h2><p>Add one department and choose the number of divisions for each year.</p></div></div>
            </div>
            <form onSubmit={submit}>
              <div className="field-row">
                <Field label="ACADEMIC YEAR"><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026-27" /></Field>
                <Field label="DEPARTMENT"><input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. AI & DS" /></Field>
              </div>
              <div className="year-heading"><span>DIVISIONS PER YEAR</span><small>0 means this year is not offered</small></div>
              <div className="year-grid">
                {years.map(y => (
                  <div className={`year-card ${counts[y] ? 'selected' : ''}`} key={y}>
                    <div className="year-top"><b>{label(y)}</b><span>{counts[y] ? `${counts[y]} division${counts[y] > 1 ? 's' : ''}` : 'Not selected'}</span></div>
                    <input type="number" min="0" max="26" value={counts[y] || ''} onChange={e => setCounts({ ...counts, [y]: Number(e.target.value) })} placeholder="0" />
                    <small>Example: 3 → A, B, C</small>
                  </div>
                ))}
              </div>
              <button className="primary-button">Create Academic Structure <span>→</span></button>
            </form>
            {message && <div className="notice success">✓ {message}</div>}
            {error && !linkingClass && <div className="notice error">! {error}</div>}
          </div>

          <div className="academic-card groups-card">
            <div className="section-heading compact">
              <div><span className="step-badge purple">2</span><div><h2>Academic groups</h2><p>Each department/year has its own set of divisions.</p></div></div>
            </div>
            {visibleGroups.length === 0 ? <div className="empty-state">No academic groups created yet.</div> : (
              <div className="group-list">
                {visibleGroups.map(g => <GroupCard key={g.group_id} group={g} />)}
              </div>
            )}
          </div>

          {legacyClasses.length > 0 && (
            <div className="academic-card legacy-card">
              <div className="section-heading compact">
                <div><span className="step-badge amber">!</span><div><h2>Existing classes found</h2><p>These classes were created in the previous workflow. <b>Nothing is deleted.</b> Link each one to its correct department, year and division.</p></div></div>
              </div>
              <div className="legacy-list">
                {legacyClasses.map(item => <div className="legacy-row" key={item.class_id}><div><b>{item.class_name}</b><small>Existing class · ID {item.class_id}</small></div><button type="button" className="secondary-button" onClick={() => openLinker(item)}>Link class →</button></div>)}
              </div>
            </div>
          )}
        </div>

        <aside className="structure-side">
          <div className="academic-card department-card">
            <div className="side-title"><div><span>VIEW</span><h3>Departments</h3></div><span className="count-badge">{departments.length}</span></div>
            <p className="side-help">Select a department to filter the academic groups on the left.</p>
            <div className="department-list">
              <button type="button" className={!selectedDepartment ? 'department-button active' : 'department-button'} onClick={() => setSelectedDepartment('')}><span>All departments</span><b>{groups.length}</b></button>
              {departments.map(dep => {
                const depGroups = groups.filter(g => g.department === dep)
                const divisionCount = depGroups.reduce((n, g) => n + g.divisions.length, 0)
                return <button type="button" key={dep} className={selectedDepartment === dep ? 'department-button active' : 'department-button'} onClick={() => setSelectedDepartment(dep)}><span>{dep}</span><b>{divisionCount}</b></button>
              })}
            </div>
          </div>
          <div className="academic-card summary-card">
            <span>STRUCTURE SUMMARY</span>
            <div className="summary-number">{visibleGroups.reduce((n, g) => n + g.divisions.length, 0)}</div>
            <h3>divisions in view</h3>
            <div className="summary-lines">
              {years.map(y => { const count = visibleGroups.filter(g => g.year_of_study === y).reduce((n, g) => n + g.divisions.length, 0); return <div key={y}><span>{label(y)}</span><b>{count}</b></div> })}
            </div>
          </div>
        </aside>
      </section>

      {linkingClass && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setLinkingClass(null)}>
          <form className="link-modal" onSubmit={linkExistingClass}>
            <div className="modal-top"><div><span className="academic-eyebrow">RECOVER EXISTING CLASS</span><h2>Link {linkingClass.class_name}</h2><p>This keeps the existing class and all its related data. You are only adding its academic-structure link.</p></div><button type="button" className="modal-close" onClick={() => setLinkingClass(null)}>×</button></div>
            <Field label="DEPARTMENT / YEAR"><select value={linkForm.groupId} onChange={e => setLinkForm({ groupId: e.target.value, division: '' })} required><option value="">Select academic group</option>{groups.map(g => <option key={g.group_id} value={g.group_id}>{g.department} · {label(g.year_of_study)} · {g.academic_year}</option>)}</select></Field>
            <Field label="DIVISION"><select value={linkForm.division} onChange={e => setLinkForm({ ...linkForm, division: e.target.value })} required disabled={!linkForm.groupId}><option value="">Select division</option>{availableDivisions.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
            {error && <div className="notice error">! {error}</div>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setLinkingClass(null)}>Cancel</button><button className="primary-button modal-primary">Link existing class</button></div>
          </form>
        </div>
      )}
    </div>
  )
}

function GroupCard({ group }) {
  return <div className="group-card"><div className="group-meta"><div><span className="department-name">{group.department}</span><span className="dot">•</span><span>{label(group.year_of_study)}</span></div><span className="year-chip">{group.academic_year}</span></div><div className="division-row">{group.divisions.map(d => <div className="division-pill" key={d.division_id}><strong>{d.division_name}</strong><span>{group.department} · {label(group.year_of_study)}</span></div>)}</div></div>
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
