/* ── Light theme tokens shared by all form pages ── */

export const page = {
  padding: '28px 32px',
  minHeight: '100vh',
  background: 'var(--bg-page)',
  color: 'var(--text-main)',
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  transition: 'background 0.3s ease, color 0.3s ease',
}

export const pageTitle = {
  fontSize: '18px',
  fontWeight: '700',
  color: 'var(--text-main)',
  marginBottom: '4px',
}

export const pageSub = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginBottom: '20px',
}

export const card = {
  background: 'var(--bg-card)',
  borderRadius: '14px',
  padding: '24px',
  maxWidth: '520px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  border: '1px solid var(--border-color)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  transition: 'background 0.3s ease, border-color 0.3s ease',
}

export const heading = {
  fontSize: '15px',
  fontWeight: '700',
  color: 'var(--text-main)',
  marginBottom: '2px',
}

export const fieldWrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
}

export const label = {
  fontSize: '11px',
  fontWeight: '600',
  color: 'var(--text-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

export const input = {
  padding: '9px 12px',
  borderRadius: '7px',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-main)',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const select = {
  padding: '9px 12px',
  borderRadius: '7px',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-main)',
  fontSize: '13px',
  cursor: 'pointer',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const btn = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  background: '#2563EB',
  color: '#FFFFFF',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  width: '100%',
  letterSpacing: '0.01em',
}

export const successBox = {
  padding: '9px 12px',
  borderRadius: '7px',
  background: 'var(--badge-classroom)',
  color: '#166534',
  fontSize: '12px',
  fontWeight: '600',
  border: '1px solid var(--border-color)',
}

export const errorBox = {
  padding: '9px 12px',
  borderRadius: '7px',
  background: 'var(--badge-subject)',
  color: '#991B1B',
  fontSize: '12px',
  fontWeight: '600',
  border: '1px solid var(--border-color)',
}

export const tableWrap = {
  marginTop: '20px',
  maxWidth: '520px',
}

export const tableCount = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontWeight: '600',
}

export const table = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
  background: 'var(--bg-card)',
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid var(--border-color)',
}

export const th = {
  padding: '9px 14px',
  background: 'var(--table-th-bg)',
  color: 'var(--text-muted)',
  fontSize: '10px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border-color)',
}

export const td = {
  padding: '9px 14px',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  fontWeight: '500',
  fontSize: '12px',
}

export const toggleActive = {
  flex: 1, padding: '9px', borderRadius: '7px',
  cursor: 'pointer', fontSize: '12px', fontWeight: '600',
  border: '1.5px solid #2563EB',
  background: 'var(--badge-teacher)',
  color: '#1D4ED8',
}

export const toggleInactive = {
  flex: 1, padding: '9px', borderRadius: '7px',
  cursor: 'pointer', fontSize: '12px', fontWeight: '500',
  border: '1px solid var(--border-color)',
  background: 'var(--input-bg)',
  color: 'var(--text-muted)',
}