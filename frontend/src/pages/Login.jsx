import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';
import { api } from '../services/api';
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '';

export default function Login() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, phone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Shield size={40} color="var(--text-primary)" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>Sign in to continue to LexGuard AI</p>
        </div>

        {error && (
          <div style={{ background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)', padding: '10px 14px', marginBottom: 20, fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 8 }}>Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 8 }}>Phone Number <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}>(Optional, Defaults to +91)</span></label>
            <input 
              type="tel" 
              placeholder="9063163226"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          
          <div style={{ marginBottom: 30 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 8 }}>Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-base)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '14px', background: 'var(--text-primary)', color: '#000', border: 'none', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', transition: 'var(--transition)' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Don't have an account? <Link to="/signup" style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
