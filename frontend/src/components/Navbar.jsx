import { Shield, GitBranch, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--bg-base)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--glass-border)',
      padding: '0 24px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', cursor: 'pointer' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 0,
          background: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'var(--transition)'
        }} className="logo-box">
          <Shield size={16} color="var(--bg-base)" />
        </div>
        <div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            LEX<span style={{ color: 'var(--text-muted)' }}>GUARD</span>
          </span>
          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginTop: -2, letterSpacing: '0.2em', fontWeight: 700 }}>
            CONTRACT INTELLIGENCE
          </span>
        </div>
      </a>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 8 }} className="hide-mobile">
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{user.name}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{user.phone}</span>
            </div>
            <button 
              onClick={logout}
              style={{
                fontSize: '0.65rem', color: 'var(--text-secondary)',
                padding: '6px 14px', borderRadius: 0,
                background: 'transparent', border: '1px solid var(--glass-border)',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                cursor: 'pointer', transition: 'var(--transition)'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
            >
              Sign Out
            </button>
          </div>
        )}
        <button onClick={toggleTheme} aria-label={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', transition: 'var(--transition)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a href="https://github.com/Ndheeraj906/LexGuard-AI" target="_blank" rel="noopener noreferrer"
          aria-label="View repository on GitHub"
          style={{ color: 'var(--text-muted)', display: 'flex', transition: 'var(--transition)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <GitBranch size={16} />
        </a>
      </div>
    </nav>
  );
}
