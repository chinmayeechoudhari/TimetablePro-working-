import { useEffect, useState } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const years = [1, 2, 3, 4]
const label = y => ({1:'1st Year',2:'2nd Year',3:'3rd Year',4:'4th Year'}[y])

export default function AcademicStructure() {
  const [academicYear, setAcademicYear] = useState('2026-27')
  const [department, setDepartment] = useState('')
  const [counts, setCounts] = useState({1:0,2:0,3:0,4:0})
  const [groups, setGroups] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try { setGroups((await axios.get(`${BASE}/academic-structure`)).data) }
    catch { setError('Could not load academic structure.') }
  }
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault(); setMessage(''); setError('')
    const selected = years.filter(y => counts[y] > 0).map(y => ({year_of_study:y, division_count:Number(counts[y])}))
    if (!department.trim() || !academicYear.trim() || !selected.length) {
      setError('Enter department, academic year, and at least one year with divisions.'); return
    }
    try {
      const r = await axios.post(`${BASE}/academic-structure`, {academic_year:academicYear.trim(), department:department.trim(), years:selected})
      setMessage(r.data.message); setCounts({1:0,2:0,3:0,4:0}); await load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not create structure.') }
  }

  return <div style={page}>
    <section style={hero}><div><div style={eyebrow}>STEP 1 · ACADEMIC SETUP</div><h1 style={title}>Academic Structure</h1><p style={sub}>Create departments and the divisions for each year. These divisions become the separate timetables.</p></div></section>
    <section style={card}>
      <h2 style={h2}>Create academic group</h2>
      <form onSubmit={submit}>
        <div style={grid2}>
          <Field label="Academic Year"><input value={academicYear} onChange={e=>setAcademicYear(e.target.value)} placeholder="2026-27" style={input}/></Field>
          <Field label="Department"><input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="AI & DS" style={input}/></Field>
        </div>
        <div style={{marginTop:24}}><div style={labelStyle}>DIVISIONS PER YEAR</div><div style={yearGrid}>{years.map(y=><div key={y} style={yearCard}><b>{label(y)}</b><span style={muted}>Number of divisions</span><input type="number" min="0" max="26" value={counts[y] || ''} onChange={e=>setCounts({...counts,[y]:Number(e.target.value)})} placeholder="0" style={input}/><small style={muted}>Example: 3 → A, B, C</small></div>)}</div></div>
        <button style={button}>Create Academic Structure</button>
      </form>
      {message && <div style={success}>{message}</div>}{error && <div style={errorBox}>{error}</div>}
    </section>
    <section style={card}><h2 style={h2}>Created academic groups</h2>{groups.length===0?<p style={muted}>No academic groups created yet.</p>:<div style={{display:'grid',gap:12}}>{groups.map(g=><div key={g.group_id} style={groupCard}><div><b>{g.department}</b><span style={muted}> · {label(g.year_of_study)} · {g.academic_year}</span></div><div style={{display:'flex',gap:7,marginTop:8}}>{g.divisions.map(d=><span key={d.division_id} style={pill}>{d.division_name}</span>)}</div></div>)}</div>}</section>
  </div>
}

function Field({label,children}){return <label style={{display:'grid',gap:7}}><span style={labelStyle}>{label}</span>{children}</label>}
const page={padding:'34px 38px',maxWidth:1100,margin:'0 auto'}
const hero={padding:'28px 30px',borderRadius:18,background:'linear-gradient(135deg,#eef5ff,#f7f4ff)',border:'1px solid #dbe5f5',marginBottom:20}
const eyebrow={fontSize:11,fontWeight:800,letterSpacing:'.12em',color:'#4f46e5'}
const title={fontSize:32,margin:'8px 0 6px',color:'#172554'}
const sub={margin:0,color:'#64748b',fontSize:15,lineHeight:1.6}
const card={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:26,marginBottom:20,boxShadow:'0 5px 20px rgba(15,23,42,.04)'}
const h2={fontSize:19,color:'#172554',margin:'0 0 20px'}
const grid2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}
const yearGrid={display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginTop:10}
const yearCard={padding:15,border:'1px solid #e2e8f0',borderRadius:12,display:'grid',gap:8}
const labelStyle={fontSize:11,fontWeight:800,letterSpacing:'.08em',color:'#64748b'}
const input={width:'100%',boxSizing:'border-box',padding:'11px 12px',border:'1px solid #cbd5e1',borderRadius:9,fontSize:14,background:'#fff'}
const button={marginTop:22,padding:'12px 20px',border:0,borderRadius:10,background:'linear-gradient(90deg,#2563eb,#6d28d9)',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer'}
const muted={color:'#64748b',fontSize:12}
const success={marginTop:16,padding:12,borderRadius:9,background:'#ecfdf5',color:'#047857'}
const errorBox={marginTop:16,padding:12,borderRadius:9,background:'#fef2f2',color:'#b91c1c'}
const groupCard={padding:15,border:'1px solid #e2e8f0',borderRadius:12,background:'#f8fafc'}
const pill={padding:'5px 10px',borderRadius:999,background:'#e0e7ff',color:'#3730a3',fontSize:12,fontWeight:700}
