import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const BASE = 'http://localhost:8000'

function Icon({ name, size = 20, stroke = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    bolt: (
      <>
        <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" />
      </>
    ),
    listChecks: (
      <>
        <path d="m3.5 6 1.6 1.6L8.5 4" />
        <path d="M12 6h8.5" />
        <path d="m3.5 13 1.6 1.6L8.5 11" />
        <path d="M12 13h8.5" />
        <path d="m3.5 20 1.6 1.6 3.4-3.6" />
        <path d="M12 20h8.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    checkCircle: (
      <>
        <circle cx="12" cy="12" r="9.2" />
        <path d="m8 12.3 2.6 2.6L16.2 9" />
      </>
    ),
    alertTriangle: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      </>
    ),
    xCircle: (
      <>
        <circle cx="12" cy="12" r="9.2" />
        <path d="m9 9 6 6" />
        <path d="m15 9-6 6" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
        <path d="M21 4v4h-4" />
        <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
        <path d="M3 20v-4h4" />
      </>
    ),
    grid: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M4 12h16" />
        <path d="m13 5 7 7-7 7" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function GenerateTimetable() {
  const [taskId, setTaskId]             = useState(null)
  const [status, setStatus]             = useState(null)
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsed, setElapsed]           = useState(0)
  const [validation, setValidation]     = useState(null)   // preflight result
  const [validating, setValidating]     = useState(false)  // loading state
  const [diagnosis, setDiagnosis]       = useState(null)   // post-failure diagnosis
  const intervalRef                     = useRef(null)
  const timerRef                        = useRef(null)
  const navigate                        = useNavigate()

  // Run preflight check on mount and after each generation attempt
  async function runValidation() {
    setValidating(true)
    try {
      const res = await axios.get(`${BASE}/validate`)
      setValidation(res.data)
    } catch {
      setValidation(null)
    } finally {
      setValidating(false)
    }
  }

  useEffect(() => {
    runValidation()
    const handleUpdate = () => runValidation()
    window.addEventListener('availabilityUpdated', handleUpdate)
    return () => window.removeEventListener('availabilityUpdated', handleUpdate)
  }, [])

  async function startGenerate() {
    setError(null); setResult(null); setStatus(null)
    setElapsed(0); setDiagnosis(null)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timerRef.current)    { clearInterval(timerRef.current);    timerRef.current = null }
    setIsGenerating(true)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    try {
      const res = await axios.post(`${BASE}/generate`)
      if (res.data?.status === 'error') {
        setError(res.data?.message || 'Failed to start generation')
        setIsGenerating(false)
        clearInterval(timerRef.current)
        return
      }
      setTaskId(res.data?.task_id || null)
      setStatus(res.data?.status || 'running')
      // Immediately trigger first poll
      if (res.data?.task_id) {
        pollStatus(res.data.task_id)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to start generation')
      setIsGenerating(false)
      clearInterval(timerRef.current)
    }
  }

  async function pollStatus(id) {
    try {
      const res = await axios.get(`${BASE}/generate/status/${id}`)
      const s = res.data?.status
      setStatus(s)
      if (s === 'done' || s === 'error') {
        const r = res.data?.result ?? null
        setResult(r)
        if (s === 'error' || r?.status === 'error') {
          setError(res.data?.message || r?.message || 'Generation error')
        }
        if (r?.status === 'no_solution' && r?.diagnosis) {
          setDiagnosis(r.diagnosis)
        }
        clearInterval(intervalRef.current); intervalRef.current = null
        clearInterval(timerRef.current);    timerRef.current = null
        setIsGenerating(false)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch status')
      clearInterval(intervalRef.current); intervalRef.current = null
      clearInterval(timerRef.current);    timerRef.current = null
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (!taskId) return
    intervalRef.current = setInterval(() => pollStatus(taskId), 3000)
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(timerRef.current)
    }
  }, [taskId])

  const showRunning  = isGenerating && status !== 'done'
  const solverFailed = status === 'done' && result?.status === 'no_solution'
  const solverOk     = status === 'done' && result?.status === 'success'

  // Generate button is disabled while generating OR if validation has issues
  const canGenerate  = !isGenerating && (validation?.ready !== false)

  const checklistRows = validation
    ? [
        ...validation.issues.map(msg => ({ msg, kind: 'issue' })),
        ...validation.warnings.map(msg => ({ msg, kind: 'warning' })),
        ...validation.passed.map(msg => ({ msg, kind: 'passed' })),
      ]
    : []

  return (
    <div className="generate-page">

      {/* ambient background tint */}
      <div className="ambient-bg" aria-hidden="true">
        <span className="ambient-blob ambient-blob-a" />
        <span className="ambient-blob ambient-blob-b" />
        <span className="ambient-blob ambient-blob-c" />
      </div>

      <div className="generate-content">

        {/* =========================================================
            HERO
        ========================================================= */}

        <section className="generate-hero">

          <div className="generate-watermark" aria-hidden="true">
            <svg viewBox="0 0 620 220" fill="none">
              <circle cx="120" cy="70" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="235" cy="135" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="350" cy="55" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="465" cy="140" r="9" stroke="currentColor" strokeWidth="2" />
              <circle cx="560" cy="75" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M128 74 227 131" stroke="currentColor" strokeWidth="2" />
              <path d="M243 130 342 60" stroke="currentColor" strokeWidth="2" />
              <path d="M358 60 457 135" stroke="currentColor" strokeWidth="2" />
              <path d="M473 136 552 79" stroke="currentColor" strokeWidth="2" />
              <path d="M126 66 344 52" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="hero-left">

            <div className="hero-icon">
              <Icon name="bolt" size={32} stroke={1.7} />
            </div>

            <div>
              <div className="eyebrow">ACADEMIC SCHEDULING</div>

              <h1>Generate Timetable</h1>

              <div className="hero-subtitle">CP-SAT Solver</div>

              <p>Run the constraint solver to generate a conflict-free timetable for every class.</p>
            </div>

          </div>

        </section>


        {/* =========================================================
            SOLVER OVERVIEW CHIPS
        ========================================================= */}

        <section className="solver-chip-row">
          <div className="solver-chip">
            <Icon name="settings" size={16} />
            <span>Algorithm</span>
            <strong>CP-SAT (OR-Tools)</strong>
          </div>
          <div className="solver-chip">
            <Icon name="grid" size={16} />
            <span>Constraints</span>
            <strong>S1 max · S2 no-consec · S3 spread</strong>
          </div>
          <div className="solver-chip">
            <Icon name="refresh" size={16} />
            <span>Timeout</span>
            <strong>60s max</strong>
          </div>
          <div className="solver-chip">
            <Icon name="checkCircle" size={16} />
            <span>Output</span>
            <strong>Saved automatically</strong>
          </div>
        </section>


        {/* =========================================================
            CHECKLIST
        ========================================================= */}

        <section className="directory-card checklist-card">

          <div className="directory-header">
            <div className="directory-title-block">
              <div className="directory-eyebrow">BEFORE YOU GENERATE</div>

              <div className="directory-title-row">
                <div className="directory-main-icon">
                  <Icon name="listChecks" size={22} />
                </div>

                <div>
                  <h2>Pre-Generation Checklist</h2>
                  <p>Resolve any blocking issues below, then run the solver.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={runValidation}
              disabled={validating}
            >
              <Icon name="refresh" size={14} />
              {validating ? 'Checking…' : 'Refresh'}
            </button>
          </div>

          {validating && !validation && (
            <div className="checklist-loading">
              <span className="checklist-loading-spinner" />
              Running checks...
            </div>
          )}

          {validation && (
            <>
              <div className={`checklist-summary ${validation.ready ? 'summary-ready' : 'summary-blocked'}`}>
                <Icon name={validation.ready ? 'checkCircle' : 'xCircle'} size={20} />
                <span>{validation.summary}</span>
              </div>

              <div className="checklist-rows">
                {checklistRows.map((row, i) => (
                  <div
                    key={i}
                    className={`checklist-row row-${row.kind}`}
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <Icon
                      name={row.kind === 'issue' ? 'xCircle' : row.kind === 'warning' ? 'alertTriangle' : 'check'}
                      size={16}
                    />
                    <span>{row.msg}</span>
                  </div>
                ))}
              </div>
            </>
          )}

        </section>


        {/* =========================================================
            GENERATE ACTION
        ========================================================= */}

        <section className="action-card">

          <button
            type="button"
            className={`generate-button ${showRunning ? 'is-running' : ''} ${!canGenerate && !showRunning ? 'is-disabled' : ''}`}
            onClick={startGenerate}
            disabled={!canGenerate}
            title={validation?.ready === false ? validation.summary : ''}
          >
            <span className="generate-button-glow" />

            {showRunning ? (
              <>
                <span className="button-spinner" />
                Generating… {elapsed}s
              </>
            ) : (
              <>
                <Icon name="bolt" size={26} stroke={2} />
                Generate Timetable
              </>
            )}
          </button>

          {showRunning && (
            <div className="progress-track">
              <span className="progress-fill" />
            </div>
          )}

          {validation?.ready === false && !isGenerating && (
            <div className="blocked-hint">
              <Icon name="alertTriangle" size={13} />
              Fix the issues in the checklist above before generating
            </div>
          )}

          {showRunning && (
            <div className="running-note">
              <span className="running-dot" />
              Solving constraints — checking every 3 seconds
            </div>
          )}

          {solverOk && (
            <div className="result-panel result-success">
              <div className="result-icon">
                <Icon name="checkCircle" size={26} />
              </div>
              <div className="result-text">
                <strong>Timetable generated successfully</strong>
                <span>
                  {result?.entries_saved
                    ? `${result.entries_saved} slots assigned`
                    : 'Solver completed'} in {elapsed}s
                </span>
              </div>
            </div>
          )}

          {solverOk && (
            <button
              type="button"
              className="view-timetable-button"
              onClick={() => navigate('/timetable')}
            >
              <Icon name="grid" size={17} />
              View Timetable
              <Icon name="arrowRight" size={16} />
            </button>
          )}

          {solverFailed && (
            <div className="result-panel result-failed">
              <div className="result-icon result-icon-red">
                <Icon name="xCircle" size={26} />
              </div>
              <div className="result-text">
                <strong>No solution found</strong>
                {diagnosis ? (
                  <span>{diagnosis.summary}</span>
                ) : (
                  <span>Constraints may be too tight. Use the checklist above to diagnose.</span>
                )}
              </div>
            </div>
          )}

          {solverFailed && diagnosis && (
            <div className="diagnosis-rows">
              {diagnosis.issues.map((msg, i) => (
                <div key={`i-${i}`} className="checklist-row row-issue" style={{ animationDelay: `${i * 45}ms` }}>
                  <Icon name="xCircle" size={15} />
                  <span>{msg}</span>
                </div>
              ))}
              {diagnosis.warnings.map((msg, i) => (
                <div key={`w-${i}`} className="checklist-row row-warning" style={{ animationDelay: `${(diagnosis.issues.length + i) * 45}ms` }}>
                  <Icon name="alertTriangle" size={15} />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="result-panel result-failed">
              <div className="result-icon result-icon-red">
                <Icon name="xCircle" size={26} />
              </div>
              <div className="result-text">
                <strong>Generation failed</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

        </section>

      </div>

      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .generate-page {
          position: relative;
          width: 100%;
          min-height: 100%;
          box-sizing: border-box;
          padding: 8px 4px 60px;
          color: #13203a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow: hidden;
        }

        /* =========================
           AMBIENT BACKGROUND TINT
        ========================= */

        .ambient-bg {
          position: absolute;
          inset: -10% -10% -10% -10%;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .ambient-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.28;
        }

        .ambient-blob-a {
          top: -80px;
          left: -60px;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, #93c5fd, transparent 70%);
          animation: driftA 16s ease-in-out infinite;
        }

        .ambient-blob-b {
          top: 120px;
          right: -100px;
          width: 460px;
          height: 460px;
          background: radial-gradient(circle, #c4b5fd, transparent 70%);
          animation: driftB 20s ease-in-out infinite;
        }

        .ambient-blob-c {
          bottom: -140px;
          left: 30%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #a7c4ff, transparent 70%);
          animation: driftC 24s ease-in-out infinite;
        }

        @keyframes driftA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.08); }
        }

        @keyframes driftB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(1.05); }
        }

        @keyframes driftC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -30px) scale(1.1); }
        }

        .generate-content {
          position: relative;
          z-index: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* =========================
           HERO
        ========================= */

        .generate-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          min-height: 150px;
          padding: 26px 30px;
          border: 1px solid #dfe7f4;
          border-radius: 24px;
          background: linear-gradient(135deg, #ffffff 0%, #f8faff 58%, #f2f5ff 100%);
          box-shadow: 0 12px 36px rgba(28, 52, 96, 0.06);
        }

        .hero-left {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border: 1px solid #cbdcff;
          border-radius: 18px;
          background: linear-gradient(145deg, #eff5ff, #e0eaff);
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
          animation: iconFloat 3.2s ease-in-out infinite;
        }

        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #3564bb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .generate-hero h1 {
          margin: 0;
          color: #101b35;
          font-size: 30px;
          line-height: 1.08;
          letter-spacing: -0.035em;
          font-weight: 800;
        }

        .hero-subtitle {
          margin-top: 6px;
          color: #4a5d84;
          font-size: 15px;
          line-height: 1.3;
          font-weight: 650;
        }

        .generate-hero p {
          margin: 6px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 460px;
        }

        .generate-watermark {
          position: absolute;
          z-index: 1;
          right: 55px;
          bottom: -10px;
          width: min(42%, 560px);
          color: #8fa8e7;
          opacity: 0.11;
          pointer-events: none;
        }

        .generate-watermark svg {
          display: block;
          width: 100%;
          height: auto;
        }

        /* =========================
           SOLVER CHIP ROW
        ========================= */

        .solver-chip-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .solver-chip {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 13px;
          border: 1px solid #e2e8f0;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(4px);
          box-shadow: 0 6px 18px rgba(30, 48, 87, 0.04);
          color: #2563eb;
        }

        .solver-chip span {
          color: #94a3b8;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .solver-chip strong {
          color: #1f2c48;
          font-size: 11.5px;
          font-weight: 750;
          line-height: 1.3;
        }

        /* =========================
           DIRECTORY / CHECKLIST CARD
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(6px);
          box-shadow: 0 10px 30px rgba(28, 48, 90, 0.06);
        }

        .directory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px;
          flex-wrap: wrap;
          border-bottom: 1px solid #e7ecf3;
        }

        .directory-eyebrow {
          margin-bottom: 7px;
          color: #7483a0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .directory-title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .directory-main-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 14px;
          background: #edf3ff;
        }

        .directory-title-row h2 {
          margin: 0;
          color: #15213d;
          font-size: 18px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .directory-title-row p {
          margin: 3px 0 0;
          color: #71809d;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .refresh-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          border-radius: 9px;
          border: 1px solid #c9d9ff;
          background: #f4f7ff;
          color: #245dd6;
          font-size: 11.5px;
          font-weight: 750;
          cursor: pointer;
        }

        .refresh-button:hover:not(:disabled) {
          background: #eaf1ff;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .checklist-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 24px;
          color: #94a3b8;
          font-size: 12.5px;
        }

        .checklist-loading-spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .checklist-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 24px 14px;
          padding: 13px 16px;
          border-radius: 13px;
          font-size: 13px;
          font-weight: 750;
        }

        .summary-ready {
          color: #147447;
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .summary-blocked {
          color: #b42318;
          border: 1px solid #f1c5c1;
          background: #fff5f4;
        }

        .checklist-rows {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 24px 22px;
        }

        .checklist-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 14px;
          border-radius: 11px;
          font-size: 12.5px;
          line-height: 1.5;
          animation: rowIn 0.35s ease both;
        }

        @keyframes rowIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .row-issue {
          color: #991b1b;
          background: #fef2f2;
        }

        .row-warning {
          color: #92400e;
          background: #fffbeb;
        }

        .row-passed {
          color: #166534;
          background: #f0fdf4;
        }

        /* =========================
           ACTION CARD
        ========================= */

        .action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 34px 26px;
          border-radius: 24px;
          border: 1px solid #dfe6f1;
          background: linear-gradient(160deg, rgba(255,255,255,0.95), rgba(244,248,255,0.95));
          backdrop-filter: blur(6px);
          box-shadow: 0 20px 50px rgba(28, 48, 90, 0.09);
        }

        .generate-button {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          max-width: 460px;
          min-height: 76px;
          border: none;
          border-radius: 20px;
          background: linear-gradient(135deg, #3b74f5, #2452e0 60%, #6d3fe0);
          background-size: 200% 200%;
          color: white;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 18px 40px rgba(37, 99, 235, 0.32);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: buttonGradient 6s ease infinite, buttonGlowPulse 2.6s ease-in-out infinite;
        }

        @keyframes buttonGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes buttonGlowPulse {
          0%, 100% { box-shadow: 0 18px 40px rgba(37, 99, 235, 0.32); }
          50% { box-shadow: 0 22px 54px rgba(109, 63, 224, 0.4); }
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
        }

        .generate-button:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        .generate-button.is-disabled,
        .generate-button:disabled {
          animation: none;
          cursor: not-allowed;
          background: #c8d5ee;
          box-shadow: none;
          color: #f1f5fb;
        }

        .generate-button.is-running {
          animation: none;
          background: linear-gradient(135deg, #2452e0, #2563eb);
        }

        .generate-button-glow {
          position: absolute;
          top: -50%;
          left: -30%;
          width: 60%;
          height: 200%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-18deg);
          animation: sheen 3.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes sheen {
          0% { left: -40%; }
          55%, 100% { left: 130%; }
        }

        .button-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .progress-track {
          width: 100%;
          max-width: 460px;
          height: 6px;
          border-radius: 999px;
          background: #e4eaf7;
          overflow: hidden;
        }

        .progress-fill {
          display: block;
          height: 100%;
          width: 40%;
          border-radius: 999px;
          background: linear-gradient(90deg, #3b74f5, #6d3fe0);
          animation: indeterminate 1.3s ease-in-out infinite;
        }

        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }

        .blocked-hint {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #b42318;
          font-size: 11.5px;
          font-weight: 650;
          text-align: center;
        }

        .running-note {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #2563eb;
          font-size: 12px;
          font-weight: 650;
        }

        .running-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2563eb;
          animation: dotPulse 1s ease-in-out infinite;
        }

        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.7); opacity: 0.4; }
        }

        .result-panel {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          max-width: 460px;
          padding: 16px 18px;
          border-radius: 16px;
          animation: resultIn 0.4s ease both;
        }

        @keyframes resultIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .result-success {
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .result-failed {
          border: 1px solid #f1c5c1;
          background: #fff5f4;
          animation: resultIn 0.4s ease both, shake 0.45s ease 0.4s;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .result-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          color: #16a34a;
          background: #dcfce7;
          animation: popIn 0.4s ease;
        }

        .result-icon-red {
          color: #dc2626;
          background: #fee2e2;
        }

        @keyframes popIn {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); }
        }

        .result-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .result-text strong {
          font-size: 13.5px;
          font-weight: 800;
          color: #14532d;
        }

        .result-failed .result-text strong {
          color: #7f1d1d;
        }

        .result-text span {
          font-size: 12px;
          color: #15803d;
          line-height: 1.4;
        }

        .result-failed .result-text span {
          color: #b91c1c;
        }

        .diagnosis-rows {
          display: flex;
          flex-direction: column;
          gap: 7px;
          width: 100%;
          max-width: 460px;
        }

        .view-timetable-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          max-width: 460px;
          min-height: 50px;
          border: 1.5px solid #93c5fd;
          border-radius: 14px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
          animation: resultIn 0.4s ease 0.1s both;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .view-timetable-button:hover {
          background: #dbeafe;
          transform: translateY(-1px);
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 800px) {
          .solver-chip-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .generate-hero {
            padding: 22px;
          }

          .generate-hero h1 {
            font-size: 26px;
          }

          .generate-watermark {
            display: none;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .generate-button {
            font-size: 16px;
            min-height: 68px;
          }
        }

      `}</style>

    </div>
  )
}