export default function SubjectTypeBadge({ name, type, showName = true, dark = false, color = null }) {
  const isLab = type === 'lab'

  /* In dark mode use the cell's text colour; in light mode use fixed colours */
  const badgeColor  = dark && color ? color.text   : (isLab ? '#92400E' : '#1D4ED8')
  const badgeBg     = dark && color ? `${color.bg}cc` : (isLab ? '#FEF3C7' : '#EFF6FF')
  const nameColor   = dark && color ? color.text   : '#1B2A3B'

  const badge = {
    padding:      '1px 6px',
    borderRadius: '20px',
    fontSize:     '10px',
    fontWeight:   '600',
    background:   badgeBg,
    color:        badgeColor,
    whiteSpace:   'nowrap',
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '3px',
    flexShrink:   0,
  }

  if (!showName) {
    return <span style={badge}>{isLab ? '🔬 Lab' : '📖 Theory'}</span>
  }

  // Stacked layout — name on top, badge below
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{
        fontWeight:        '700',
        fontSize:          '11px',
        color:             nameColor,
        lineHeight:        '1.2',
        wordBreak:         'break-word',
        overflow:          'hidden',
        display:           '-webkit-box',
        WebkitLineClamp:   2,
        WebkitBoxOrient:   'vertical',
      }}>
        {name}
      </span>
      <span style={badge}>{isLab ? '🔬 Lab' : '📖 Theory'}</span>
    </div>
  )
}