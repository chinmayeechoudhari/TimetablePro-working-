import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'

function TypeBadge({ type }) {
  const hard = type === 'hard'
  return <span className={`constraint-type ${hard ? 'hard' : 'soft'}`}>{type}</span>
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true,
  }
  const paths = {
    spark: <><path d="M12 3l1.8 5.7L19.5 11l-5.7 1.8L12 18.5l-1.8-5.7L4.5 11l5.7-2.3L12 3Z" /><path d="M19 3v4M21 5h-4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    x: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

export default function ConstraintsPage() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirmedPreview, setConfirmedPreview] = useState(null)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function loadRules() {
    try {
      const res = await axios.get(`${BASE}/constraints`)
      setRules(Array.isArray(res.data) ? res.data : [])
      setError(null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not load active constraints')
    }
  }

  useEffect(() => { loadRules() }, [])

  async function review() {
    const value = text.trim()
    if (!value) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    setPreview(null)
    setConfirmedPreview(null)

    try {
      const res = await axios.post(`${BASE}/constraints/preview`, { text: value })
      setPreview(res.data?.constraint || null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not interpret this constraint')
    } finally {
      setLoading(false)
    }
  }

  function confirmMeaning() {
    if (!preview) return
    setConfirmedPreview(preview)
    setPreview(null)
    setError(null)
    setSuccess(null)
  }

  function editMeaning() {
    setPreview(null)
    setConfirmedPreview(null)
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
    if (!window.confirm('Remove this constraint? It will no longer affect future timetable generation.')) return
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

  return (
    <div className="constraints-page">
      <style>{`
        .constraints-page{min-height:100%;box-sizing:border-box;padding:28px 32px 60px;color:#13203a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 8% 0%,rgba(96,165,250,.13),transparent 30%),radial-gradient(circle at 92% 8%,rgba(167,139,250,.11),transparent 28%),var(--bg-page,#f0f4f8)}
        .constraints-shell{max-width:1240px;margin:0 auto}.constraints-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:24px;padding:28px 30px;border:1px solid #dfe7f4;border-radius:22px;background:linear-gradient(135deg,#fff 0%,#f8faff 62%,#f3f0ff 100%);box-shadow:0 12px 36px rgba(28,52,96,.07)}
        .constraints-eyebrow{color:#3564bb;font-size:10px;font-weight:850;letter-spacing:.17em;margin-bottom:7px}.constraints-hero h1{margin:0;color:#101b35;font-size:30px;letter-spacing:-.035em;line-height:1.1}.constraints-hero p{margin:8px 0 0;max-width:670px;color:#71809d;font-size:13px;line-height:1.6}.hero-mark{width:74px;height:74px;flex:0 0 74px;display:grid;place-items:center;color:#2563eb;border:1px solid #cbdcff;border-radius:20px;background:#edf3ff;box-shadow:0 12px 25px rgba(37,99,235,.12)}
        .constraints-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(350px,.88fr);gap:18px;margin-top:18px;align-items:start}.card{background:rgba(255,255,255,.94);border:1px solid #dfe6f1;border-radius:18px;box-shadow:0 10px 30px rgba(28,48,90,.06)}.card-head{padding:20px 22px;border-bottom:1px solid #e7ecf3}.card-title{color:#15213d;font-size:16px;font-weight:800}.card-subtitle{margin-top:4px;color:#71809d;font-size:11.5px;line-height:1.5}.composer{padding:20px 22px 22px}
        .constraint-textarea{width:100%;box-sizing:border-box;min-height:142px;resize:vertical;padding:14px;border:1px solid #cbd5e1;border-radius:12px;outline:none;color:#1e293b;background:#fbfdff;font:inherit;font-size:13px;line-height:1.55;transition:border-color .15s,box-shadow .15s}.constraint-textarea:focus{border-color:#5b8def;box-shadow:0 0 0 3px rgba(37,99,235,.09)}.examples{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.example{border:1px solid #dbe4f2;background:#f7faff;color:#496386;border-radius:999px;padding:6px 10px;font-size:10.5px;cursor:pointer}.review-button{width:100%;margin-top:13px;min-height:48px;border:none;border-radius:12px;background:linear-gradient(135deg,#3b74f5,#2452e0 60%,#6d3fe0);color:white;font-weight:800;cursor:pointer;box-shadow:0 12px 25px rgba(37,99,235,.22)}.review-button:disabled{background:#c5d3eb;box-shadow:none;cursor:not-allowed}
        .feedback{margin-top:13px;padding:11px 13px;border-radius:10px;font-size:11.5px;line-height:1.5}.feedback.error{color:#991b1b;background:#fef2f2;border:1px solid #fecaca}.feedback.success{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0}
        .preview{margin-top:18px;padding:17px;border:1px solid #bfdbfe;border-radius:14px;background:#f8fbff}.preview-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.preview-title{color:#1e3a8a;font-size:13px;font-weight:850}.constraint-type{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:9.5px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.constraint-type.hard{background:#eff6ff;color:#1d4ed8}.constraint-type.soft{background:#fff7ed;color:#c2410c}.explanation{margin-top:12px;padding:13px;border:1px solid #e2e8f0;border-radius:10px;background:white;color:#334155;font-size:12.5px;line-height:1.55}.assumptions{margin-top:9px;color:#92400e;font-size:10.5px;line-height:1.5}.preview-question{margin-top:13px;color:#475569;font-size:11.5px;font-weight:650}.preview-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin-top:10px}.secondary,.primary{min-height:40px;border-radius:9px;font-size:11.5px;font-weight:750;cursor:pointer}.secondary{border:1px solid #cbd5e1;background:white;color:#475569}.primary{border:none;background:#16a34a;color:white}.primary:disabled{opacity:.65;cursor:wait}
        .apply-step{margin-top:18px;padding:18px;border:1px solid #bbf7d0;border-radius:14px;background:linear-gradient(135deg,#f0fdf4,#f8fff9)}.apply-step .step-label{color:#15803d;font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.apply-step h3{margin:5px 0 0;color:#14532d;font-size:16px}.apply-step p{margin:7px 0 0;color:#4b6b57;font-size:11.5px;line-height:1.5}.apply-summary{margin-top:12px;padding:12px;border:1px solid #d1fae5;border-radius:10px;background:#fff;color:#334155;font-size:12px;line-height:1.5}.apply-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin-top:11px}.apply-button{min-height:42px;border:0;border-radius:9px;background:#16a34a;color:white;font-size:11.5px;font-weight:800;cursor:pointer}.apply-button:disabled{opacity:.65;cursor:wait}
        .summary{padding:20px 20px 12px}.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.stat{padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}.stat-number{font-size:19px;font-weight:850;color:#1b2a3b}.stat-label{margin-top:2px;color:#64748b;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em}.rules-head{padding:9px 20px 10px;color:#475569;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.rules{padding:0 20px 20px}.rule{padding:12px;margin-bottom:8px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.rule-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.remove{display:inline-flex;align-items:center;gap:5px;border:none;background:transparent;color:#94a3b8;font-size:10.5px;cursor:pointer}.remove:hover{color:#dc2626}.rule-text{margin-top:8px;color:#334155;font-size:11.5px;line-height:1.5}.empty{padding:24px 8px;text-align:center;color:#94a3b8;font-size:11.5px}.info-strip{margin-top:18px;padding:13px 15px;border:1px solid #dbe4f2;border-radius:12px;background:rgba(247,250,255,.88);color:#5b6f91;font-size:11px;line-height:1.5}
        @media(max-width:850px){.constraints-grid{grid-template-columns:1fr}}@media(max-width:600px){.constraints-page{padding:18px 14px 40px}.constraints-hero{padding:22px}.hero-mark{display:none}.preview-actions,.apply-actions{grid-template-columns:1fr}}
      `}</style>

      <div className="constraints-shell">
        <section className="constraints-hero">
          <div>
            <div className="constraints-eyebrow">SCHEDULING INTELLIGENCE</div>
            <h1>Welcome New Constraints</h1>
            <p>Tell the scheduler what should change in plain English. We will interpret and validate your rule first, show you exactly what it means, and only then add it to the active timetable rules.</p>
          </div>
          <div className="hero-mark"><Icon name="spark" size={32} /></div>
        </section>

        <div className="constraints-grid">
          <section className="card">
            <div className="card-head">
              <div className="card-title">Describe a new rule</div>
              <div className="card-subtitle">Nothing is saved until you review the interpretation and explicitly apply it.</div>
            </div>
            <div className="composer">
              <textarea className="constraint-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="For example: Rahul can teach at most 3 periods on Monday." disabled={!!confirmedPreview} />
              <div className="examples">
                {['Rahul cannot teach Monday period 3.','DBMS cannot occur on Friday.','Rahul should not have consecutive periods.'].map(example => (
                  <button key={example} className="example" onClick={() => setText(example)} disabled={!!confirmedPreview}>{example}</button>
                ))}
              </div>
              <button className="review-button" onClick={review} disabled={loading || !text.trim() || !!confirmedPreview}>{loading ? 'Interpreting and validating…' : 'Review this constraint →'}</button>

              {error && <div className="feedback error">{error}</div>}
              {success && <div className="feedback success">{success}</div>}

              {preview && (
                <div className="preview">
                  <div className="preview-top"><div className="preview-title">Step 1 · Is this what you mean?</div><TypeBadge type={preview.constraint_type} /></div>
                  <div className="explanation">{preview.explanation}</div>
                  {preview.assumptions?.length > 0 && <div className="assumptions"><strong>Assumptions:</strong> {preview.assumptions.join(' · ')}</div>}
                  <div className="preview-question">Confirm the interpretation first. Nothing has been saved yet.</div>
                  <div className="preview-actions">
                    <button className="secondary" onClick={editMeaning}><Icon name="x" size={13} /> No, let me edit</button>
                    <button className="primary" onClick={confirmMeaning}><Icon name="check" size={13} /> Yes, that's what I mean</button>
                  </div>
                </div>
              )}

              {confirmedPreview && (
                <div className="apply-step">
                  <div className="step-label">Step 2 · Apply to timetable</div>
                  <h3>Should we apply this rule?</h3>
                  <p>The rule has been confirmed, but it is still not saved. Choose whether to add it to the active constraint library.</p>
                  <div className="apply-summary"><strong>{confirmedPreview.explanation}</strong><br /><TypeBadge type={confirmedPreview.constraint_type} /></div>
                  <div className="apply-actions">
                    <button className="secondary" onClick={() => { setConfirmedPreview(null); setError(null) }}>No, keep editing</button>
                    <button className="apply-button" onClick={applyConstraint} disabled={saving}>{saving ? 'Applying…' : 'Yes — apply to timetable'}</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="summary">
              <div className="card-title">Active rule library</div>
              <div className="card-subtitle">Every rule shown here is applied automatically when you generate a timetable.</div>
              <div className="stat-row">
                <div className="stat"><div className="stat-number">{rules.length}</div><div className="stat-label">Active</div></div>
                <div className="stat"><div className="stat-number">{hardCount}</div><div className="stat-label">Hard</div></div>
                <div className="stat"><div className="stat-number">{softCount}</div><div className="stat-label">Soft</div></div>
              </div>
            </div>
            <div className="rules-head">Current constraints</div>
            <div className="rules">
              {rules.length === 0 ? <div className="empty">No active constraints yet.<br />Add your first rule on the left.</div> : rules.map(rule => (
                <div className="rule" key={rule.constraint_id}>
                  <div className="rule-top"><TypeBadge type={rule.constraint_type} /><button className="remove" onClick={() => removeConstraint(rule.constraint_id)}><Icon name="trash" size={13} /> Remove</button></div>
                  <div className="rule-text">{rule.constraint?.explanation || rule.constraint_name || 'Saved constraint'}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="info-strip"><strong>How it works:</strong> natural language → Gemini interpretation → entity/schema validation → your confirmation → apply confirmation → saved rule → CP-SAT generation. Removing a rule takes it out of future generation runs; it does not rewrite an already-generated timetable.</div>
      </div>
    </div>
  )
}
