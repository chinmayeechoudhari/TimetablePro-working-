import { useState, useEffect, useRef } from 'react'

/* ─── Floating Icon Bubble on Orbit with Interactive Cursor Reaction ─── */
function OrbitBubble({ icon, xFactor, yFactor, orbitVar = 'var(--orbit-r2)', delay = 0, duration = '5s', mousePos }) {
  const [visible, setVisible] = useState(false)
  const bubbleRef = useRef(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  // Mouse proximity shift reaction
  useEffect(() => {
    if (mousePos.x === null || !bubbleRef.current) {
      setOffset({ x: 0, y: 0 })
      return
    }
    const rect = bubbleRef.current.getBoundingClientRect()
    const bubbleX = rect.left + rect.width / 2
    const bubbleY = rect.top + rect.height / 2

    const dx = mousePos.x - bubbleX
    const dy = mousePos.y - bubbleY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const threshold = 220 // influence radius in pixels

    if (dist < threshold && dist > 0) {
      const force = Math.pow(1 - dist / threshold, 1.5)
      // Smoothly push bubble away from cursor
      const pushX = -(dx / dist) * force * 26
      const pushY = -(dy / dist) * force * 26
      setOffset({ x: pushX, y: pushY })
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }, [mousePos])

  return (
    <div
      ref={bubbleRef}
      className="orbit-bubble-wrapper"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 54,
        height: 54,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 28px rgba(100, 130, 220, 0.18), 0 2px 8px rgba(100, 130, 220, 0.12)',
        border: '1.5px solid rgba(255, 255, 255, 0.98)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
        opacity: visible ? 1 : 0,
        transform: `translate(calc(-50% + ${xFactor} * ${orbitVar} + ${offset.x}px), calc(-50% + ${yFactor} * ${orbitVar} + ${offset.y}px)) scale(${visible ? 1 : 0.6})`,
        transition: 'opacity 0.7s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        animation: visible ? `ultra-float ${duration} cubic-bezier(0.42, 0, 0.58, 1) infinite` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}>
        {icon}
      </div>
    </div>
  )
}

/* ─── Dot Grid ───────────────────────────────────────────────── */
function DotGrid({ style }) {
  return (
    <div style={{
      position: 'absolute',
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 7px)',
      gap: 6,
      pointerEvents: 'none',
      ...style
    }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(140, 160, 210, 0.35)' }} />
      ))}
    </div>
  )
}

/* ─── Corner Decorative Wave Lines ───────────────────────────── */
function WaveLines({ style }) {
  return (
    <svg viewBox="0 0 350 250" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      <path d="M10 230 Q100 40 220 120 Q280 170 340 50"
        stroke="rgba(160, 185, 240, 0.28)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 190 Q120 20 230 140 Q290 190 350 70"
        stroke="rgba(160, 185, 240, 0.16)" strokeWidth="1" strokeLinecap="round" />
      <path d="M20 250 Q80 70 200 100 Q260 140 330 30"
        stroke="rgba(160, 185, 240, 0.1)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Icons ──────────────────────────────────────────────────── */
const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="17" rx="3" stroke="#3B82F6" strokeWidth="1.8"/>
    <path d="M3 9h18" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 2v4M16 2v4" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="7" y="13" width="2" height="2" rx=".4" fill="#3B82F6"/>
    <rect x="11" y="13" width="2" height="2" rx=".4" fill="#3B82F6"/>
    <rect x="15" y="13" width="2" height="2" rx=".4" fill="#3B82F6"/>
    <rect x="7" y="17" width="2" height="2" rx=".4" fill="#3B82F6"/>
    <rect x="11" y="17" width="2" height="2" rx=".4" fill="#3B82F6"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#8B5CF6" strokeWidth="1.8"/>
    <path d="M12 7v5l3 3" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const GridIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="#10B981" strokeWidth="1.8"/>
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const GradCapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 4L2 9l10 5 10-5-10-5z" stroke="#3B82F6" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M6 11.5V17c0 0 2 2.5 6 2.5S18 17 18 17v-5.5" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M22 9v5" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

const LogoIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="2" y="5" width="26" height="24" rx="3.5" fill="white" fillOpacity="0.25"/>
    <rect x="2" y="5" width="26" height="24" rx="3.5" stroke="white" strokeWidth="1.5"/>
    <path d="M2 12h26" stroke="white" strokeWidth="1.5"/>
    <path d="M10 2v6M22 2v6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <rect x="7" y="17" width="4" height="3.5" rx="0.8" fill="white"/>
    <rect x="14" y="17" width="4" height="3.5" rx="0.8" fill="white"/>
    <rect x="21" y="17" width="4" height="3.5" rx="0.8" fill="white"/>
    <rect x="7" y="23" width="4" height="3" rx="0.8" fill="white" fillOpacity="0.7"/>
    <rect x="14" y="23" width="4" height="3" rx="0.8" fill="white" fillOpacity="0.7"/>
  </svg>
)

export default function LandingScreen({ onEnter }) {
  const [visible, setVisible] = useState(false)
  const [btnVisible, setBtnVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [mousePos, setMousePos] = useState({ x: null, y: null })
  const [isCenterHovered, setIsCenterHovered] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 150)
    const t2 = setTimeout(() => setBtnVisible(true), 750)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Enter') handleEnter() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleMouseMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY })

    // Check proximity to middle circle card (radius ~175px from center)
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const dx = e.clientX - centerX
    const dy = e.clientY - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)

    setIsCenterHovered(dist < 185)
  }

  function handleEnter() {
    if (exiting) return
    setExiting(true)
    setTimeout(onEnter, 650)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        :root {
          --orbit-r1: clamp(170px, 20vw, 220px);
          --orbit-r2: clamp(235px, 28vw, 325px);
          --orbit-r3: clamp(310px, 37vw, 430px);
          --orbit-r4: clamp(390px, 46vw, 540px);
        }

        @keyframes ultra-float {
          0%, 100% {
            transform: translate3d(0, 0px, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -9px, 0) scale(1.04);
          }
        }

        @keyframes blob-drift {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(25px, -15px) scale(1.05); }
        }

        .orbit-bubble-wrapper:hover {
          box-shadow: 0 12px 36px rgba(59, 130, 246, 0.28), 0 4px 12px rgba(59, 130, 246, 0.18) !important;
          border-color: rgba(255, 255, 255, 1) !important;
        }

        .landing-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease !important;
        }
        .landing-btn:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 12px 32px rgba(37,99,235,0.4) !important;
          background: #1d4ed8 !important;
        }
        .landing-btn:active {
          transform: scale(0.97) !important;
        }
      `}</style>

      <div
        onClick={handleEnter}
        onMouseMove={handleMouseMove}
        style={{
          position: 'fixed',
          inset: 0,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.7s ease',
          zIndex: 9999,
          overflow: 'hidden',
          userSelect: 'none',
          cursor: 'default',
        }}
      >
        {/* Gradient Background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #d8e6fd 0%, #e8f0fe 30%, #f4f7ff 60%, #eaf0fe 100%)',
          zIndex: 0,
        }} />

        {/* Soft Blue Cloud Blobs */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: '45vw', height: '45vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(175, 205, 255, 0.55) 0%, transparent 70%)',
          animation: 'blob-drift 14s ease-in-out infinite',
          filter: 'blur(4px)', zIndex: 0,
        }} />

        <div style={{
          position: 'absolute', bottom: '-8%', left: '-6%',
          width: '40vw', height: '40vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160, 195, 255, 0.45) 0%, transparent 70%)',
          animation: 'blob-drift 18s ease-in-out infinite reverse',
          filter: 'blur(4px)', zIndex: 0,
        }} />

        {/* Corner Decorative Waves */}
        <WaveLines style={{ left: '-1%', top: '5%', width: 340, opacity: visible ? 0.85 : 0, transition: 'opacity 1s ease 0.4s' }} />
        <WaveLines style={{ right: '-1%', bottom: '4%', width: 320, opacity: visible ? 0.85 : 0, transition: 'opacity 1s ease 0.6s', transform: 'rotate(180deg)' }} />

        {/* Dot Grids */}
        <DotGrid style={{ left: '3%', top: '35%', opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.5s', zIndex: 1 }} />
        <DotGrid style={{ right: '3%', top: '40%', opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.7s', zIndex: 1 }} />

        {/* Scattered Accent Dots */}
        {[
          { top: '25%', left: '15%', color: 'rgba(59, 130, 246, 0.5)', size: 7 },
          { top: '36%', right: '15%', color: 'rgba(139, 92, 246, 0.45)', size: 6 },
          { bottom: '26%', right: '17%', color: 'rgba(139, 92, 246, 0.4)', size: 9 },
          { bottom: '33%', left: '13%', color: 'rgba(16, 185, 129, 0.55)', size: 7 },
        ].map((d, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%',
            width: d.size, height: d.size, background: d.color,
            top: d.top, left: d.left, right: d.right, bottom: d.bottom,
            zIndex: 1,
          }} />
        ))}

        {/* ── CONCENTRIC ORBIT RINGS ── */}
        {/* Ring 1 (Inner) */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'calc(2 * var(--orbit-r1))', height: 'calc(2 * var(--orbit-r1))',
          borderRadius: '50%',
          border: '1.5px solid rgba(185, 205, 245, 0.45)',
          transform: 'translate(-50%, -50%)',
          zIndex: 1, opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.2s',
        }} />

        {/* Ring 2 (Middle) */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'calc(2 * var(--orbit-r2))', height: 'calc(2 * var(--orbit-r2))',
          borderRadius: '50%',
          border: '1.5px solid rgba(180, 205, 245, 0.65)',
          transform: 'translate(-50%, -50%)',
          zIndex: 1, opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.3s',
        }} />

        {/* Ring 3 (Outer) */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'calc(2 * var(--orbit-r3))', height: 'calc(2 * var(--orbit-r3))',
          borderRadius: '50%',
          border: '1.5px solid rgba(185, 205, 245, 0.45)',
          transform: 'translate(-50%, -50%)',
          zIndex: 1, opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.4s',
        }} />

        {/* Ring 4 (Outermost) */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'calc(2 * var(--orbit-r4))', height: 'calc(2 * var(--orbit-r4))',
          borderRadius: '50%',
          border: '1.2px solid rgba(190, 210, 245, 0.3)',
          transform: 'translate(-50%, -50%)',
          zIndex: 1, opacity: visible ? 1 : 0, transition: 'opacity 1s ease 0.5s',
        }} />

        {/* ── 4 ICON BUBBLES DISTRIBUTED ON DIFFERENT ORBIT LINES & SPOTS ── */}
        {/* Calendar: Middle Ring 2 (shifted a little closer to grid icon) */}
        <OrbitBubble
          icon={<CalendarIcon />}
          orbitVar="var(--orbit-r2)"
          xFactor={-0.906}
          yFactor={-0.423}
          delay={500}
          duration="4.6s"
          mousePos={mousePos}
        />

        {/* Clock: Outer Ring 3 */}
        <OrbitBubble
          icon={<ClockIcon />}
          orbitVar="var(--orbit-r3)"
          xFactor={0.883}
          yFactor={-0.469}
          delay={700}
          duration="5.2s"
          mousePos={mousePos}
        />

        {/* Grid: Middle Ring 2 */}
        <OrbitBubble
          icon={<GridIcon />}
          orbitVar="var(--orbit-r2)"
          xFactor={-0.866}
          yFactor={0.500}
          delay={900}
          duration="4.9s"
          mousePos={mousePos}
        />

        {/* Graduation Cap: Outer Ring 3 */}
        <OrbitBubble
          icon={<GradCapIcon />}
          orbitVar="var(--orbit-r3)"
          xFactor={0.766}
          yFactor={0.643}
          delay={1100}
          duration="5.5s"
          mousePos={mousePos}
        />

        {/* ── CENTRAL WHITE CIRCLE CARD ── */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 'clamp(250px, 29vw, 325px)',
          height: 'clamp(250px, 29vw, 325px)',
          borderRadius: '50%',
          transform: `translate(-50%, -50%) scale(${!visible ? 0.85 : isCenterHovered ? 1.07 : 1})`,
          background: isCenterHovered
            ? 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f4f8ff 100%)'
            : 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8faff 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isCenterHovered
            ? '0 22px 64px rgba(100, 130, 230, 0.25), 0 4px 16px rgba(100, 130, 230, 0.14), inset 0 1.5px 0 #ffffff'
            : '0 12px 48px rgba(100, 130, 220, 0.16), 0 2px 10px rgba(100, 130, 220, 0.08), inset 0 1.5px 0 rgba(255, 255, 255, 0.9)',
          border: isCenterHovered ? '1.5px solid rgba(255, 255, 255, 1)' : '1.5px solid rgba(255, 255, 255, 0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10,
          zIndex: 3,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.8s ease 0.2s, transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}>
          {/* Logo Badge + Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(37,99,235,0.38)', flexShrink: 0,
            }}>
              <LogoIcon />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span style={{ fontSize: 'clamp(24px, 3.4vw, 36px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1 }}>
                Timetable
              </span>
              <span style={{
                fontSize: 'clamp(24px, 3.4vw, 36px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Pro
              </span>
            </div>
          </div>

          {/* Subtitle Tagline */}
          <p style={{
            margin: 0, fontSize: 'clamp(8.5px, 0.95vw, 10.5px)', fontWeight: 600,
            color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            Schedule Smarter, Not Harder
          </p>

          {/* Get Started Button */}
          <button
            className="landing-btn"
            onClick={e => { e.stopPropagation(); handleEnter() }}
            style={{
              marginTop: 6, padding: '11px 28px', borderRadius: 999,
              border: 'none', background: '#2563eb',
              color: '#ffffff', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.02em',
              boxShadow: '0 6px 20px rgba(37,99,235,0.3)',
              pointerEvents: 'auto',
              opacity: btnVisible ? 1 : 0,
              transform: `scale(${btnVisible ? 1 : 0.85})`,
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            Get started →
          </button>

          {/* Keyboard hint */}
          <p style={{
            margin: 0, fontSize: 10, color: '#94a3b8', letterSpacing: '0.04em',
            opacity: btnVisible ? 1 : 0, transition: 'opacity 0.6s ease 0.3s',
          }}>
            or press Enter to continue
          </p>
        </div>
      </div>
    </>
  )
}