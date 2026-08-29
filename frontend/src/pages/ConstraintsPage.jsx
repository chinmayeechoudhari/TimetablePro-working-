import { useEffect, useMemo, useState, useRef } from "react"
import axios from "axios"

const BASE = "http://localhost:8000"

function Badge({ type }) {
  const isHard = type === "hard"
  return (
    <span style={{ display: "inline-block", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", background: isHard ? "#fff1f0" : "#eaf8ef", color: isHard ? "#cf1322" : "#16a34a", border: `1px solid ${isHard ? "#ffa39e" : "#bbf7d0"}` }}>{type}</span>
  )
}

function PriorityDropdown({ weight, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const options = [
    { priority: "High (3)", weight: 3, desc: "Highest preference", dot: "#e11d48", bg: "#fff0f2", text: "#e11d48", border: "#fecdd3" },
    { priority: "Medium (2)", weight: 2, desc: "Moderate preference", dot: "#d97706", bg: "#fff7ed", text: "#d97706", border: "#fed7aa" },
    { priority: "Low (1)", weight: 1, desc: "Low preference", dot: "#0284c7", bg: "#f0f9ff", text: "#0284c7", border: "#bae6fd" },
  ]

  const currentWeight = [1, 2, 3].includes(weight) ? weight : 3
  const currentOpt = options.find(o => o.weight === currentWeight) || options[0]

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 14px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          background: currentOpt.bg,
          color: currentOpt.text,
          border: `1px solid ${currentOpt.border}`,
          cursor: disabled ? "wait" : "pointer",
          transition: "all 0.15s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentOpt.dot, flexShrink: 0 }} />
        <span>{currentOpt.priority}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", marginLeft: 2 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            minWidth: 220,
            background: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
            padding: 6,
            animation: "priorityDropdownIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {options.map(opt => {
            const isSel = currentWeight === opt.weight
            return (
              <button
                key={opt.weight}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(opt.weight)
                  setOpen(false)
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: "none",
                  background: isSel ? "#f8fafc" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                onMouseLeave={(e) => e.currentTarget.style.background = isSel ? "#f8fafc" : "transparent"}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.dot, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>{opt.priority}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{opt.desc} &middot; Weight: {opt.weight}</div>
                </div>
                {isSel && <span style={{ fontSize: 12, fontWeight: 800, color: opt.text }}>&check;</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg> }
function SparkleIcon({ size = 16 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" /></svg> }
function ShieldIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> }
function InfoIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg> }
function EditIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> }
function HistoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg> }
function SearchIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> }
function CloseIcon({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> }
function WarningIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> }
function ArrowLeftIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> }
function CheckIcon() { return <svg width="11" height="11" viewBox="0 0 12 10" fill="none"><path d="M1.5 5l3 3 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function SpinnerIcon({ color = "#4a7cf7", size = 22 }) { return <svg style={{ animation: "spin 1s linear infinite" }} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> }
function GlobeIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> }
function PinIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> }


function HistoryModal({ rules, onClose, onRemove, onUpdatePriority }) {
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const shown = useMemo(() => rules.filter(r => {
    const typeOk = filter === "all" || r.constraint_type === filter
    const text = (r.constraint?.explanation || r.constraint_name || "").toLowerCase()
    return typeOk && (!search || text.includes(search.toLowerCase()))
  }), [rules, filter, search])
  return (
    <>
      <style>{`@keyframes modalFadeIn { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } } .history-modal-inner { animation: modalFadeIn 0.22s cubic-bezier(.34,1.56,.64,1) forwards; }`}</style>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="history-modal-inner" style={{ background: "var(--bg-card, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 20, width: 620, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-color, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#e0f2fe,#dbeafe)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a7cf7" }}><HistoryIcon /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main, #111827)" }}>Constraint History</div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #9ca3af)" }}>{rules.length} total rule{rules.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-muted, #6b7280)", padding: 6, borderRadius: 8 }}><CloseIcon size={18} /></button>
          </div>
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-color, #f3f4f6)", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted, #9ca3af)" }}><SearchIcon /></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search constraints..." style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 34px", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: 9, fontSize: 13, outline: "none", background: "var(--input-bg, #fafafa)", color: "var(--text-main, #1e293b)" }} />
            </div>
            {["all", "hard", "soft"].map(t => (
              <button key={t} onClick={() => setFilter(t)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: 0, background: filter === t ? (t === "hard" ? "#fff1f0" : t === "soft" ? "#f0fff4" : "#e0e7ff") : "var(--border-color, #f3f4f6)", color: filter === t ? (t === "hard" ? "#cf1322" : t === "soft" ? "#237804" : "#4a7cf7") : "var(--text-muted, #6b7280)", transition: "all 0.15s" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {shown.length === 0 ? <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted, #9ca3af)", fontSize: 13 }}>No constraints match your filter.</div>
              : shown.map(rule => (
                <div key={rule.constraint_id} style={{
                  background: "#ffffff",
                  border: "1px solid #f1f5f9",
                  borderRadius: 16,
                  padding: "16px 20px",
                  margin: "12px 24px",
                  display: "grid",
                  gridTemplateColumns: "1fr 190px 80px",
                  gap: 16,
                  alignItems: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Badge type={rule.constraint_type} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827", lineHeight: 1.5 }}>{rule.constraint?.explanation || rule.constraint_name || "Saved constraint"}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>ID #{rule.constraint_id}</div>
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid #f1f5f9", paddingLeft: 16, position: "relative" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>PRIORITY</div>
                    {rule.constraint_type === "soft" ? (
                      <>
                        <PriorityDropdown weight={rule.constraint?.weight} onChange={w => onUpdatePriority && onUpdatePriority(rule.constraint_id, w)} />
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>{(rule.constraint?.weight === 3 || !rule.constraint?.weight) ? "Highest preference" : rule.constraint?.weight === 2 ? "Moderate preference" : "Low preference"}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Weight: {rule.constraint?.weight || 3}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" }}>Absolute (Hard)</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Absolute priority</div>
                      </>
                    )}
                  </div>
                  <div style={{ borderLeft: "1px solid #f1f5f9", paddingLeft: 12, display: "flex", justifyContent: "center" }}>
                    <button onClick={() => onRemove(rule.constraint_id)} style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><TrashIcon /> Remove</button>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color, #f3f4f6)", background: "var(--bg-page, #fafafa)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "9px 20px", border: "1.5px solid var(--border-color, #e5e7eb)", borderRadius: 9, background: "var(--bg-card, #fff)", color: "var(--text-main, #374151)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      </div>
    </>
  )
}


function ConstraintWizard({ clarification, originalText, onBack, onDone }) {
  const [step, setStep] = useState(1)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [globalAll, setGlobalAll] = useState(false)
  const [search, setSearch] = useState("")
  const [tabView, setTabView] = useState("subject")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [previews, setPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveResults, setSaveResults] = useState(null)
  const [wizardWeights, setWizardWeights] = useState({})

  const options = clarification?.options || []
  function optKey(o) { return `${o.subject_id}-${o.class_id}-${o.subject_type}` }

  const filteredOptions = useMemo(() => {
    let list = options
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(o => o.class_name.toLowerCase().includes(q) || (o.subject_type || "").toLowerCase().includes(q)) }
    if (typeFilter !== "all") list = list.filter(o => (o.subject_type || "theory").toLowerCase() === typeFilter)
    return list
  }, [options, search, typeFilter])

  function toggle(o) { const key = optKey(o); setSelectedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }); setGlobalAll(false) }
  function toggleAll() { setGlobalAll(g => !g); setSelectedKeys(new Set()) }
  const hasSelection = globalAll || selectedKeys.size > 0

  function classColor(name) {
    const palette = ["#4a7cf7", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2", "#be185d", "#ea580c"]
    let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
    return palette[Math.abs(h) % palette.length]
  }

  async function handleNext() {
    if (!hasSelection) return
    setLoading(true); setStep(2)
    try {
      const results = []
      if (globalAll) {
        const res = await axios.post(`${BASE}/constraints/preview`, { text: originalText, selection: { subject_id: null, class_id: null, subject_type: null } })
        if (res.data?.constraint) results.push({ constraint: res.data.constraint, label: "All Classes (Global)" })
      } else {
        for (const key of selectedKeys) {
          const opt = options.find(o => optKey(o) === key)
          if (!opt) continue
          try {
            const res = await axios.post(`${BASE}/constraints/preview`, { text: originalText, selection: { subject_id: opt.subject_id, class_id: opt.class_id, subject_type: opt.subject_type } })
            if (res.data?.constraint) results.push({ constraint: res.data.constraint, label: `${opt.class_name} \u00b7 ${opt.subject_type || "theory"}` })
          } catch (e) { results.push({ constraint: null, label: `${opt.class_name} \u00b7 ${opt.subject_type || "theory"}`, error: e?.response?.data?.detail || "Failed" }) }
        }
      }
      setPreviews(results); setStep(3)
    } catch { setStep(1) } finally { setLoading(false) }
  }

  async function handleSave() {
    setSaving(true)
    const results = []
    for (let i = 0; i < previews.length; i++) {
      const { constraint, label, error } = previews[i]
      if (error || !constraint) { results.push({ label, ok: false, error: error || "No constraint" }); continue }
      const weightToUse = wizardWeights[i] ?? (constraint.weight || 3)
      const toSave = constraint.constraint_type === "soft" ? { ...constraint, weight: weightToUse } : constraint
      try { await axios.post(`${BASE}/constraints`, { constraint: toSave }); results.push({ label, ok: true }) }
      catch (e) { const is409 = e?.response?.status === 409; results.push({ label, ok: is409, error: is409 ? "Already active" : (e?.response?.data?.detail || "Save failed") }) }
    }
    setSaveResults(results); setSaving(false)
    if (results.some(r => r.ok)) setTimeout(() => onDone(results), 1800)
  }

  const STEPS = [{ n: 1, label: "Select Class & Type" }, { n: 2, label: "Define Rule" }, { n: 3, label: "Review & Save" }]
  const validPreviews = previews.filter(p => !p.error && p.constraint)

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-page, #f7f9fc)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", color: "var(--text-main, #1a202c)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wFadeIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .w-card { animation: wFadeIn 0.28s cubic-bezier(.2,.8,.4,1) forwards; }
        .opt-btn:hover:not(.opt-btn-sel) { border-color: #93c5fd !important; background: #f8faff !important; }
        .opt-btn-sel { border-color: #4a7cf7 !important; background: #eff6ff !important; box-shadow: 0 0 0 3px rgba(74,124,247,0.12) !important; }
      `}</style>

      <div style={{ background: "var(--bg-card, #fff)", borderBottom: "1px solid var(--border-color, #e5e7eb)", padding: "0 36px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: "#4b5563", fontSize: 13, fontWeight: 600 }}>
          <ArrowLeftIcon /> Back to Constraints
        </button>
        <div style={{ display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: step > s.n ? "#16a34a" : step === s.n ? "#4a7cf7" : "var(--border-color, #e5e7eb)", color: step >= s.n ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, transition: "all 0.3s" }}>
                  {step > s.n ? <CheckIcon /> : s.n}
                </div>
                <span style={{ fontSize: 10.5, color: step === s.n ? "#4a7cf7" : step > s.n ? "#16a34a" : "#9ca3af", fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ width: 72, height: 2, background: step > s.n ? "#16a34a" : "var(--border-color, #e5e7eb)", margin: "0 10px", marginBottom: 18, transition: "background 0.4s" }} />}
            </div>
          ))}
        </div>
        <div style={{ width: 160 }} />
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "36px 28px 60px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main, #111827)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Apply Constraint</h1>
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: 13, margin: "0 0 26px" }}>
          {step === 1 && "Select the exact class and subject type this rule should apply to."}
          {step === 2 && "Interpreting your rule for the selected classes..."}
          {step === 3 && "Review the interpreted constraints before saving them to your timetable."}
        </p>

        {step === 1 && (
          <div className="w-card" style={{ background: "var(--bg-card, #fff)", borderRadius: 18, border: "1px solid var(--border-color, #e5e7eb)", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#4a7cf7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>1</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main, #111827)" }}>Choose class and subject type</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginTop: 2 }}>"{clarification.subject}" is registered for multiple classes. Select one or more combinations.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }}><SearchIcon /></span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classes..." style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 8, fontSize: 12, outline: "none", background: "var(--input-bg, #fafafa)", color: "var(--text-main, #1e293b)", width: 165 }} />
                </div>
                {["all", "theory", "lab"].map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "6px 11px", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 7, background: typeFilter === t ? (t === "lab" ? "#ecfdf5" : t === "theory" ? "#eff6ff" : "#e0e7ff") : "var(--bg-card, #fff)", color: typeFilter === t ? (t === "lab" ? "#059669" : "#4a7cf7") : "#6b7280", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
                ))}
              </div>
            </div>

            <div style={{ padding: "0 24px", borderBottom: "1px solid var(--border-color, #f3f4f6)", display: "flex" }}>
              {[{ id: "subject", label: "By Subject", icon: "\uD83D\uDCCB" }, { id: "class", label: "By Class", icon: "\uD83C\uDFEB" }].map(t => (
                <button key={t.id} onClick={() => setTabView(t.id)} style={{ padding: "10px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, color: tabView === t.id ? "#4a7cf7" : "var(--text-muted, #6b7280)", borderBottom: tabView === t.id ? "2.5px solid #4a7cf7" : "2.5px solid transparent" }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "16px 24px 8px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main, #111827)" }}>{clarification.subject}</span>
              {options[0]?.subject_name && options[0].subject_name !== clarification.subject && <span style={{ fontSize: 13, color: "#9ca3af" }}>&middot; {options[0].subject_name}</span>}
              {selectedKeys.size > 0 && !globalAll && <span style={{ padding: "2px 10px", borderRadius: 20, background: "#dbeafe", color: "#2563eb", fontSize: 11.5, fontWeight: 700 }}>{selectedKeys.size} selected</span>}
              {globalAll && <span style={{ padding: "2px 10px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", fontSize: 11.5, fontWeight: 700 }}>All classes</span>}
            </div>

            <div style={{ padding: "6px 24px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 10 }}>
              {filteredOptions.length === 0
                ? <div style={{ gridColumn: "1/-1", padding: "28px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No matches found.</div>
                : filteredOptions.map(option => {
                  const key = optKey(option)
                  const isSel = selectedKeys.has(key)
                  const color = classColor(option.class_name)
                  const isLab = (option.subject_type || "").toLowerCase() === "lab"
                  return (
                    <button key={key} className={`opt-btn${isSel ? " opt-btn-sel" : ""}`} onClick={() => toggle(option)}
                      style={{ padding: 14, border: isSel ? "2px solid #4a7cf7" : "1.5px solid var(--border-color, #e5e7eb)", borderRadius: 12, background: "var(--bg-card, #fff)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10, transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{option.class_name.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-main, #111827)" }}>{option.class_name}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, textTransform: "capitalize", background: isLab ? "#ecfdf5" : "#eff6ff", color: isLab ? "#059669" : "#4a7cf7", border: `1px solid ${isLab ? "#a7f3d0" : "#bfdbfe"}` }}>{option.subject_type || "theory"}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted, #6b7280)", lineHeight: 1.4 }}>Apply to {clarification.subject} {option.subject_type || "theory"} for {option.class_name}</div>
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: isSel ? "2px solid #4a7cf7" : "1.5px solid #d1d5db", background: isSel ? "#4a7cf7" : "var(--bg-card, #fff)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", marginTop: 2 }}>
                        {isSel && <CheckIcon />}
                      </div>
                    </button>
                  )
                })}
            </div>

            <div style={{ padding: "0 24px 20px" }}>
              <button onClick={toggleAll} style={{ width: "100%", padding: "14px 16px", border: globalAll ? "2px solid #4a7cf7" : "1.5px solid var(--border-color, #e5e7eb)", borderRadius: 13, background: globalAll ? "#eff6ff" : "var(--bg-page, #fafafa)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, boxShadow: globalAll ? "0 0 0 3px rgba(74,124,247,0.1)" : "none", transition: "all 0.15s" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e0f2fe", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><GlobeIcon /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-main, #111827)", marginBottom: 2 }}>All Classes (Global)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted, #6b7280)" }}>Apply this rule to {clarification.subject} (theory &amp; lab) across all classes</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: globalAll ? "2px solid #4a7cf7" : "1.5px solid #d1d5db", background: globalAll ? "#4a7cf7" : "var(--bg-card, #fff)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                  {globalAll && <CheckIcon />}
                </div>
              </button>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color, #f3f4f6)", background: "var(--bg-page, #fafafa)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted, #6b7280)", fontSize: 12 }}>
                <PinIcon /> Not seeing the class or type you need? Make sure the subject is added for that class.
              </div>
              <button onClick={handleNext} disabled={!hasSelection} style={{ padding: "10px 22px", border: "none", borderRadius: 10, background: hasSelection ? "#4a7cf7" : "#e5e7eb", color: hasSelection ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 700, cursor: hasSelection ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                {hasSelection && !globalAll && selectedKeys.size > 0 && <span style={{ background: "rgba(255,255,255,0.22)", borderRadius: 4, padding: "1px 7px", fontSize: 11 }}>{selectedKeys.size}</span>}
                Use this class and type &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-card" style={{ background: "var(--bg-card, #fff)", borderRadius: 18, border: "1px solid var(--border-color, #e5e7eb)", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", padding: "70px 40px", textAlign: "center" }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#eff6ff", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center" }}><SpinnerIcon size={26} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main, #111827)", marginBottom: 6 }}>Interpreting your rule...</div>
            <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)" }}>Processing {globalAll ? "global" : selectedKeys.size} selection{(!globalAll && selectedKeys.size !== 1) ? "s" : ""}</div>
          </div>
        )}

        {step === 3 && (
          <div className="w-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => { setStep(1); setSaveResults(null) }} disabled={saving || !!saveResults} style={{ padding: "8px 16px", border: "1.5px solid var(--border-color, #e5e7eb)", borderRadius: 9, background: "var(--bg-card, #fff)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 5, opacity: (saving || saveResults) ? 0.4 : 1 }}>
                <ArrowLeftIcon /> Back
              </button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main, #111827)" }}>{previews.length} constraint{previews.length !== 1 ? "s" : ""} ready to apply</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{originalText}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {previews.map(({ constraint, label, error }, i) => {
                const res = saveResults?.[i]
                return (
                  <div key={i} style={{ background: "var(--bg-card, #fff)", borderRadius: 14, border: res ? (res.ok ? "1.5px solid #86efac" : "1.5px solid #fca5a5") : "1px solid var(--border-color, #e5e7eb)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", transition: "border-color 0.3s" }}>
                    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color, #f3f4f6)", display: "flex", alignItems: "center", gap: 10, background: res ? (res.ok ? "#f0fdf4" : "#fff5f5") : "var(--bg-page, #fafafa)" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#4a7cf7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #111827)", flex: 1 }}>{label}</span>
                      {constraint && <Badge type={constraint.constraint_type} weight={constraint.constraint_type === "soft" ? (wizardWeights[i] ?? constraint.weight ?? 3) : null} />}
                      {res && <span style={{ fontSize: 12, fontWeight: 700, color: res.ok ? "#166534" : "#991b1b" }}>{res.ok ? "\u2713 Saved" : `\u2717 ${res.error}`}</span>}
                    </div>
                    <div style={{ padding: "14px 18px", fontSize: 13, color: error ? "#c53030" : "var(--text-main, #374151)", lineHeight: 1.65 }}>
                      {error ? `\u26a0 ${error}` : constraint?.explanation}
                      {constraint?.constraint_type === "soft" && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>
                            What priority should this constraint have?
                          </label>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                            {[
                              { priority: "High", weight: 3, desc: "Weight 3" },
                              { priority: "Medium", weight: 2, desc: "Weight 2" },
                              { priority: "Low", weight: 1, desc: "Weight 1" },
                            ].map(opt => {
                              const currW = wizardWeights[i] ?? (constraint.weight || 3)
                              const isSel = currW === opt.weight
                              return (
                                <button key={opt.weight} type="button" onClick={() => setWizardWeights(prev => ({ ...prev, [i]: opt.weight }))}
                                  style={{ padding: "7px 10px", borderRadius: 8, border: isSel ? "2px solid #2563eb" : "1px solid #cbd5e1", background: isSel ? "#eff6ff" : "#fff", color: isSel ? "#1e40af" : "#475569", fontWeight: isSel ? 700 : 500, cursor: "pointer", textAlign: "center", fontSize: 12 }}>
                                  <div style={{ fontWeight: 700 }}>{opt.priority}</div>
                                  <div style={{ fontSize: 10.5, opacity: 0.8 }}>{opt.desc}</div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {!saveResults && (
              <button onClick={handleSave} disabled={saving || validPreviews.length === 0} style={{ width: "100%", padding: 14, border: "none", borderRadius: 12, background: validPreviews.length > 0 ? "#16a34a" : "#9ca3af", color: "#fff", fontSize: 14, fontWeight: 700, cursor: validPreviews.length > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving ? <><SpinnerIcon color="#fff" size={16} /> Saving...</> : `Apply ${validPreviews.length} Constraint${validPreviews.length !== 1 ? "s" : ""} to Timetable`}
              </button>
            )}
            {saveResults && saveResults.every(r => r.ok) && (
              <div style={{ textAlign: "center", padding: 18, color: "#16a34a", fontSize: 14, fontWeight: 700 }}>\u2713 All constraints applied! Returning...</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


export default function ConstraintsPage() {
  const [text, setText] = useState("")
  const [preview, setPreview] = useState(null)
  const [previewWarnings, setPreviewWarnings] = useState([])
  const [clarification, setClarification] = useState(null)
  const [confirmedPreview, setConfirmedPreview] = useState(null)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showHistory, setShowHistory] = useState(false)
  const [wizardActive, setWizardActive] = useState(false)
  const [selectedWeight, setSelectedWeight] = useState(3)

  async function loadRules() {
    try { const res = await axios.get(`${BASE}/constraints`); setRules(Array.isArray(res.data) ? res.data : []); setError(null) }
    catch (err) { setError(err?.response?.data?.detail || err?.message || "Could not load active constraints") }
  }
  async function loadSuggestions() {
    try { const res = await axios.get(`${BASE}/constraints/suggestions`); if (Array.isArray(res.data) && res.data.length > 0) setSuggestions(res.data) }
    catch { setSuggestions(["No classes on Tuesday.", "No OS Lab on Tuesday.", "OS cannot occur on Tuesday.", "Rahul cannot teach Monday period 3."]) }
  }
  useEffect(() => { loadRules(); loadSuggestions() }, [])

  async function review() {
    const value = text.trim(); if (!value) return
    setLoading(true); setError(null); setSuccess(null); setPreview(null); setPreviewWarnings([]); setClarification(null)
    try {
      const res = await axios.post(`${BASE}/constraints/preview`, { text: value, selection: null })
      if (res.data?.status === "needs_clarification") { setClarification(res.data); setWizardActive(true) }
      else {
        const c = res.data?.constraint || null
        setPreview(c)
        if (c?.constraint_type === "soft") {
          setSelectedWeight(c.weight || 3)
        }
        setPreviewWarnings(res.data?.warnings || [])
      }
    } catch (err) { setError(err?.response?.data?.detail || err?.message || "Could not interpret this constraint") }
    finally { setLoading(false) }
  }

  function confirmMeaning() {
    if (!preview) return
    const finalConstraint = {
      ...preview,
      weight: preview.constraint_type === "soft" ? selectedWeight : null,
    }
    setConfirmedPreview(finalConstraint)
    setPreview(null)
    setPreviewWarnings([])
    setError(null)
    setSuccess(null)
  }
  function resetReview() { setPreview(null); setClarification(null); setConfirmedPreview(null); setPreviewWarnings([]); setError(null) }

  async function applyConstraint() {
    if (!confirmedPreview) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      await axios.post(`${BASE}/constraints`, { constraint: confirmedPreview })
      setConfirmedPreview(null); setText(""); await loadRules()
      setSuccess("Constraint added successfully.")
    } catch (err) { setError(err?.response?.data?.detail || err?.message || "Could not add this constraint") }
    finally { setSaving(false) }
  }

  async function removeConstraint(id) {
    if (!window.confirm("Remove this constraint?")) return
    try { await axios.delete(`${BASE}/constraints/${id}`); setRules(c => c.filter(r => r.constraint_id !== id)); setSuccess("Constraint removed."); setError(null) }
    catch (err) { setError(err?.response?.data?.detail || err?.message || "Could not remove constraint") }
  }

  async function updateConstraintPriority(id, newWeight) {
    try {
      let res
      try {
        res = await axios.patch(`${BASE}/constraints/${id}`, { weight: newWeight })
      } catch (err) {
        if (err?.response?.status === 405) {
          res = await axios.post(`${BASE}/constraints/${id}/priority`, { weight: newWeight })
        } else {
          throw err
        }
      }
      setRules(prev => prev.map(r => r.constraint_id === id ? res.data : r))
      const priorityLabel = newWeight === 3 ? "High (Weight 3)" : newWeight === 2 ? "Medium (Weight 2)" : "Low (Weight 1)"
      setSuccess(`Constraint priority updated to ${priorityLabel}.`)
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not update priority")
    }
  }

  function handleWizardBack() { setWizardActive(false); setClarification(null) }
  async function handleWizardDone(results) {
    setWizardActive(false); setClarification(null); setText(""); await loadRules()
    const saved = results.filter(r => r.ok).length
    setSuccess(`${saved} constraint${saved !== 1 ? "s" : ""} added successfully.`)
  }

  function formatConstraintDate(rule) {
    if (rule.created_at) {
      try {
        const d = new Date(rule.created_at)
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      } catch {
        // fallback
      }
    }
    return "28 Aug 2025, 10:55 PM"
  }

  const hardCount = useMemo(() => rules.filter(r => r.constraint_type === "hard").length, [rules])
  const softCount = useMemo(() => rules.filter(r => r.constraint_type === "soft").length, [rules])
  const filteredRules = useMemo(() => rules.filter(r => {
    const tOk = typeFilter === "all" || r.constraint_type === typeFilter
    const txt = (r.constraint?.explanation || r.constraint_name || "").toLowerCase()
    return tOk && (!searchQuery || txt.includes(searchQuery.toLowerCase()))
  }), [rules, typeFilter, searchQuery])

  if (wizardActive && clarification) {
    return <ConstraintWizard clarification={clarification} originalText={text} onBack={handleWizardBack} onDone={handleWizardDone} />
  }

  const s = {
    page: { minHeight: "100%", padding: "32px 40px 60px", boxSizing: "border-box", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", color: "#1a202c", background: "#f8fafc" },
    shell: { maxWidth: 1440, margin: "0 auto" },
    eyebrow: { fontSize: 11, fontWeight: 700, color: "#4a7cf7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 },
    h1: { margin: "0 0 6px", fontSize: 30, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" },
    headerSub: { margin: 0, fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 },
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
    howItWorks: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px", minWidth: 260, maxWidth: 300, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
    howTitle: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 },
    howBody: { fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: 0 },
    grid: { display: "grid", gridTemplateColumns: "minmax(380px, 1fr) minmax(540px, 1.35fr)", gap: 24, alignItems: "start" },
    card: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", overflow: "hidden" },
    cardHead: { padding: "18px 22px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: 12 },
    cardHeadIcon: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #e8f0fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a7cf7", flexShrink: 0 },
    cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
    cardSub: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
    cardBody: { padding: "20px 22px 24px" },
    textarea: { width: "100%", boxSizing: "border-box", minHeight: 120, resize: "vertical", padding: "14px 16px", border: "1.5px solid #e5e7eb", borderRadius: 12, outline: "none", color: "#1e293b", background: "#fafafa", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, transition: "border-color 0.15s" },
    charCount: { textAlign: "right", fontSize: 11, color: "#9ca3af", marginTop: 4 },
    examplesLabel: { fontSize: 12, fontWeight: 600, color: "#374151", margin: "14px 0 8px", display: "flex", alignItems: "center", gap: 6 },
    examplesRow: { display: "flex", flexWrap: "wrap", gap: 8 },
    example: { border: "1px solid #e5e7eb", background: "#ffffff", color: "#374151", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", transition: "all 0.15s" },
    reviewBtn: { width: "100%", marginTop: 16, padding: "13px 20px", border: 0, borderRadius: 12, background: "linear-gradient(135deg, #4a7cf7, #6b5bf7)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
    reviewBtnDisabled: { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" },
    feedback: { marginTop: 14, padding: "11px 14px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.5 },
    errorFb: { background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030" },
    successFb: { background: "#f0fff4", border: "1px solid #c6f6d5", color: "#276749" },
    warningFb: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 },
    preview: { marginTop: 16, padding: 18, border: "1.5px solid #bfdbfe", borderRadius: 14, background: "#f0f7ff" },
    previewTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    previewLabel: { fontSize: 12.5, fontWeight: 700, color: "#1e40af" },
    explanation: { padding: "12px 14px", borderRadius: 10, background: "#ffffff", border: "1px solid #dbeafe", color: "#1e293b", fontSize: 13, lineHeight: 1.6, marginBottom: 12 },
    assumptions: { fontSize: 11, color: "#92400e", marginBottom: 12 },
    previewActions: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 },
    secondaryBtn: { padding: 10, border: "1.5px solid #e5e7eb", borderRadius: 9, background: "#ffffff", color: "#374151", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
    confirmBtn: { padding: 10, border: 0, borderRadius: 9, background: "#16a34a", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
    applyBox: { marginTop: 16, padding: 18, border: "1.5px solid #bbf7d0", borderRadius: 14, background: "#f0fdf4" },
    applyLabel: { fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.1em" },
    applyTitle: { margin: "4px 0 6px", fontSize: 15, fontWeight: 700, color: "#14532d" },
    applyNote: { fontSize: 12, color: "#4b7155", marginBottom: 12 },
    applyBox2: { padding: "12px 14px", borderRadius: 10, background: "#ffffff", border: "1px solid #d1fae5", fontSize: 13, color: "#1e293b", marginBottom: 14 },
    applyActions: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 },
    applyBtn: { padding: 10, border: 0, borderRadius: 9, background: "#16a34a", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
    aboutBox: { marginTop: 16, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff", display: "flex", gap: 10, alignItems: "flex-start" },
    aboutIcon: { color: "#6b7280", flexShrink: 0, marginTop: 2 },
    aboutTitle: { fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 4px" },
    aboutText: { fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: 0 },
    overviewCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.03)", overflow: "hidden" },
    overviewHead: { padding: "20px 22px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: 12 },
    overviewIcon: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #e0f2fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4a7cf7", flexShrink: 0 },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "16px 22px", borderBottom: "1px solid #f3f4f6" },
    statBox: { padding: "12px 10px", border: "1px solid #f3f4f6", borderRadius: 12, background: "#fafafa", textAlign: "center" },
    statNum: { fontSize: 26, fontWeight: 800, color: "#111827", display: "block" },
    statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" },
    statNumBlue: { fontSize: 26, fontWeight: 800, color: "#2563eb", display: "block" },
    statNumGreen: { fontSize: 26, fontWeight: 800, color: "#16a34a", display: "block" },
    filterBar: { padding: "12px 22px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 8, alignItems: "center" },
    searchInput: { flex: 1, padding: "8px 12px 8px 34px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12.5, outline: "none", background: "#fafafa", color: "#1e293b", boxSizing: "border-box" },
    filterTab: { padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: 0, transition: "all 0.15s" },
    activeHead: { padding: "16px 22px 12px", fontSize: 14, fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", justifyContent: "space-between" },
    rulesList: { padding: "0 22px 6px" },
    historyBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", border: 0, borderTop: "1px solid #f3f4f6", background: "#ffffff", color: "#4b5563", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" },
  }

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes priorityDropdownIn { from { opacity: 0; transform: translateY(-6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .constraint-example-btn:hover { background: #eff6ff !important; border-color: #2563eb !important; color: #2563eb !important; }
        .history-btn:hover { background: #f9fafb !important; }
        .filter-tab-active { background: #e0e7ff !important; color: #4a7cf7 !important; }
        .filter-tab-hard-active { background: #fff1f0 !important; color: #cf1322 !important; }
        .filter-tab-soft-active { background: #f0fff4 !important; color: #237804 !important; }
        textarea:focus { border-color: #4a7cf7 !important; }
      `}</style>

      {showHistory && <HistoryModal rules={rules} onClose={() => setShowHistory(false)} onRemove={async id => { await removeConstraint(id) }} onUpdatePriority={updateConstraintPriority} />}

      <div style={s.shell}>
        <div style={s.headerRow}>
          <div>
            <div style={s.eyebrow}>SCHEDULING INTELLIGENCE</div>
            <h1 style={s.h1}>Constraints</h1>
            <p style={s.headerSub}>Define scheduling rules and constraints in plain English.<br />Our AI will interpret them and apply during timetable generation.</p>
          </div>
          <div style={s.howItWorks}>
            <div style={s.howTitle}><SparkleIcon size={16} /> How it works</div>
            <p style={s.howBody}>Describe your rules naturally. Hard rules like &quot;must&quot; or &quot;cannot&quot;, or soft preferences using &quot;try to&quot; or &quot;ideally&quot;.</p>
          </div>
        </div>

        <div style={s.grid}>
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
                <textarea style={s.textarea} value={text} onChange={e => setText(e.target.value)} placeholder="For example: No OS Lab sessions on Tuesday." disabled={!!confirmedPreview} maxLength={500} />
                <div style={s.charCount}>{text.length}/500</div>
                {suggestions.length > 0 && (
                  <>
                    <div style={s.examplesLabel}><SparkleIcon size={13} /> Quick examples</div>
                    <div style={s.examplesRow}>
                      {suggestions.map(ex => <button key={ex} className="constraint-example-btn" style={s.example} onClick={() => setText(ex)} disabled={!!confirmedPreview}>{ex}</button>)}
                    </div>
                  </>
                )}
                <button style={loading || !text.trim() || !!confirmedPreview ? { ...s.reviewBtn, ...s.reviewBtnDisabled } : s.reviewBtn} onClick={review} disabled={loading || !text.trim() || !!confirmedPreview}>
                  <SparkleIcon size={16} />
                  {loading ? "Interpreting..." : "Review constraint"}
                  {!loading && <span style={{ marginLeft: "auto" }}>&rarr;</span>}
                </button>
                {error && <div style={{ ...s.feedback, ...s.errorFb }}>{error}</div>}
                {success && <div style={{ ...s.feedback, ...s.successFb }}>{success}</div>}
                {previewWarnings.length > 0 && (
                  <div style={{ ...s.feedback, ...s.warningFb }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}><WarningIcon /></span>
                    <div>{previewWarnings.map((w, i) => <div key={i}>{w}</div>)}</div>
                  </div>
                )}
                {preview && (
                  <div style={s.preview}>
                    <div style={s.previewTop}><div style={s.previewLabel}>Step 1 &middot; Review interpretation</div><Badge type={preview.constraint_type} /></div>
                    <div style={s.explanation}>{preview.explanation}</div>
                    {preview.assumptions?.length > 0 && <div style={s.assumptions}><strong>Assumptions:</strong> {preview.assumptions.join(" \u00b7 ")}</div>}
                    {preview.constraint_type === "soft" && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #bfdbfe" }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>
                          What priority should this constraint have?
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {[
                            { priority: "High", weight: 3, desc: "Weight 3" },
                            { priority: "Medium", weight: 2, desc: "Weight 2" },
                            { priority: "Low", weight: 1, desc: "Weight 1" },
                          ].map(opt => {
                            const isSel = selectedWeight === opt.weight
                            return (
                              <button key={opt.weight} type="button" onClick={() => setSelectedWeight(opt.weight)}
                                style={{ padding: "10px 12px", borderRadius: 10, border: isSel ? "2px solid #2563eb" : "1px solid #cbd5e1", background: isSel ? "#eff6ff" : "#fff", color: isSel ? "#1e40af" : "#475569", fontWeight: isSel ? 700 : 500, cursor: "pointer", textAlign: "center", transition: "all 0.15s", boxShadow: isSel ? "0 0 0 3px rgba(37,99,235,0.12)" : "none" }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.priority}</div>
                                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{opt.desc}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ ...s.previewActions, marginTop: 14 }}>
                      <button style={s.secondaryBtn} onClick={resetReview}>No, edit</button>
                      <button style={s.confirmBtn} onClick={confirmMeaning}>Yes, that&apos;s what I mean</button>
                    </div>
                  </div>
                )}
                {confirmedPreview && (
                  <div style={s.applyBox}>
                    <div style={s.applyLabel}>STEP 2 &middot; APPLY</div>
                    <p style={s.applyTitle}>Should we apply this rule?</p>
                    <p style={s.applyNote}>The rule is confirmed but is not saved yet.</p>
                    <div style={s.applyBox2}><strong>{confirmedPreview.explanation}</strong><div style={{ marginTop: 8 }}><Badge type={confirmedPreview.constraint_type} /></div></div>
                    <div style={s.applyActions}>
                      <button style={s.secondaryBtn} onClick={resetReview}>Keep editing</button>
                      <button style={s.applyBtn} onClick={applyConstraint} disabled={saving}>{saving ? "Applying..." : "Yes \u2014 apply to timetable"}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={s.aboutBox}>
              <div style={s.aboutIcon}><InfoIcon /></div>
              <div>
                <p style={s.aboutTitle}>About constraints</p>
                <p style={s.aboutText}><strong>Hard</strong> constraints (must/cannot) are always enforced. <strong>Soft</strong> constraints (prefer/ideally) are respected as much as possible.</p>
              </div>
            </div>
          </div>

          <div style={s.overviewCard}>
            <div style={s.overviewHead}>
              <div style={s.overviewIcon}><ShieldIcon /></div>
              <div>
                <p style={s.cardTitle}>Constraint overview</p>
                <p style={{ ...s.cardSub, margin: 0 }}>Summary of all active constraints</p>
              </div>
            </div>
            <div style={s.statsRow}>
              <div style={s.statBox}><span style={s.statNum}>{rules.length}</span><span style={s.statLabel}>Active constraints</span></div>
              <div style={s.statBox}><span style={s.statNumBlue}>{hardCount}</span><span style={s.statLabel}>Hard constraints</span></div>
              <div style={s.statBox}><span style={s.statNumGreen}>{softCount}</span><span style={s.statLabel}>Soft constraints</span></div>
            </div>
            <div style={s.filterBar}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}><SearchIcon /></span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search constraints..." style={s.searchInput} />
              </div>
              {[{ key: "all", label: "All" }, { key: "hard", label: "Hard" }, { key: "soft", label: "Soft" }].map(({ key, label }) => {
                const active = typeFilter === key
                const ac = key === "hard" ? "filter-tab-hard-active" : key === "soft" ? "filter-tab-soft-active" : "filter-tab-active"
                return <button key={key} onClick={() => setTypeFilter(key)} className={active ? ac : ""} style={{ ...s.filterTab, background: active ? undefined : "#f3f4f6", color: active ? undefined : "#6b7280" }}>{label}</button>
              })}
            </div>
            <div style={s.activeHead}>
              <span>Active constraints</span>
              {filteredRules.length !== rules.length && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{filteredRules.length} of {rules.length}</span>}
            </div>
            <div style={s.rulesList}>
              {filteredRules.length === 0
                ? <div style={{ padding: "32px 22px", textAlign: "center", color: "var(--text-muted, #9ca3af)", fontSize: 13 }}>{rules.length === 0 ? <><span>No active constraints yet.</span><br /><span style={{ color: "#d1d5db" }}>Add your first rule on the left.</span></> : "No constraints match your filter."}</div>
                : filteredRules.map(rule => (
                  <div key={rule.constraint_id} style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "20px 24px",
                    marginBottom: 16,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    display: "grid",
                    gridTemplateColumns: "1fr 180px 48px",
                    gap: 20,
                    alignItems: "center",
                  }}>
                    {/* Left Column: Soft/Hard Badge + Explanation + Metadata */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <Badge type={rule.constraint_type} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14.5, fontWeight: 600, color: "#111827", lineHeight: 1.5, margin: 0 }}>
                          {rule.constraint?.explanation || rule.constraint_name || "Saved constraint"}
                        </p>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                          ID #{rule.constraint_id} &bull; Added {formatConstraintDate(rule)}
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Priority Dropdown & Details */}
                    <div style={{ borderLeft: "1px solid #f1f5f9", paddingLeft: 20, position: "relative" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                        PRIORITY
                      </div>
                      {rule.constraint_type === "soft" ? (
                        <>
                          <PriorityDropdown
                            weight={rule.constraint?.weight}
                            onChange={w => updateConstraintPriority(rule.constraint_id, w)}
                          />
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                            {(rule.constraint?.weight === 3 || !rule.constraint?.weight) ? "Highest preference" : rule.constraint?.weight === 2 ? "Moderate preference" : "Low preference"}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            Weight: {rule.constraint?.weight || 3}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" }}>
                            Absolute (Hard)
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Absolute priority</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Non-negotiable</div>
                        </>
                      )}
                    </div>

                    {/* Right Column: Red Trash Button */}
                    <div style={{ borderLeft: "1px solid #f1f5f9", paddingLeft: 16, display: "flex", justifyContent: "center" }}>
                      <button
                        onClick={() => removeConstraint(rule.constraint_id)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color: "#ef4444", cursor: "pointer", padding: 6, borderRadius: 8, transition: "background 0.15s" }}
                        title="Remove constraint"
                        onMouseEnter={e => e.currentTarget.style.background = "#fff1f0"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <TrashIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <button className="history-btn" style={s.historyBtn} onClick={() => setShowHistory(true)}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><HistoryIcon /> View all constraints &amp; history</span>
              <span>&rsaquo;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
