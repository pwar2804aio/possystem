import { useState } from 'react';
import { VERSION } from '../lib/version';
import { supabase } from '../lib/supabase';

export default function BOLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onLogin(data.user);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: 380, background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 auto 12px',
          }}>R</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Restaurant OS</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Back Office</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <input type="checkbox" id="remember" checked={remember} onChange={e=>setRemember(e.target.checked)}
              style={{ width:15, height:15, cursor:'pointer', accentColor:'var(--accent)' }} />
            <label htmlFor="remember" style={{ fontSize:13, color:'var(--text-secondary)', cursor:'pointer' }}>
              Keep me logged in
            </label>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, background: '#fef2f2',
              border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8,
              background: loading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff', fontWeight: 600, fontSize: 14,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          Restaurant OS · Staff POS access is via PIN on the terminal
          <div style={{ fontFamily:'monospace', fontSize:11, marginTop:6, color:'var(--text-muted)' }}>v{VERSION}</div>
        </div>
      </div>
    </div>
  );
}
