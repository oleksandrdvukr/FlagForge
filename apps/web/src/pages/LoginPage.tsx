import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { useLogin } from '../api/hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  async function submit(e: FormEvent) {
    e.preventDefault();
    await login.mutateAsync({ email, password });
    const next = params.get('next');
    navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
  }

  const error =
    login.error instanceof ApiError && login.error.status === 401
      ? 'Email or password is incorrect.'
      : login.error
        ? 'Sign-in failed. Check that the server is running and try again.'
        : null;

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          FlagForge
        </div>
        <h1 className="login-title">Sign in</h1>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
