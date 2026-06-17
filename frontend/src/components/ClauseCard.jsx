import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Eye, Zap, Scale, MessageSquare } from 'lucide-react';
import { SeverityBadge } from './RiskComponents';

export default function ClauseCard({ clause, index }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('explanation');

  const severityBorderMap = {
    CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)', INFORMATIONAL: 'var(--info)'
  };
  const borderColor = severityBorderMap[clause.severity] || 'var(--text-muted)';

  const tabs = [
    { id: 'explanation', label: '📖 Explanation', icon: Eye },
    { id: 'impact',      label: '⚡ Impact',       icon: Zap },
    { id: 'reasoning',   label: '🧠 Reasoning',    icon: Scale },
    { id: 'negotiate',   label: '🤝 Negotiate',    icon: MessageSquare },
  ];

  const hasDeepAnalysis = !!clause.practical_impact || !!clause.reasoning_trace?.intent_analysis;
  const activeTabs = tabs.filter(t => t.id === 'explanation' || hasDeepAnalysis);

  return (
    <div style={{
      borderRadius: 0, overflow: 'hidden',
      border: `1px solid ${expanded ? 'var(--text-muted)' : 'var(--glass-border)'}`,
      background: 'var(--glass-bg)',
      transition: 'var(--transition)',
      marginBottom: 16,
      boxShadow: 'none',
    }}>
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '16px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          borderLeft: `3px solid ${borderColor}`,
        }}
      >
        {/* Priority number - Sharp Square Block */}
        <div style={{
          minWidth: 28, height: 28, borderRadius: 0, background: 'var(--bg-elevated)',
          border: `1px solid var(--glass-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0, marginTop: 2,
        }}>
          {clause.priority_rank || index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <SeverityBadge severity={clause.severity} />
            <span style={{
              padding: '2px 8px', borderRadius: 0,
              background: 'var(--bg-base)', border: '1px solid var(--glass-border)',
              fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>{clause.clause_type || clause.clause_type_hint || 'General'}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
              {clause.risk_dimension} · {clause.clause_id}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
            className="truncate">
            {clause.plain_english || clause.raw_text?.slice(0, 120) + '…'}
          </p>
        </div>

        <div style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0 20px 20px' }}>
          {/* Original text */}
          <div style={{
            margin: '16px 0', padding: '14px 18px', borderRadius: 0,
            background: 'var(--bg-base)', border: '1px solid var(--glass-border)',
          }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Original Excerpt
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              "{clause.raw_text || 'No original text available.'}"
            </p>
          </div>

          {/* Tabs */}
          {activeTabs.length > 1 && (
            <div style={{ display: 'flex', gap: 1, background: 'var(--glass-border)', border: '1px solid var(--glass-border)', borderRadius: 0, padding: 0, marginBottom: 18 }}>
              {activeTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 0, border: 'none', cursor: 'pointer',
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'var(--transition)',
                    background: tab === t.id ? 'var(--text-primary)' : 'var(--bg-base)',
                    color: tab === t.id ? '#111111' : 'var(--text-muted)',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab Content */}
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {tab === 'explanation' && (
              <div>
                <Section title="Plain English Explanation" content={clause.plain_english || "This clause is standard or low-risk. No complex legal explanation is required."} />
                {clause.low_confidence_flag && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px',
                    background: 'var(--high-bg)', border: '1px solid var(--high)', borderRadius: 0, marginTop: 12 }}>
                    <AlertTriangle size={14} color="var(--high)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--high)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Low confidence ({Math.round((clause.confidence || 0.5) * 100)}%) — verify with a legal professional</span>
                  </div>
                )}
              </div>
            )}
            {tab === 'impact' && hasDeepAnalysis && (
              <div>
                <Section title="Practical Impact" content={clause.practical_impact} />
                <Section title="Worst-Case Scenario" content={clause.worst_case_scenario} highlight />
                <Section title="Standard Comparison" content={clause.standard_comparison} />
              </div>
            )}
            {tab === 'reasoning' && hasDeepAnalysis && (
              <div>
                <Section title="Intent Analysis"     content={clause.reasoning_trace?.intent_analysis} />
                <Section title="Scope Detection"     content={clause.reasoning_trace?.scope_detection} />
                <Section title="Adversarial Simulation" content={clause.reasoning_trace?.adversarial_simulation} highlight />
                {clause.reasoning_trace?.undefined_terms?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🔍 Undefined Terms</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {clause.reasoning_trace.undefined_terms.map((t, i) => (
                        <span key={i} style={{ padding: '4px 12px', borderRadius: 9999,
                          background: 'var(--medium-bg)', border: '1px solid var(--medium)',
                          color: 'var(--medium)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === 'negotiate' && hasDeepAnalysis && (
              <div>
                <Section title="Negotiation Recommendation" content={clause.negotiation_recommendation} />
                {clause.redline_language && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>✏️ Suggested Redline Excerpt</p>
                    <div style={{ padding: '14px', background: 'var(--low-bg)',
                      border: '1px solid var(--low)', borderRadius: 0,
                      fontSize: '0.78rem', color: 'var(--low)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                      {clause.redline_language}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sub-scores */}
          {clause.sub_scores && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
              {Object.entries(clause.sub_scores).map(([key, val]) => (
                <div key={key} style={{
                  flex: '1 1 80px', padding: '10px 12px', borderRadius: 0,
                  background: 'var(--bg-base)', border: '1px solid var(--glass-border)', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: val >= 70 ? 'var(--critical)' : val >= 40 ? 'var(--medium)' : 'var(--low)', letterSpacing: '-0.02em' }}>
                    {val}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, content, highlight }) {
  if (!content) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</p>
      <p style={{
        lineHeight: 1.6, fontSize: '0.8rem',
        color: highlight ? 'var(--high)' : 'var(--text-secondary)',
        background: highlight ? 'var(--high-bg)' : 'transparent',
        padding: highlight ? '12px 14px' : 0,
        borderRadius: 0,
        borderLeft: highlight ? '3px solid var(--high)' : 'none',
        border: highlight ? '1px solid var(--high)' : 'none',
      }}>{content}</p>
    </div>
  );
}
