import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV_SECTIONS = [
  {
    section: 'Data Entry',
    items: [
      { id: 'teachers',             label: 'Teachers',     icon: '👨‍🏫', link: '/teachers' },
      { id: 'rooms',                label: 'Rooms',        icon: '🚪', link: '/rooms' },
      { id: 'classes',              label: 'Classes',      icon: '🎓', link: '/classes' },
      { id: 'subjects',             label: 'Subjects',     icon: '📚', link: '/subjects' },
      { id: 'timeslots',            label: 'Timeslots',    icon: '🕐', link: '/timeslots' },
      { id: 'teacher-subjects',     label: 'Assignments',  icon: '📋', link: '/teacher-subjects' },
      { id: 'teacher-availability', label: 'Availability', icon: '📅', link: '/teacher-availability' },
    ],
  },
  {
    section: 'Schedule',
    items: [
      { id: 'generate',  label: 'Generate',  icon: '⚡', link: '/generate' },
      { id: 'timetable', label: 'Timetable', icon: '🗓️', link: '/timetable' },
    ],
  },
]

export default function NavSidebar({ onCollapse }) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  const W = collapsed ? 70 : 265
  const currentPath = location.pathname === '/' ? '/teachers' : location.pathname

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    onCollapse?.(next)
  }

  function isActive(link) {
    return currentPath === link
  }

  return (
    <aside style={{
      position:      'fixed',
      top:           0,
      left:          0,
      bottom:        0,
      width:         W,
      zIndex:        50,
      display:       'flex',
      flexDirection: 'column',
      background:    'var(--sidebar-bg, var(--bg-card))',
      borderRight:   '1px solid var(--border-color)',
      transition:    'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      overflow:      'hidden',
      fontFamily:    "'Inter', 'Segoe UI', sans-serif",
      boxShadow:     '2px 0 10px rgba(0,0,0,0.04)',
    }}>

      {/* ── Header ── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding:        collapsed ? '20px 0' : '20px 18px',
        borderBottom:   '1px solid var(--border-color)',
        minHeight:      68,
        flexShrink:     0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7041d9, #4f2da7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>🗓️</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', letterSpacing: '-0.01em', lineHeight: 1.2 }}>TimetablePro</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>CP-SAT Scheduler</span>
            </div>
          </div>
        )}

        <button
          onClick={toggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          36,
            height:         36,
            borderRadius:   9,
            border:         '1px solid #E2E8F0',
            background:     '#F8FAFC',
            color:          '#64748B',
            cursor:         'pointer',
            flexShrink:     0,
            transition:     'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
          onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* ── Nav sections ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 10px' }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.section} style={{ marginBottom: si < NAV_SECTIONS.length - 1 ? 22 : 0 }}>

            {/* Section label */}
            {!collapsed && (
              <p style={{
                fontSize:      11,
                fontWeight:    700,
                color:         '#94A3B8',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin:        '0 0 8px 10px',
              }}>
                {section.section}
              </p>
            )}

            {/* Items */}
            {section.items.map(item => {
              const active = isActive(item.link)
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    width:          '100%',
                    display:        'flex',
                    alignItems:     'center',
                    gap:            12,
                    padding:        collapsed ? '11px 0' : '11px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius:   9,
                    border:         'none',
                    cursor:         'pointer',
                    marginBottom:   4,
                    transition:     'background 0.15s, color 0.15s',
                    background:     active ? '#EEF2FF' : 'transparent',
                    color:          active ? '#2563EB' : '#475569',
                    fontFamily:     'inherit',
                    position:       'relative',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = '#F8FAFC'
                      e.currentTarget.style.color      = '#1B2A3B'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color      = '#475569'
                    }
                  }}
                >
                  {/* Active indicator bar */}
                  {active && !collapsed && (
                    <span style={{
                      position:     'absolute',
                      left:         0,
                      top:          '50%',
                      transform:    'translateY(-50%)',
                      width:        3.5,
                      height:       22,
                      borderRadius: '0 3px 3px 0',
                      background:   '#2563EB',
                    }} />
                  )}

                  <span style={{ fontSize: 19, flexShrink: 0, lineHeight: 1 }}>
                    {item.icon}
                  </span>

                  {!collapsed && (
                    <span style={{
                      fontSize:   14,
                      fontWeight: active ? 600 : 500,
                      whiteSpace: 'nowrap',
                      flex:       1,
                      textAlign:  'left',
                    }}>
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Status Indicator & Footer ── */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* System ready indicator */}
        {!collapsed && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.2' }}>System ready</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>All systems operational</span>
              </div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '9px', fontWeight: '800', padding: '3px 6px', borderRadius: '5px', letterSpacing: '0.5px' }}>LIVE</div>
          </div>
        )}

        {/* User Profile Footer */}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #2a3449, #1c2333)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a99ad', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
              AD
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                Admin User
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: '500' }}>
                Administrator
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>
    </aside>
  )
}
