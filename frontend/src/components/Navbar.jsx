import { Shield, ExternalLink, GitBranch, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DISCLAIMER } from '../services/api';

export default function Navbar() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

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
        <span style={{
          fontSize: '0.62rem', color: 'var(--text-secondary)',
          padding: '4px 12px', borderRadius: 9999,
          border: '1px solid var(--glass-border)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }} className="hide-mobile">
          Powered by Gemini AI
        </span>
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
