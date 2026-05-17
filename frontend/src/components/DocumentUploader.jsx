import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { api, DISCLAIMER } from '../services/api';

const AGENT_STEPS = [
  { num: 1, name: 'Extractor',          desc: 'Segmenting clauses & entities' },
  { num: 2, name: 'Classifier',         desc: 'Assessing risk severity' },
  { num: 3, name: 'Legal Reasoner',     desc: 'Deep legal reasoning + RAG' },
  { num: 4, name: 'Explainer',          desc: 'Plain-English explanations' },
  { num: 5, name: 'Negotiation Advisor',desc: 'Building negotiation strategy' },
];

export default function DocumentUploader({ onAnalysisComplete }) {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [agentMsg, setAgentMsg]   = useState('');
  const [error, setError]         = useState(null);
  const pollRef                   = useRef(null);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setError(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'text/plain': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [] },
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0];
      setError(err?.code === 'file-too-large' ? 'File exceeds 25MB limit.' : `Unsupported file type. Use PDF, DOCX, or TXT.`);
    }
  });

  const pollStatus = async (sessionId) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getStatus(sessionId);
        setCurrentAgent(status.progress?.agent || 0);
        setAgentMsg(status.progress?.message || '');

        if (status.status === 'completed') {
          clearInterval(pollRef.current);
          const result = await api.getAnalysis(sessionId);
          setUploading(false);
          onAnalysisComplete(result);
        } else if (status.status === 'error') {
          clearInterval(pollRef.current);
          setError('Analysis failed. Please try again.');
          setUploading(false);
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setError('Connection error. Please try again.');
        setUploading(false);
      }
    }, 2000);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true); setError(null); setCurrentAgent(0);
    setAgentMsg('Uploading document...');
    try {
      const result = await api.uploadDocument(file);
      if (result.session_id) await pollStatus(result.session_id);
    } catch (e) {
      setError(e.message || 'Upload failed');
      setUploading(false);
    }
  };

  const reset = () => { setFile(null); setUploading(false); setCurrentAgent(0); setError(null); clearInterval(pollRef.current); };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Dropzone */}
      {!uploading && (
        <div
          {...getRootProps()}
          style={{
            border: `1px dashed ${isDragActive ? 'var(--text-primary)' : 'var(--glass-border)'}`,
            borderRadius: 0, padding: '72px 40px', textAlign: 'center',
            cursor: 'pointer', transition: 'var(--transition)',
            background: isDragActive ? 'var(--bg-surface)' : 'var(--glass-bg)',
            boxShadow: 'none',
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: 48, marginBottom: 20 }}>
            {file ? <FileText size={48} color="var(--text-primary)" /> : <Upload size={48} color="var(--text-muted)" />}
          </div>
          {file ? (
            <>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{file.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {isDragActive ? 'Drop your document here' : 'Drag & drop legal document'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>PDF, DOCX, or TXT · Max 25MB · 150 pages</p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginTop: 12,
          background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 10 }}>
          <AlertCircle size={16} color="var(--critical)" />
          <span style={{ color: 'var(--critical)', fontSize: '0.85rem' }}>{error}</span>
        </div>
      )}

      {/* Agent Progress */}
      {uploading && (
        <div className="glass-card" style={{ padding: 28, marginTop: 0 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 20, textAlign: 'center' }}>
            📄 Analyzing: <strong style={{ color: 'var(--text-primary)' }}>{file?.name}</strong>
          </p>
          {AGENT_STEPS.map((step) => {
            const isDone    = currentAgent > step.num;
            const isActive  = currentAgent === step.num;
            return (
              <div key={step.num} className={`progress-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                style={{ marginBottom: 8, opacity: !isDone && !isActive && currentAgent < step.num ? 0.3 : 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone ? 'rgba(16,185,129,0.2)' : isActive ? 'rgba(0,212,255,0.15)' : 'var(--glass-bg)',
                  border: `1px solid ${isDone ? 'rgba(16,185,129,0.5)' : isActive ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
                  flexShrink: 0,
                }}>
                  {isDone ? <CheckCircle size={14} color="var(--low)" /> :
                   isActive ? <div className="spinner" style={{ width: 14, height: 14 }} /> :
                   <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{step.num}</span>}
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? 'var(--brand-blue)' : 'var(--text-primary)', marginBottom: 2 }}>
                    Agent {step.num} — {step.name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isActive ? agentMsg || step.desc : isDone ? '✓ Complete' : step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {!uploading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {file && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px 20px', fontSize: '0.95rem' }}
                onClick={handleAnalyze}>
                🔍 Analyze Document
              </button>
              <button className="btn btn-ghost" onClick={reset}>Clear</button>
            </div>
          )}
          {!file && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                alignSelf: 'center',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                border: '1px solid rgba(0,212,255,0.2)',
                background: 'rgba(0,212,255,0.05)',
                color: 'var(--brand-blue)',
                borderRadius: '12px'
              }}
              onClick={() => {
                const content = `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is made effective as of today, between LexGuard AI ("Employer") and the undersigned employee ("Employee").

1. POSITION AND DUTIES
The Employer agrees to employ the Employee as a Software Engineer. The Employee agrees to perform all duties assigned to them. The Employer reserves the right to change the Employee's title, duties, and reporting relationships at any time, for any reason, with or without notice.

2. COMPENSATION
The Employee will be paid a base salary of $100,000 per year. The Employer may reduce this salary at its sole discretion at any point.

3. NON-COMPETE
The Employee agrees that during their employment and for a period of 5 years following termination of employment for any reason, they will not work for any competitor worldwide.

4. INTELLECTUAL PROPERTY
All intellectual property created by the Employee, whether during or outside of working hours, using company or personal equipment, shall be the exclusive property of the Employer.

5. TERMINATION
The Employer may terminate this Agreement at any time, with or without cause, and without severance pay.

6. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Nowhere.

IN WITNESS WHEREOF, the parties have executed this Agreement.`;
                const sampleFile = new File([content], "dummy_contract.txt", { type: "text/plain" });
                setFile(sampleFile);
                setError(null);
              }}
            >
              ✨ Try with a Sample Contract
            </button>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer-banner" style={{ marginTop: 20 }}>
        ⚠️ {DISCLAIMER}
      </div>
    </div>
  );
}
