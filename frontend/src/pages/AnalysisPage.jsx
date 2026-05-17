import { useState } from 'react';
import { RiskGauge, RiskBreakdownBars, ClauseCounts } from '../components/RiskComponents';
import ClauseCard from '../components/ClauseCard';
import { DISCLAIMER } from '../services/api';
import { Download, Mail, AlertOctagon, Shield, FileText, Lightbulb, BarChart2 } from 'lucide-react';

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart2 },
  { id: 'clauses',      label: 'Clauses',      icon: FileText },
  { id: 'negotiate',    label: 'Negotiate',    icon: Lightbulb },
  { id: 'raw',          label: 'Raw JSON',     icon: Shield },
];

export default function AnalysisPage({ result, onBack }) {
  const [tab, setTab] = useState('overview');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  if (!result) return null;

  const filteredClauses = severityFilter === 'ALL'
    ? result.clauses
    : result.clauses?.filter(c => c.severity === severityFilter);

  const neg = result.negotiation_strategy || {};

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <button onClick={onBack} className="back-btn">
            ← Back to Upload
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>Analysis Complete</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 14px', borderRadius: 9999, background: 'rgba(234, 230, 223, 0.04)',
              border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {result.document_type}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📄 {result.filename}</span>
            {result.low_document_confidence && (
              <span style={{ padding: '4px 14px', borderRadius: 9999, background: 'var(--high-bg)',
                border: '1px solid var(--high)', color: 'var(--high)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚠ Low type confidence — please verify document category
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ gap: 6 }}
            onClick={() => { const b = new Blob([JSON.stringify(result, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='lexguard-analysis.json'; a.click(); }}>
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: 28, display: 'inline-flex' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Risk Score Card */}
          <div className="glass-card" style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Overall Risk Score
            </p>
            <RiskGauge score={result.overall_risk_score || 0} />
            <div style={{ marginTop: 16 }}>
              <ClauseCounts counts={result.clause_counts} />
            </div>
          </div>

          {/* Risk Breakdown */}
          <div className="glass-card" style={{ padding: 28 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Risk by Dimension
            </p>
            <RiskBreakdownBars breakdown={result.risk_breakdown} />
          </div>

          {/* Top Issues */}
          <div className="glass-card" style={{ padding: 28 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              ⚡ Top Priority
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              {result.top_priority_negotiation_item || 'Review the highest-severity clauses first.'}
            </p>
            {result.walk_away_triggers?.length > 0 && (
              <div>
                <p style={{ fontSize: '0.7rem', color: '#ff3b5c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                  🚨 Walk-Away Triggers
                </p>
                {result.walk_away_triggers.slice(0,3).map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                    <AlertOctagon size={12} color="#ff3b5c" style={{ flexShrink: 0, marginTop: 3 }} />
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,59,92,0.8)', lineHeight: 1.5 }}>{t}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contradictions */}
          {result.contradictions_detected?.length > 0 && (
            <div className="glass-card" style={{ padding: 28 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                ⚠️ Contradictions Detected
              </p>
              {result.contradictions_detected.map((c, i) => (
                <p key={i} style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: 4 }}>• {c}</p>
              ))}
            </div>
          )}

          {/* Processing Metadata */}
          <div className="glass-card" style={{ padding: 28 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Processing Metadata
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Pipeline ID',  result.processing_metadata?.pipeline_run_id?.slice(0,8) + '…'],
                ['Duration',     `${result.processing_metadata?.analysis_duration_seconds}s`],
                ['GCP Project',  result.processing_metadata?.gcp_project_id],
                ['Total Clauses',result.clause_counts?.total],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CLAUSES TAB ── */}
      {tab === 'clauses' && (
        <div>
          {/* Severity Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['ALL','CRITICAL','HIGH','MEDIUM','LOW','INFORMATIONAL'].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-subtle)',
                  background: severityFilter === s ? 'var(--bg-elevated)' : 'transparent',
                  color: severityFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                }}>
                {s} {s !== 'ALL' && `(${result.clause_counts?.[s.toLowerCase()] || 0})`}
              </button>
            ))}
          </div>
          {filteredClauses?.length === 0
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No clauses match this filter.</p>
            : filteredClauses?.map((clause, i) => <ClauseCard key={clause.clause_id} clause={clause} index={i} />)
          }
        </div>
      )}

      {/* ── NEGOTIATE TAB ── */}
      {tab === 'negotiate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Power Dynamics */}
          {result.power_dynamics && (
            <div className="glass-card" style={{ padding: 24 }}>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>⚖️ Negotiating Position</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{result.power_dynamics}</p>
            </div>
          )}

          {/* Strategy Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { key: 'reject_outright',        label: '🚫 Reject Outright',          color: '#ff3b5c' },
              { key: 'redline_and_counter',    label: '✏️ Redline & Counter',        color: '#f59e0b' },
              { key: 'accept_with_clarification',label:'💬 Accept with Clarification',color: '#00d4ff' },
              { key: 'accept_as_is',           label: '✅ Accept As-Is',             color: '#10b981' },
            ].map(({ key, label, color }) => (
              <div key={key} className="glass-card" style={{ padding: 20, borderTop: `2px solid ${color}60` }}>
                <p style={{ fontWeight: 700, color, fontSize: '0.8rem', marginBottom: 12 }}>{label}</p>
                {neg[key]?.length > 0
                  ? neg[key].map((id, i) => <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>• {id}</p>)
                  : <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None identified</p>
                }
              </div>
            ))}
          </div>

          {/* Redline Suggestions */}
          {result.redline_suggestions?.length > 0 && (
            <div className="glass-card" style={{ padding: 24, borderRadius: 0 }}>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.9rem' }}>✏️ Redline Suggestions</p>
              {result.redline_suggestions.map((r, i) => (
                <div key={i} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: i < result.redline_suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.clause_id}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 0, border: '1px solid var(--glass-border)', borderLeft: '3px solid var(--critical)' }}>
                      <p style={{ fontSize: '0.62rem', color: 'var(--critical)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ORIGINAL</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.original_excerpt}</p>
                    </div>
                    <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 0, border: '1px solid var(--glass-border)', borderLeft: '3px solid var(--low)' }}>
                      <p style={{ fontSize: '0.62rem', color: 'var(--low)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SUGGESTED</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.suggested_replacement}</p>
                    </div>
                  </div>
                  {r.reason && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>💡 {r.reason}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Negotiation Email */}
          {result.negotiation_email_template && (
            <div className="glass-card" style={{ padding: 24, borderRadius: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.9rem' }}>
                  <Mail size={16} color="var(--text-primary)" /> Negotiation Email Template
                </p>
                <button className="btn btn-ghost" style={{ padding: '8px 16px', borderRadius: 9999, fontSize: '0.72rem' }}
                  onClick={() => navigator.clipboard.writeText(result.negotiation_email_template)}>
                  Copy
                </button>
              </div>
              <pre style={{
                whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: 'var(--text-secondary)',
                lineHeight: 1.7, fontFamily: 'Inter, sans-serif',
                background: 'var(--bg-base)', padding: 18, borderRadius: 0,
                border: '1px solid var(--glass-border)', maxHeight: 400, overflowY: 'auto'
              }}>{result.negotiation_email_template}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── RAW JSON TAB ── */}
      {tab === 'raw' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <pre style={{
            fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.7,
            fontFamily: 'Consolas, monospace', overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto',
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Disclaimer Footer */}
      <div className="disclaimer-banner" style={{ marginTop: 32 }}>
        ⚠️ {DISCLAIMER}
      </div>
    </div>
  );
}
