'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAuthStore from '../../stores/authStore';
import { FiMail, FiLock, FiUser, FiArrowRight } from 'react-icons/fi';

export default function Login() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRegister) {
      const success = await useAuthStore.getState().register(
        formData.email,
        formData.password,
        formData.username,
        formData.displayName
      );
      if (success) {
        router.push('/');
      }
    } else {
      const success = await login(formData.email, formData.password);
      if (success) {
        router.push('/');
      }
    }
  };

  const handleChange = (e) => {
    if (error) clearError();
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const switchMode = (registerMode) => {
    clearError();
    setIsRegister(registerMode);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1>ChatWave</h1>
          <p>{isRegister ? 'Create your account' : 'Welcome back'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label>Username</label>
                <div className="search-bar" style={{ padding: '0 16px' }}>
                  <FiUser style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="username"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={handleChange}
                    className="form-input"
                    style={{ background: 'transparent', border: 'none', outline: 'none' }}
                    required
                    minLength={3}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Display Name</label>
                <div className="search-bar" style={{ padding: '0 16px' }}>
                  <FiUser style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="displayName"
                    placeholder="Your display name"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="form-input"
                    style={{ background: 'transparent', border: 'none', outline: 'none' }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <div className="search-bar" style={{ padding: '0 16px' }}>
              <FiMail style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                style={{ background: 'transparent', border: 'none', outline: 'none' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="search-bar" style={{ padding: '0 16px' }}>
              <FiLock style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                style={{ background: 'transparent', border: 'none', outline: 'none' }}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? (
              <span>Loading...</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {isRegister ? 'Create Account' : 'Login'} <FiArrowRight />
              </span>
            )}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <p className="auth-switch">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <a href="#" onClick={() => switchMode(false)}>Sign in</a>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <a href="#" onClick={() => switchMode(true)}>Create one</a>
            </>
          )}
        </p>

      </div>
    </div>
  );
}
