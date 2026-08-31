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

  async function adoptClass(item) {
    const division = window.prompt(
      `Link ${item.class_name} to which division? Enter A, B, C, etc.`,
      inferDivision(item.class_name) || 'A',
    )
    if (!division) return
    const dep = window.prompt('Department for this existing class:', department || '')
    if (!dep) return
    const year = window.prompt('Year of study (1-4):', inferYear(item.class_name) || '1')
    if (!year) return
    try {
      const r = await axios.post(`${BASE}/academic-structure/adopt-class`, {
        class_id: item.class_id,
        academic_year: academicYear.trim() || '2026-27',
        department: dep.trim(),
        year_of_study: Number(year),
        division_name: division.trim().toUpperCase(),
      })
      setMessage(r.data.message)
      setError('')
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
            {error && <div className="notice error">! {error}</div>}
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
                <div><span className="step-badge amber">!</span><div><h2>Existing classes not yet linked</h2><p>These were created by the older class workflow. They are <b>not deleted</b>; link them to the new structure below.</p></div></div>
              </div>
              <div className="legacy-list">
                {legacyClasses.map(item => <div className="legacy-row" key={item.class_id}><div><b>{item.class_name}</b><small>Class ID {item.class_id}</small></div><button className="secondary-button" onClick={() => adoptClass(item)}>Link to structure</button></div>)}
              </div>
            </div>
          )}
        </div>

        <aside className="structure-side">
          <div className="academic-card department-card">
            <div className="side-title"><div><span>VIEW</span><h3>Departments</h3></div><span className="count-badge">{departments.length}</span></div>
            <p className="side-help">Select a department to see only its academic groups.</p>
            <div className="department-list">
              <button className={!selectedDepartment ? 'department-button active' : 'department-button'} onClick={() => setSelectedDepartment('')}><span>All departments</span><b>{groups.length}</b></button>
              {departments.map(dep => {
                const depGroups = groups.filter(g => g.department === dep)
                const divisionCount = depGroups.reduce((n, g) => n + g.divisions.length, 0)
                return <button key={dep} className={selectedDepartment === dep ? 'department-button active' : 'department-button'} onClick={() => setSelectedDepartment(dep)}><span>{dep}</span><b>{divisionCount}</b></button>
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
    </div>
  )
}

function GroupCard({ group }) {
  return <div className="group-card"><div className="group-meta"><div><span className="department-name">{group.department}</span><span className="dot">•</span><span>{label(group.year_of_study)}</span></div><span className="year-chip">{group.academic_year}</span></div><div className="division-row">{group.divisions.map(d => <div className="division-pill" key={d.division_id}><strong>{d.division_name}</strong><span>{group.department} · {label(group.year_of_study)}</span></div>)}</div></div>
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function inferDivision(name) { const m = name.match(/[-\s]([A-Z])$/i); return m?.[1]?.toUpperCase() || '' }
function inferYear(name) { const m = name.match(/(1st|2nd|3rd|4th)\s+Year/i); return m ? ({ '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 }[m[1].toLowerCase()]) : '' }
