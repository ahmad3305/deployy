'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const canSubmit = email && password.length >= 6;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json?.message || 'Login failed');
        return;
      }

      localStorage.setItem('token', json.data.token);
      localStorage.setItem('user', JSON.stringify(json.data.user));

      if (json.data.user.role === 'Customer') router.push('/dashboard');
      else router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Login</h1>
        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              style={styles.input}
            />
          </label>
          {error ? <p style={styles.error}>{error}</p> : null}
          <button type="submit" disabled={!canSubmit || loading} style={styles.button}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <p style={styles.footer}>
            Don&apos;t have an account? <a href="/register">Register</a>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: '#0b1220',
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 14,
    padding: 20,
  },
  title: { margin: 0, marginBottom: 12, fontSize: 26 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#cbd5e1' },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e5e7eb',
    outline: 'none',
  },
  button: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#2563eb',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { margin: 0, color: '#fca5a5', fontSize: 14 },
  footer: { margin: '6px 0 0', fontSize: 14, color: '#9ca3af' },
};