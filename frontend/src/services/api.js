// LexGuard API service
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : '';

export const api = {
  // Upload document and start analysis
  async uploadDocument(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  // Poll for pipeline status
  async getStatus(sessionId) {
    const res = await fetch(`${API_BASE}/api/v1/analysis/${sessionId}/status`);
    if (!res.ok) throw new Error('Status check failed');
    return res.json();
  },

  // Get full analysis results
  async getAnalysis(sessionId) {
    const res = await fetch(`${API_BASE}/api/v1/analysis/${sessionId}`);
    if (res.status === 202) return { status: 'processing' };
    if (!res.ok) throw new Error('Analysis fetch failed');
    return res.json();
  },

  // List all sessions
  async getSessions() {
    const res = await fetch(`${API_BASE}/api/v1/sessions`);
    if (!res.ok) throw new Error('Sessions fetch failed');
    return res.json();
  },

  // Health check
  async health() {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  }
};

export const SEVERITY_CONFIG = {
  CRITICAL:      { color: '#ff3b5c', bg: 'rgba(255,59,92,0.12)',  label: 'Critical',      dot: '🔴' },
  HIGH:          { color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', label: 'High',          dot: '🟠' },
  MEDIUM:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Medium',        dot: '🟡' },
  LOW:           { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Low',           dot: '🟢' },
  INFORMATIONAL: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)',label: 'Informational', dot: '⚪' },
};

export const DISCLAIMER = "LexGuard is an AI-powered awareness tool and does not constitute legal advice. Consult a licensed attorney in your jurisdiction for legally binding guidance.";
