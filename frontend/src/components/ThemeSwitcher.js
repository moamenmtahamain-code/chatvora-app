'use client';

import { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('chatvora-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('chatvora-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <button
      onClick={toggle}
      className="header-action-btn"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
    >
      {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  );
}