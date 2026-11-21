import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Brand } from '../components/Ui.jsx';

function AuthFrame({ mode, children }) {
  const isLogin = mode === 'login';
  return <main className="auth-screen">
    <section className="auth-brand-panel"><Brand/><div className="auth-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-core"><span/><span/><span/></div><div className="art-label label-one">usage stream <i/></div><div className="art-label label-two"><i/> requests secured</div></div><div className="auth-brand-copy"><div className="eyebrow eyebrow-light">API CONTROL ROOM</div><h2>Visibility for every request.</h2><p>Protect your API, understand your usage, and stay ahead of every quota.</p><div className="auth-brand-foot"><span>01</span><span className="auth-progress"><i/></span><span>03</span></div></div><div className="auth-panel-caption">BUILT FOR DEVELOPERS <span>·</span> DESIGNED FOR CLARITY</div></section>
    <section className="auth-form-panel"><div className="auth-mobile-brand"><Brand/></div><div className="auth-form-wrap">{children}<div className="auth-switch">{isLogin ? <>New to Meterline? <Link to="/register">Create an account <span>→</span></Link></> : <>Already have an account? <Link to="/login">Sign in <span>→</span></Link></>}</div><div className="auth-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</div></div></section>
  </main>;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Enter a valid email address.');
    if (form.password.length < 12 || form.password.length > 128) return setError('Password must be between 12 and 128 characters.');
    setSubmitting(true);
    try { await login({ email: form.email.trim(), password: form.password }); navigate(location.state?.from || '/', { replace: true }); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  return <AuthFrame mode="login"><div className="form-overline">WELCOME BACK</div><h1>Sign in to your account</h1><p className="auth-intro">Your API usage, keys, and limits are waiting.</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      <label htmlFor="login-email">Work email</label><input id="login-email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required/>
      <div className="field-heading"><label htmlFor="login-password">Password</label><span>JWT sessions expire after 15 minutes</span></div><input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required/>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary auth-submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} <span>→</span></button>
    </form>
  </AuthFrame>;
}

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2 || form.name.trim().length > 100) return setError('Name must be between 2 and 100 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Enter a valid email address.');
    if (form.password.length < 12 || form.password.length > 128 || !form.password.trim()) return setError('Use a password between 12 and 128 characters.');
    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      await login({ email: form.email.trim(), password: form.password });
      navigate('/', { replace: true });
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  return <AuthFrame mode="register"><div className="form-overline">GET STARTED</div><h1>Create your workspace</h1><p className="auth-intro">Start metering your API usage in minutes.</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      <label htmlFor="register-name">Your name</label><input id="register-name" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required/>
      <label htmlFor="register-email">Work email</label><input id="register-email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required/>
      <label htmlFor="register-password">Password</label><input id="register-password" type="password" autoComplete="new-password" placeholder="At least 12 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required/>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary auth-submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'} <span>→</span></button>
    </form>
  </AuthFrame>;
}
