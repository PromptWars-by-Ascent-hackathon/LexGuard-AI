import { useState, useEffect } from 'react';
import { Shield, Clock, FileText, TrendingUp, BarChart2 } from 'lucide-react';
import { api, DISCLAIMER } from '../services/api';
import DocumentUploader from '../components/DocumentUploader';
import AnalysisPage from './AnalysisPage';

export default function Dashboard() {
  const [view, setView]         = useState('home');   // 'home' | 'analysis'
  const [result, setResult]     = useState(null);
  const [sessions, setSessions] = useState([]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, []);

  const handleAnalysisComplete = (r) => {
    setResult(r);
    setView('analysis');
    loadSessions();
  };

  if (view === 'analysis' && result) {
    return <AnalysisPage result={result} onBack={() => setView('home')} />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Hero Upload Zone */}
      <div style={{ textAlign: 'center', marginBottom: 56, paddingTop: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '4px 16px',
          background: 'rgba(234,230,223,0.03)', border: '1px solid var(--glass-border)', borderRadius: 9999, marginBottom: 24 }}>
          <div style={{ width: 5, height: 5, background: 'var(--text-primary)', animation: 'pulse-glow 2s infinite' }} />
          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            SYSTEM ACTIVE · PIPELINE STABLE
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 3.8rem)', fontWeight: 800, marginBottom: 20, lineHeight: 1.05, textTransform: 'uppercase' }}>
          Know what you sign.<br />
          <span style={{ color: 'var(--text-muted)' }}>
            Before you sign it.
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Upload any legal agreement. Our 3-agent architectural pipeline isolates risk, exposes one-sided clauses, and drafts redlines — instantly.
        </p>
      </div>

      {/* Upload Component */}
      <DocumentUploader onAnalysisComplete={handleAnalysisComplete} />

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'var(--glass-border)', border: '1px solid var(--glass-border)', marginTop: 56, marginBottom: 48 }}>
        {[
          { icon: Shield,    label: 'Risk Dimensions',  value: '7' },
          { icon: BarChart2, label: 'Clause Categories',value: '40+' },
          { icon: TrendingUp,label: 'AI Agents',        value: '3' },
          { icon: FileText,  label: 'Document Types',   value: '25+' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-base)', border: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 0, background: 'var(--bg-surface)',
              border: `1px solid var(--glass-border)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color="var(--text-muted)" />
            </div>
            <div>
              <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Clock size={16} color="var(--text-muted)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Analyses</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.slice(0, 5).map(s => (
              <div key={s.session_id} className="glass-card"
                style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: s.status === 'completed' ? 'pointer' : 'default' }}
                onClick={async () => {
                  if (s.status !== 'completed') return;
                  const r = await api.getAnalysis(s.session_id);
                  handleAnalysisComplete(r);
                }}>
                <FileText size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }} className="truncate">
                    {s.filename || 'Unknown file'}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {s.document_type || '—'} · {s.created_at?.split('T')[0]}
                  </p>
                </div>
                {s.status === 'completed' && s.overall_risk_score !== undefined && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color:
                      s.overall_risk_score >= 76 ? '#ff3b5c' :
                      s.overall_risk_score >= 51 ? '#ff6b35' :
                      s.overall_risk_score >= 26 ? '#f59e0b' : '#10b981' }}>
                      {s.overall_risk_score}
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Risk Score</p>
                  </div>
                )}
                {s.status === 'processing' && (
                  <div className="spinner" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer-banner" style={{ marginTop: 40 }}>
        ⚠️ {DISCLAIMER}
      </div>
    </div>
  );
}
