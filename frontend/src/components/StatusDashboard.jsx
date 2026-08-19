import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ThemeToggle from "./ThemeToggle";

const BASE = "http://localhost:8000";

/* ─── SVG Icons ───────────────────────────────────────────────── */
const SVG = {
  teacher: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  teacherAdd: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="17" y1="11" x2="23" y2="11"/>
    </svg>
  ),
  classroom: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18"/>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
      <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/>
    </svg>
  ),
  roomDoor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2"/>
      <path d="M15 12h.01"/>
    </svg>
  ),
  lab: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55A1 1 0 0 0 5.607 22h12.786a1 1 0 0 0 .886-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
      <line x1="8.5" y1="2" x2="15.5" y2="2"/>
      <line x1="7" y1="16" x2="17" y2="16"/>
    </svg>
  ),
  classes: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/>
    </svg>
  ),
  subjects: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  ),
  sun: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  lightning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  shieldCheck: (
    <svg width="68" height="68" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shieldGrad)" stroke="#1d4ed8" strokeWidth="1.2"/>
      <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="shieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6"/>
          <stop offset="1" stopColor="#1d4ed8"/>
        </linearGradient>
      </defs>
    </svg>
  )
};

export default function StatusDashboard() {
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const classroomCount = rooms.filter(room => room.room_type === "classroom" || !room.room_type).length;
  const labCount = rooms.filter(room => room.room_type === "lab").length;

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError("");

      const [teacherRes, roomRes, classRes, subjectRes, validationRes] = await Promise.all([
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/rooms`),
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/subjects`),
        axios.get(`${BASE}/validate`),
      ]);

      setTeachers(teacherRes.data);
      setRooms(roomRes.data);
      setClasses(classRes.data);
      setSubjects(subjectRes.data);
      setValidation(validationRes.data);
    } catch (err) {
      console.error(err);
      setError("Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: '40px 36px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontFamily: "'Inter', sans-serif",
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--text-muted)',
      }}>
        Loading Dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 36px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontWeight: '600',
        }}>{error}</div>
        <button
          onClick={fetchDashboard}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            borderRadius: '10px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '30px 36px 60px',
      background: 'var(--bg-page)',
      minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: 'var(--text-main)',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <style>{`
        .dash-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease, border-color 0.3s ease;
        }
        .dash-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12) !important;
        }
        .action-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease, border-color 0.3s ease;
        }
        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12) !important;
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: '800',
            color: 'var(--text-main)',
            letterSpacing: '-0.4px',
          }}>
            Status Dashboard
          </h1>
          <p style={{
            margin: '6px 0 0',
            color: 'var(--text-muted)',
            fontSize: '13.5px',
            fontWeight: '500',
          }}>
            Overview of your timetable configuration and system health.
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Uiverse Theme Switch */}
          <ThemeToggle />

          {/* Refresh Button */}
          <button
            onClick={fetchDashboard}
            style={{
              height: '40px',
              padding: '0 20px',
              borderRadius: '12px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '13.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(37, 99, 235, 0.3)',
              transition: 'background 0.15s ease',
            }}
          >
            {SVG.refresh}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── METRIC CARDS ROW (5 COLUMNS) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px',
        marginBottom: '36px',
      }}>
        {/* Teachers */}
        <MetricCard
          title="Teachers"
          value={teachers.length}
          subtitle="Total Registered Teachers"
          icon={SVG.teacher}
          badgeBg="var(--badge-teacher)"
        />

        {/* Classrooms */}
        <MetricCard
          title="Classrooms"
          value={classroomCount}
          subtitle="Theory Rooms"
          icon={SVG.classroom}
          badgeBg="var(--badge-classroom)"
        />

        {/* Labs */}
        <MetricCard
          title="Labs"
          value={labCount}
          subtitle="Practical Rooms"
          icon={SVG.lab}
          badgeBg="var(--badge-lab)"
        />

        {/* Classes */}
        <MetricCard
          title="Classes"
          value={classes.length}
          subtitle="Configured Classes"
          icon={SVG.classes}
          badgeBg="var(--badge-class)"
        />

        {/* Subjects */}
        <MetricCard
          title="Subjects"
          value={subjects.length}
          subtitle="Subjects Added"
          icon={SVG.subjects}
          badgeBg="var(--badge-subject)"
        />
      </div>

      {/* ── QUICK ACTIONS ROW ── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '18px',
        }}>
          {SVG.lightning}
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '800',
            color: 'var(--text-main)',
            letterSpacing: '-0.2px',
          }}>
            Quick Actions
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}>
          <QuickActionCard
            icon={SVG.teacherAdd}
            badgeBg="var(--badge-teacher)"
            title="Add Teacher"
            description="Register a new faculty member."
            linkColor="#2563eb"
            onClick={() => navigate('/teachers')}
          />

          <QuickActionCard
            icon={SVG.roomDoor}
            badgeBg="var(--badge-classroom)"
            title="Add Room"
            description="Create classrooms and labs."
            linkColor="#10b981"
            onClick={() => navigate('/rooms')}
          />

          <QuickActionCard
            icon={SVG.classes}
            badgeBg="var(--badge-class)"
            title="Add Class"
            description="Configure student classes."
            linkColor="#f97316"
            onClick={() => navigate('/classes')}
          />

          <QuickActionCard
            icon={SVG.subjects}
            badgeBg="var(--badge-lab)"
            title="Add Subject"
            description="Create theory & lab subjects."
            linkColor="#8b5cf6"
            onClick={() => navigate('/subjects')}
          />
        </div>
      </div>

      {/* ── SYSTEM STATUS CARD BANNER ── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '28px 32px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: '40px',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        {/* Soft decorative background gradient on right */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Left Status Content */}
        <div style={{ zIndex: 1 }}>
          {/* Status Tag */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: validation?.ready !== false ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: validation?.ready !== false ? '#4ade80' : '#f87171',
            padding: '5px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.01em',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '11px' }}>{validation?.ready !== false ? '✓' : '⚠️'}</span>
            <span>{validation?.ready !== false ? 'Ready To Generate' : 'Setup Required'}</span>
          </div>

          <h2 style={{
            margin: '0 0 6px',
            fontSize: '22px',
            fontWeight: '800',
            color: 'var(--text-main)',
            letterSpacing: '-0.3px',
          }}>
            {validation?.ready !== false ? 'Everything is configured correctly.' : 'System setup requires attention.'}
          </h2>

          <p style={{
            margin: '0 0 24px',
            color: 'var(--text-muted)',
            fontSize: '13.5px',
            fontWeight: '500',
          }}>
            {validation?.ready !== false ? 'Ready to generate.' : 'Please configure missing data elements.'}
          </p>

          {/* Validation Items Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(200px, 260px))',
            gap: '12px',
          }}>
            <ValidationBadge ok={teachers.length > 0} label="Teachers Added" />
            <ValidationBadge ok={rooms.length > 0} label="Rooms Configured" />
            <ValidationBadge ok={classes.length > 0} label="Classes Created" />
            <ValidationBadge ok={subjects.length > 0} label="Subjects Added" />
          </div>
        </div>

        {/* Right 3D Shield Graphic */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Orbital Rings around shield */}
          <div style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '1.5px dashed rgba(59, 130, 246, 0.25)',
          }} />
          <div style={{
            position: 'absolute',
            width: '210px',
            height: '210px',
            borderRadius: '50%',
            border: '1px solid rgba(59, 130, 246, 0.15)',
          }} />

          {/* Shield Badge Container */}
          <div style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 12px 36px rgba(37, 99, 235, 0.35)',
            border: '1.5px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {SVG.shieldCheck}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Metric Card Component ───────────────────────────────────── */
function MetricCard({ title, value, subtitle, icon, badgeBg }) {
  return (
    <div className="dash-card" style={{
      background: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '18px 20px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
          {title}
        </div>
        <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', marginTop: '6px' }}>
          {subtitle}
        </div>
      </div>

      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '12px',
        background: badgeBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}

/* ─── Quick Action Card Component ─────────────────────────────── */
function QuickActionCard({ icon, badgeBg, title, description, linkColor, onClick }) {
  return (
    <div
      className="action-card"
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '20px 18px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Top right decorative dots grid */}
      <div style={{
        position: 'absolute',
        top: '18px',
        right: '18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 4px)',
        gap: '4px',
        opacity: 0.25,
      }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)' }} />
        ))}
      </div>

      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: badgeBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        {icon}
      </div>

      <h3 style={{
        margin: '0 0 4px',
        fontSize: '15px',
        fontWeight: '700',
        color: 'var(--text-main)',
      }}>
        {title}
      </h3>

      <p style={{
        margin: '0 0 16px',
        fontSize: '12.5px',
        color: 'var(--text-muted)',
        lineHeight: 1.4,
        flex: 1,
      }}>
        {description}
      </p>

      <div style={{
        fontSize: '13px',
        fontWeight: '700',
        color: linkColor,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        Open →
      </div>
    </div>
  );
}

/* ─── Validation Badge Component ─────────────────────────────── */
function ValidationBadge({ ok, label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      background: 'var(--badge-val-bg)',
      padding: '8px 14px',
      borderRadius: '10px',
    }}>
      <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: ok ? '#10b981' : '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '800',
        flexShrink: 0,
      }}>
        {ok ? '✓' : '✕'}
      </div>
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--badge-val-text)',
      }}>
        {label}
      </span>
    </div>
  );
}