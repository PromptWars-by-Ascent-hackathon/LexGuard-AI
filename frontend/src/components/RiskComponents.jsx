import { SEVERITY_CONFIG } from '../services/api';

// Animated risk gauge (0-100)
export function RiskGauge({ score }) {
  const { color, label } = score >= 76 ? { color: 'var(--critical)', label: 'Critical Risk' }
    : score >= 51 ? { color: 'var(--high)', label: 'High Risk' }
    : score >= 26 ? { color: 'var(--medium)', label: 'Moderate Risk' }
    : { color: 'var(--low)', label: 'Low Risk' };

  const r = 54, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.25, 1, 0.5, 1)' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize={24} fontWeight={800} fontFamily="Syne,sans-serif">{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={10} fontFamily="Inter,sans-serif">/100</text>
      </svg>
      <p style={{ color, fontWeight: 700, fontSize: '0.72rem', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    </div>
  );
}

// Severity badge
export function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFORMATIONAL;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px',
      borderRadius: 9999, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}30`,
    }}>
      {severity}
    </span>
  );
}

// Risk breakdown radar bars (horizontal bars per dimension)
export function RiskBreakdownBars({ breakdown }) {
  const dims = [
    { key: 'financial',   label: 'Financial',    icon: '💰' },
    { key: 'privacy',     label: 'Privacy',       icon: '🔒' },
    { key: 'employment',  label: 'Employment',    icon: '💼' },
    { key: 'ip',          label: 'IP Rights',     icon: '🧠' },
    { key: 'compliance',  label: 'Compliance',    icon: '📋' },
    { key: 'legal_rights',label: 'Legal Rights',  icon: '⚖️' },
    { key: 'operational', label: 'Operational',   icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dims.map(({ key, label, icon }) => {
        const val = breakdown?.[key] || 0;
        const col = val >= 76 ? 'var(--critical)' : val >= 51 ? 'var(--high)' : val >= 26 ? 'var(--medium)' : 'var(--low)';
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{icon} {label}</span>
              <span style={{ fontSize: '0.75rem', color: col, fontWeight: 700 }}>{val}</span>
            </div>
            <div style={{ height: 4, borderRadius: 0, background: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 0,
                transition: 'width 1s cubic-bezier(0.25, 1, 0.5, 1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Clause severity count pills
export function ClauseCounts({ counts }) {
  const items = [
    { key: 'critical',      label: 'Critical',  color: 'var(--critical)', bg: 'var(--critical-bg)' },
    { key: 'high',          label: 'High',      color: 'var(--high)', bg: 'var(--high-bg)' },
    { key: 'medium',        label: 'Medium',    color: 'var(--medium)', bg: 'var(--medium-bg)' },
    { key: 'low',           label: 'Low',       color: 'var(--low)', bg: 'var(--low-bg)' },
    { key: 'informational', label: 'Info',      color: 'var(--info)', bg: 'var(--info-bg)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(({ key, label, color, bg }) => (
        <div key={key} style={{
          padding: '4px 14px', borderRadius: 9999,
          background: bg, border: `1px solid rgba(234, 230, 223, 0.08)`,
          fontSize: '0.68rem', fontWeight: 700, color,
          textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          {counts?.[key] || 0} {label}
        </div>
      ))}
    </div>
  );
}
