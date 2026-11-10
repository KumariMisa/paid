'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(url, body) {
    setBusy(true); setError('');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Something went wrong. Try again.'); setBusy(false); return; }
    router.push('/dashboard');
    router.refresh();
  }

  function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    post(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', f);
  }

  return (
    <div className="auth">
      <h2>{mode === 'login' ? 'Log in to Paid' : 'Start invoicing with Claude'}</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        {mode === 'signup' && (
          <div className="field"><label htmlFor="bn">Business name</label><input id="bn" name="business_name" className="input" placeholder="Shown on your invoices" /></div>
        )}
        <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" className="input" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="pw">Password</label><input id="pw" name="password" type="password" className="input" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <div className="divider">or</div>
      <button type="button" className="btn btn--quiet btn--block" disabled={busy} onClick={() => post('/api/auth/demo')}>Open the demo account</button>
      <p className="tiny" style={{ margin: 0 }}>Demo login: demo@paid.app / demo1234</p>
    </div>
  );
}
