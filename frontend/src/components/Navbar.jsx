import { Link, useLocation } from 'react-router-dom'

const icon = (path) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
const Icons={
 dashboard:icon(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
 structure:icon(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/></>),
 subjects:icon(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>),
 faculty:icon(<><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.1a4 4 0 0 1 0 7.8M18 15h1a4 4 0 0 1 4 4v2"/></>),
 rooms:icon(<><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4h6v4"/></>),
 availability:icon(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4"/></>),
 constraints:icon(<><path d="M12 3l1.8 5.7L19.5 11l-5.7 1.8L12 18.5l-1.8-5.7L4.5 11l5.7-2.3L12 3Z"/></>),
 generate:icon(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
 timetable:icon(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>),
}

const groups=[
 {section:'HOME',items:[{to:'/',label:'Dashboard',icon:Icons.dashboard}]},
 {section:'SETUP',items:[
  {to:'/academic-structure',label:'Academic Structure',icon:Icons.structure},
  {to:'/subjects',label:'Subjects',icon:Icons.subjects},
  {to:'/faculty-assignments',label:'Faculty & Assignments',icon:Icons.faculty},
  {to:'/timeslots',label:'Weekly Schedule',icon:Icons.timetable},
  {to:'/rooms',label:'Rooms',icon:Icons.rooms},
  {to:'/teacher-availability',label:'Teacher Availability',icon:Icons.availability},
 ]},
 {section:'INTELLIGENCE',items:[{to:'/constraints',label:'Constraints',icon:Icons.constraints}]},
 {section:'SCHEDULE',items:[{to:'/generate',label:'Generate',icon:Icons.generate},{to:'/timetable',label:'Timetable',icon:Icons.timetable}]},
]

export default function Navbar(){const location=useLocation();return <><style>{`.nav-sidebar{width:240px;min-width:240px;height:100vh;background:var(--sidebar-bg);display:flex;flex-direction:column;font-family:'Inter','Segoe UI',sans-serif;user-select:none;flex-shrink:0;border-right:1px solid var(--sidebar-border);box-shadow:2px 0 12px rgba(0,0,0,.04)}.nav-link{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;color:var(--nav-inactive-text);background:transparent;border-left:3px solid transparent;transition:all .15s}.nav-link:hover{background:var(--sidebar-hover-bg)!important;color:var(--sidebar-hover-text)!important}.nav-link.active{background:var(--nav-active-bg)!important;color:var(--nav-active-text)!important;border-left:3px solid var(--nav-active-border)!important;font-weight:600}.nav-section-label{font-size:10px;font-weight:700;color:var(--sidebar-section);letter-spacing:.1em;padding:4px 10px 8px;text-transform:uppercase}`}</style><aside className="nav-sidebar"><div style={{padding:'20px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--sidebar-border)'}}><div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#2563eb,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>▦</div><div><b style={{color:'var(--sidebar-text)'}}>Timetable<span style={{color:'#2563eb'}}>Pro</span></b><div style={{fontSize:10.5,color:'var(--sidebar-muted)'}}>CP-SAT Scheduler</div></div></div><div style={{flex:1,padding:'14px 10px',overflowY:'auto'}}>{groups.map(g=><div key={g.section} style={{marginBottom:18}}><div className="nav-section-label">{g.section}</div>{g.items.map(item=>{const active=location.pathname===item.to;return <Link key={item.to} to={item.to} className={`nav-link${active?' active':''}`}><span>{item.icon}</span><span style={{flex:1}}>{item.label}</span>{active&&<span style={{width:6,height:6,borderRadius:'50%',background:'var(--nav-active-dot)'}}/>}</Link>})}</div>)}</div><div style={{padding:'14px 12px 18px',borderTop:'1px solid var(--sidebar-border)'}}><div style={{background:'var(--status-card-bg)',border:'1px solid var(--status-card-border)',borderRadius:10,padding:11}}><b style={{fontSize:12,color:'var(--status-text)'}}>● System ready</b><div style={{fontSize:11,color:'var(--status-sub)',marginTop:3}}>Academic workflow enabled</div></div></div></aside></>}
