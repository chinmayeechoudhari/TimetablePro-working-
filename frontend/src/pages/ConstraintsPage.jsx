import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'

function Badge({ type }) {
  const isHard = type === 'hard'
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      background: isHard ? '#fff1f0' : '#f0fff4',
      color: isHard ? '#cf1322' : '#237804',
      border: `1px solid ${isHard ? '#ffa39e' : '#95de64'}`,
    }}>{type}</span>
  )
}

/* ── Icons ── */
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function SparkleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/* ── History Modal ── */
function HistoryModal({ rules, onClose, onRemove }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const shown = useMemo(() => {
    return rules.filter(r => {
      const typeOk = filter === 'all' || r.constraint_type === filter
      const text = (r.constraint?.explanation || r.constraint_name || '').toLowerCase()
      const searchOk = !search || text.includes(search.toLowerCase())
      return typeOk && searchOk
    })
  }, [rules, filter, search])

  return (
    <>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .history-modal-inner { animation: modalFadeIn 0.22s cubic-bezier(.34,1.56,.64,1) forwards; }
      `}</style>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="history-modal-inner" style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 20, width: 620, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#e0f2fe,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a7cf7' }}>
                <HistoryIcon />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main, #111827)' }}>Constraint History</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)' }}>{rules.length} total rule{rules.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #6b7280)', padding: 6, borderRadius: 8 }}>
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color, #f3f4f6)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #9ca3af)' }}><SearchIcon /></span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search constraints…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 34px', border: '1px solid var(--input-border, #e5e7eb)', borderRadius: 9, fontSize: 13, outline: 'none', background: 'var(--input-bg, #fafafa)', color: 'var(--text-main, #1e293b)' }}
              />
            </div>
            {['all', 'hard', 'soft'].map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 0,
                  background: filter === t ? (t === 'hard' ? '#fff1f0' : t === 'soft' ? '#f0fff4' : '#e0e7ff') : 'var(--border-color, #f3f4f6)',
                  color: filter === t ? (t === 'hard' ? '#cf1322' : t === 'soft' ? '#237804' : '#4a7cf7') : 'var(--text-muted, #6b7280)',
                  transition: 'all 0.15s',
                }}
              >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {shown.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: 13 }}>
                No constraints match your filter.
              </div>
            ) : shown.map(rule => (
              <div key={rule.constraint_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border-color, #f9fafb)' }}>
                <div style={{ flexShrink: 0, paddingTop: 2 }}><Badge type={rule.constraint_type} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-main, #374151)', lineHeight: 1.55 }}>
                    {rule.constraint?.explanation || rule.constraint_name || 'Saved constraint'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #9ca3af)', marginTop: 4 }}>ID #{rule.constraint_id}</div>
                </div>
                <button
                  onClick={() => onRemove(rule.constraint_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, paddingTop: 2 }}
                >
                  <TrashIcon /> Remove
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color, #f3f4f6)', background: 'var(--bg-page, #fafafa)', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid var(--border-color, #e5e7eb)', borderRadius: 9, background: 'var(--bg-card, #fff)', color: 'var(--text-main, #374151)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Main Page ── */
export default function ConstraintsPage() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewWarnings, setPreviewWarnings] = useState([])
  const [clarification, setClarification] = useState(null)
  const [selection, setSelection] = useState(null)
  const [confirmedPreview, setConfirmedPreview] = useState(null)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showHistory, setShowHistory] = useState(false)

  async function loadRules() {
    try {
      const res = await axios.get(`${BASE}/constraints`)
      setRules(Array.isArray(res.data) ? res.data : [])
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not load active constraints')
    }
  }

  async function loadSuggestions() {
    try {
      const res = await axios.get(`${BASE}/constraints/suggestions`)
      if (Array.isArray(res.data) && res.data.length > 0) setSuggestions(res.data)
    } catch {
      // Fall back to static examples
      setSuggestions([
        'No classes on Tuesday.',
        'No OS Lab on Tuesday.',
        'OS cannot occur on Tuesday.',
        'Rahul cannot teach Monday period 3.',
      ])
    }
  }

  useEffect(() => {
    loadRules()
    loadSuggestions()
  }, [])

  async function review(extraSelection = null) {
    const value = text.trim()
    if (!value) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    setPreview(null)
    setPreviewWarnings([])
    if (!extraSelection) setClarification(null)

    try {
      const res = await axios.post(`${BASE}/constraints/preview`, {
        text: value,
        selection: extraSelection,
      })
      if (res.data?.status === 'needs_clarification') {
        setClarification(res.data)
        setSelection(extraSelection || null)
      } else {
        setClarification(null)
        setSelection(null)
        setPreview(res.data?.constraint || null)
        setPreviewWarnings(res.data?.warnings || [])
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not interpret this constraint')
    } finally {
      setLoading(false)
    }
  }

  async function resolveSelection() {
    if (!selection) return
    await review(selection)
  }

  function confirmMeaning() {
    if (!preview) return
    setConfirmedPreview(preview)
    setPreview(null)
    setPreviewWarnings([])
    setError(null)
    setSuccess(null)
  }

  function resetReview() {
    setPreview(null)
    setClarification(null)
    setSelection(null)
    setConfirmedPreview(null)
    setPreviewWarnings([])
    setError(null)
  }

  async function applyConstraint() {
    if (!confirmedPreview) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await axios.post(`${BASE}/constraints`, { constraint: confirmedPreview })
      setConfirmedPreview(null)
      setText('')
      await loadRules()
      setSuccess('Constraint added successfully. It will be used the next time you generate a timetable.')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not add this constraint')
    } finally {
      setSaving(false)
    }
  }

  async function removeConstraint(id) {
    if (!window.confirm('Remove this constraint?')) return
    try {
      await axios.delete(`${BASE}/constraints/${id}`)
      setRules(current => current.filter(rule => rule.constraint_id !== id))
      setSuccess('Constraint removed from the active rule set.')
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not remove constraint')
    }
  }

  const hardCount = useMemo(() => rules.filter(r => r.constraint_type === 'hard').length, [rules])
  const softCount = useMemo(() => rules.filter(r => r.constraint_type === 'soft').length, [rules])

  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const typeOk = typeFilter === 'all' || r.constraint_type === typeFilter
      const text = (r.constraint?.explanation || r.constraint_name || '').toLowerCase()
      const searchOk = !searchQuery || text.includes(searchQuery.toLowerCase())
      return typeOk && searchOk
    })
  }, [rules, typeFilter, searchQuery])

  const s = {
    page: {
      minHeight: '100%',
      padding: '32px 36px 60px',
      boxSizing: 'border-box',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      color: 'var(--text-main, #1a202c)',
      background: 'var(--bg-page, #f7f9fc)',
    },
    shell: { maxWidth: 1200, margin: '0 auto' },

    eyebrow: { fontSize: 11, fontWeight: 700, color: '#4a7cf7', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 },
    h1: { margin: '0 0 6px', fontSize: 32, fontWeight: 800, color: 'var(--text-main, #111827)', letterSpacing: '-0.02em' },
    headerSub: { margin: 0, fontSize: 13.5, color: 'var(--text-muted, #6b7280)', lineHeight: 1.6 },

    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
    howItWorks: {
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: 14,
      padding: '14px 18px',
      minWidth: 240,
      maxWidth: 280,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    },
    howTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text-main, #111827)', marginBottom: 6 },
    howBody: { fontSize: 12, color: 'var(--text-muted, #6b7280)', lineHeight: 1.6, margin: 0 },

    grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)', gap: 20, alignItems: 'start' },

    card: {
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      overflow: 'hidden',
    },
    cardHead: {
      padding: '18px 22px 16px',
      borderBottom: '1px solid var(--border-color, #f3f4f6)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    },
    cardHeadIcon: {
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, #e8f0fe, #dbeafe)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#4a7cf7', flexShrink: 0,
    },
    cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-main, #111827)', margin: 0 },
    cardSub: { fontSize: 12, color: 'var(--text-muted, #9ca3af)', marginTop: 3 },
    cardBody: { padding: '20px 22px 24px' },

    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: 120,
      resize: 'vertical',
      padding: '14px 16px',
      border: '1.5px solid var(--input-border, #e5e7eb)',
      borderRadius: 12,
      outline: 'none',
      color: 'var(--text-main, #1e293b)',
      background: 'var(--input-bg, #fafafa)',
      fontFamily: 'inherit',
      fontSize: 13.5,
      lineHeight: 1.6,
      transition: 'border-color 0.15s',
    },
    charCount: { textAlign: 'right', fontSize: 11, color: 'var(--text-muted, #9ca3af)', marginTop: 4 },

    examplesLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-main, #374151)', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 6 },
    examplesRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
    example: {
      border: '1px solid var(--border-color, #e5e7eb)',
      background: 'var(--bg-card, #fff)',
      color: 'var(--text-main, #374151)',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 12,
      cursor: 'pointer',
      transition: 'all 0.15s',
    },

    reviewBtn: {
      width: '100%',
      marginTop: 16,
      padding: '13px 20px',
      border: 0,
      borderRadius: 12,
      background: 'linear-gradient(135deg, #4a7cf7, #6b5bf7)',
      color: '#fff',
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    reviewBtnDisabled: {
      background: 'var(--border-color, #e5e7eb)',
      color: 'var(--text-muted, #9ca3af)',
      cursor: 'not-allowed',
    },

    feedback: { marginTop: 14, padding: '11px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5 },
    errorFb: { background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030' },
    successFb: { background: '#f0fff4', border: '1px solid #c6f6d5', color: '#276749' },
    warningFb: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 },

    clarify: { marginTop: 16, padding: 18, border: '1px solid #fde68a', borderRadius: 14, background: '#fffbeb' },
    clarifyTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#92400e' },
    clarifyMsg: { margin: '0 0 12px', fontSize: 12, color: '#78520a', lineHeight: 1.55 },
    option: {
      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 14px', marginBottom: 8, border: '1px solid #fde68a', borderRadius: 10,
      background: 'var(--bg-card, #fff)', textAlign: 'left', cursor: 'pointer',
    },
    optionSelected: { borderColor: '#4a7cf7', boxShadow: '0 0 0 2px rgba(74,124,247,0.12)' },
    optionMain: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-main, #1f2937)' },
    optionMeta: { fontSize: 11, color: 'var(--text-muted, #6b7280)', marginTop: 2 },
    resolveBtn: {
      width: '100%', marginTop: 4, padding: '10px', border: 0, borderRadius: 9,
      background: '#4a7cf7', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    },

    preview: { marginTop: 16, padding: 18, border: '1.5px solid #bfdbfe', borderRadius: 14, background: '#f0f7ff' },
    previewTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    previewLabel: { fontSize: 12.5, fontWeight: 700, color: '#1e40af' },
    explanation: {
      padding: '12px 14px', borderRadius: 10, background: 'var(--bg-card, #fff)',
      border: '1px solid #dbeafe', color: 'var(--text-main, #1e293b)', fontSize: 13, lineHeight: 1.6, marginBottom: 12,
    },
    assumptions: { fontSize: 11, color: '#92400e', marginBottom: 12 },
    previewActions: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 },
    secondaryBtn: {
      padding: '10px', border: '1.5px solid var(--border-color, #e5e7eb)', borderRadius: 9,
      background: 'var(--bg-card, #fff)', color: 'var(--text-main, #374151)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    },
    confirmBtn: {
      padding: '10px', border: 0, borderRadius: 9,
      background: '#16a34a', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    },

    applyBox: { marginTop: 16, padding: 18, border: '1.5px solid #bbf7d0', borderRadius: 14, background: '#f0fdf4' },
    applyLabel: { fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em' },
    applyTitle: { margin: '4px 0 6px', fontSize: 15, fontWeight: 700, color: '#14532d' },
    applyNote: { fontSize: 12, color: '#4b7155', marginBottom: 12 },
    applyBox2: { padding: '12px 14px', borderRadius: 10, background: 'var(--bg-card, #fff)', border: '1px solid #d1fae5', fontSize: 13, color: 'var(--text-main, #1e293b)', marginBottom: 14 },
    applyActions: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 },
    applyBtn: {
      padding: '10px', border: 0, borderRadius: 9,
      background: '#16a34a', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    },

    aboutBox: {
      marginTop: 16, padding: '14px 16px',
      border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 12,
      background: 'var(--bg-card, #fafafa)', display: 'flex', gap: 10, alignItems: 'flex-start',
    },
    aboutIcon: { color: 'var(--text-muted, #6b7280)', flexShrink: 0, marginTop: 2 },
    aboutTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-main, #374151)', margin: '0 0 4px' },
    aboutText: { fontSize: 12, color: 'var(--text-muted, #6b7280)', lineHeight: 1.6, margin: 0 },

    overviewCard: {
      background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden',
    },
    overviewHead: { padding: '20px 22px 14px', borderBottom: '1px solid var(--border-color, #f3f4f6)', display: 'flex', alignItems: 'flex-start', gap: 12 },
    overviewIcon: {
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a7cf7', flexShrink: 0,
    },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '16px 22px', borderBottom: '1px solid var(--border-color, #f3f4f6)' },
    statBox: { padding: '12px 10px', border: '1px solid var(--border-color, #f3f4f6)', borderRadius: 12, background: 'var(--bg-page, #fafafa)', textAlign: 'center' },
    statNum: { fontSize: 26, fontWeight: 800, color: 'var(--text-main, #111827)', display: 'block' },
    statLabel: { fontSize: 11, color: 'var(--text-muted, #9ca3af)', marginTop: 4, display: 'block' },
    statNumBlue: { fontSize: 26, fontWeight: 800, color: '#2563eb', display: 'block' },
    statNumGreen: { fontSize: 26, fontWeight: 800, color: '#16a34a', display: 'block' },

    filterBar: { padding: '12px 22px', borderBottom: '1px solid var(--border-color, #f3f4f6)', display: 'flex', gap: 8, alignItems: 'center' },
    searchInput: {
      flex: 1, padding: '7px 10px 7px 32px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8,
      fontSize: 12.5, outline: 'none', background: 'var(--input-bg, #fafafa)', color: 'var(--text-main, #1e293b)', boxSizing: 'border-box',
    },
    filterTab: {
      padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 0, transition: 'all 0.15s',
    },

    activeHead: { padding: '14px 22px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-main, #111827)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    rulesList: { padding: '0 22px 6px' },
    ruleItem: {
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0',
      borderBottom: '1px solid var(--border-color, #f3f4f6)',
    },
    ruleBadgeWrap: { flexShrink: 0, paddingTop: 2 },
    ruleContent: { flex: 1 },
    ruleName: { fontSize: 13, color: 'var(--text-main, #374151)', lineHeight: 1.55, margin: 0 },
    removeBtn: {
      display: 'flex', alignItems: 'center', gap: 4,
      border: 0, background: 'transparent', color: '#ef4444',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, paddingTop: 2,
    },
    emptyState: { padding: '32px 22px', textAlign: 'center', color: 'var(--text-muted, #9ca3af)', fontSize: 13 },
    historyBtn: {
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 22px', border: 0, borderTop: '1px solid var(--border-color, #f3f4f6)',
      background: 'var(--bg-card, #fff)', color: 'var(--text-muted, #4b5563)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      transition: 'background 0.15s',
    },
  }

  return (
    <div style={s.page}>
      <style>{`
        .constraint-example-btn:hover { background: #eff6ff !important; border-color: #2563eb !important; color: #2563eb !important; }
        .history-btn:hover { background: #f9fafb !important; }
        .filter-tab-active { background: #e0e7ff !important; color: #4a7cf7 !important; }
        .filter-tab-hard-active { background: #fff1f0 !important; color: #cf1322 !important; }
        .filter-tab-soft-active { background: #f0fff4 !important; color: #237804 !important; }
        textarea:focus { border-color: #4a7cf7 !important; }
      `}</style>

      {showHistory && (
        <HistoryModal
          rules={rules}
          onClose={() => setShowHistory(false)}
          onRemove={async id => {
            await removeConstraint(id)
          }}
        />
      )}

      <div style={s.shell}>
        {/* Header */}
        <div style={s.headerRow}>
          <div>
            <div style={s.eyebrow}>SCHEDULING INTELLIGENCE</div>
            <h1 style={s.h1}>Constraints</h1>
            <p style={s.headerSub}>
              Define scheduling rules and constraints in plain English.<br />
              Our AI will interpret them and apply during timetable generation.
            </p>
          </div>
          <div style={s.howItWorks}>
            <div style={s.howTitle}>
              <SparkleIcon size={16} />
              How it works
            </div>
            <p style={s.howBody}>
              Describe your rules naturally — hard rules like "must" or "cannot", or soft preferences using "try to" or "ideally". The AI interprets and enforces them.
            </p>
          </div>
        </div>

        {/* Two-column grid */}
        <div style={s.grid}>

          {/* LEFT: Add new constraint */}
          <div>
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardHeadIcon}><EditIcon /></div>
                <div>
                  <p style={s.cardTitle}>Add a new constraint</p>
                  <p style={{ ...s.cardSub, margin: 0 }}>Describe your scheduling rule or restriction</p>
                </div>
              </div>
              <div style={s.cardBody}>
                <textarea
                  style={s.textarea}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="For example: No OS Lab sessions on Tuesday."
                  disabled={!!confirmedPreview}
                  maxLength={500}
                />
                <div style={s.charCount}>{text.length}/500</div>

                {/* Dynamic quick examples */}
                {suggestions.length > 0 && (
                  <>
                    <div style={s.examplesLabel}>
                      <SparkleIcon size={13} /> Quick examples
                    </div>
                    <div style={s.examplesRow}>
                      {suggestions.map(ex => (
                        <button
                          key={ex}
                          className="constraint-example-btn"
                          style={s.example}
                          onClick={() => setText(ex)}
                          disabled={!!confirmedPreview}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Review button */}
                <button
                  style={loading || !text.trim() || !!confirmedPreview
                    ? { ...s.reviewBtn, ...s.reviewBtnDisabled }
                    : s.reviewBtn}
                  onClick={() => review()}
                  disabled={loading || !text.trim() || !!confirmedPreview}
                >
                  <SparkleIcon size={16} />
                  {loading ? 'Interpreting…' : 'Review constraint'}
                  {!loading && <span style={{ marginLeft: 'auto' }}>→</span>}
                </button>

                {/* Feedback */}
                {error && <div style={{ ...s.feedback, ...s.errorFb }}>{error}</div>}
                {success && <div style={{ ...s.feedback, ...s.successFb }}>{success}</div>}

                {/* Warnings from backend */}
                {previewWarnings.length > 0 && (
                  <div style={{ ...s.feedback, ...s.warningFb }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}><WarningIcon /></span>
                    <div>
                      {previewWarnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  </div>
                )}

                {/* Clarification */}
                {clarification && (
                  <div style={s.clarify}>
                    <p style={s.clarifyTitle}>Which registration should this rule apply to?</p>
                    <p style={s.clarifyMsg}>{clarification.message}</p>
                    {clarification.options.map(option => {
                      const key = `${option.subject_id}-${option.class_id}-${option.subject_type}`
                      const selected = selection?.subject_id === option.subject_id
                      return (
                        <button
                          key={key}
                          style={selected ? { ...s.option, ...s.optionSelected } : s.option}
                          onClick={() => setSelection({ subject_id: option.subject_id, class_id: option.class_id, subject_type: option.subject_type })}
                        >
                          <div>
                            <div style={s.optionMain}>{option.subject_name} — {option.class_name}</div>
                            <div style={s.optionMeta}>{option.subject_type}</div>
                          </div>
                          <input type="radio" checked={selected} onChange={() => {}} style={{ accentColor: '#4a7cf7' }} />
                        </button>
                      )
                    })}
                    <button style={s.resolveBtn} onClick={resolveSelection} disabled={!selection || loading}>
                      {loading ? 'Resolving…' : 'Use this class and type →'}
                    </button>
                  </div>
                )}

                {/* Preview / Step 1 */}
                {preview && (
                  <div style={s.preview}>
                    <div style={s.previewTop}>
                      <div style={s.previewLabel}>Step 1 · Review interpretation</div>
                      <Badge type={preview.constraint_type} />
                    </div>
                    <div style={s.explanation}>{preview.explanation}</div>
                    {preview.assumptions?.length > 0 && (
                      <div style={s.assumptions}><strong>Assumptions:</strong> {preview.assumptions.join(' · ')}</div>
                    )}
                    <div style={s.previewActions}>
                      <button style={s.secondaryBtn} onClick={resetReview}>No, edit</button>
                      <button style={s.confirmBtn} onClick={confirmMeaning}>Yes, that's what I mean</button>
                    </div>
                  </div>
                )}

                {/* Apply / Step 2 */}
                {confirmedPreview && (
                  <div style={s.applyBox}>
                    <div style={s.applyLabel}>STEP 2 · APPLY</div>
                    <p style={s.applyTitle}>Should we apply this rule?</p>
                    <p style={s.applyNote}>The rule is confirmed but is not saved yet.</p>
                    <div style={s.applyBox2}>
                      <strong>{confirmedPreview.explanation}</strong>
                      <div style={{ marginTop: 8 }}><Badge type={confirmedPreview.constraint_type} /></div>
                    </div>
                    <div style={s.applyActions}>
                      <button style={s.secondaryBtn} onClick={resetReview}>Keep editing</button>
                      <button style={s.applyBtn} onClick={applyConstraint} disabled={saving}>
                        {saving ? 'Applying…' : 'Yes — apply to timetable'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* About constraints */}
            <div style={s.aboutBox}>
              <div style={s.aboutIcon}><InfoIcon /></div>
              <div>
                <p style={s.aboutTitle}>About constraints</p>
                <p style={s.aboutText}>
                  <strong>Hard</strong> constraints (must/cannot) are always enforced. <strong>Soft</strong> constraints (prefer/ideally) are respected as much as possible.
                  Constraints help ensure the generated timetable is practical and conflict-free.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Constraint overview */}
          <div style={s.overviewCard}>
            <div style={s.overviewHead}>
              <div style={s.overviewIcon}><ShieldIcon /></div>
              <div>
                <p style={s.cardTitle}>Constraint overview</p>
                <p style={{ ...s.cardSub, margin: 0 }}>Summary of all active constraints</p>
              </div>
            </div>

            {/* Stats */}
            <div style={s.statsRow}>
              <div style={s.statBox}>
                <span style={s.statNum}>{rules.length}</span>
                <span style={s.statLabel}>Active constraints</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statNumBlue}>{hardCount}</span>
                <span style={s.statLabel}>Hard constraints</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statNumGreen}>{softCount}</span>
                <span style={s.statLabel}>Soft constraints</span>
              </div>
            </div>

            {/* Search + Filter bar */}
            <div style={s.filterBar}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}><SearchIcon /></span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search rules…"
                  style={s.searchInput}
                />
              </div>
              {[
                { key: 'all', label: 'All' },
                { key: 'hard', label: 'Hard' },
                { key: 'soft', label: 'Soft' },
              ].map(({ key, label }) => {
                const active = typeFilter === key
                const activeClass = key === 'hard' ? 'filter-tab-hard-active' : key === 'soft' ? 'filter-tab-soft-active' : 'filter-tab-active'
                return (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={active ? activeClass : ''}
                    style={{
                      ...s.filterTab,
                      background: active ? undefined : '#f3f4f6',
                      color: active ? undefined : '#6b7280',
                    }}
                  >{label}</button>
                )
              })}
            </div>

            {/* Active list */}
            <div style={s.activeHead}>
              <span>Active constraints</span>
              {filteredRules.length !== rules.length && (
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                  {filteredRules.length} of {rules.length}
                </span>
              )}
            </div>
            <div style={s.rulesList}>
              {filteredRules.length === 0 ? (
                <div style={s.emptyState}>
                  {rules.length === 0
                    ? <>No active constraints yet.<br /><span style={{ color: '#d1d5db' }}>Add your first rule on the left.</span></>
                    : 'No constraints match your filter.'
                  }
                </div>
              ) : filteredRules.map(rule => (
                <div key={rule.constraint_id} style={s.ruleItem}>
                  <div style={s.ruleBadgeWrap}><Badge type={rule.constraint_type} /></div>
                  <div style={s.ruleContent}>
                    <p style={s.ruleName}>{rule.constraint?.explanation || rule.constraint_name || 'Saved constraint'}</p>
                  </div>
                  <button style={s.removeBtn} onClick={() => removeConstraint(rule.constraint_id)}>
                    <TrashIcon /> Remove
                  </button>
                </div>
              ))}
            </div>

            {/* View history */}
            <button
              className="history-btn"
              style={s.historyBtn}
              onClick={() => setShowHistory(true)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HistoryIcon /> View all constraints & history
              </span>
              <span>›</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
