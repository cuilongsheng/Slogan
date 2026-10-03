import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { firstPermittedRoute } from '../layouts/navigation';
import { zhCN } from '../i18n/zh-CN';
import logo from '../../../../assets/brand/slogan-logo.png';
import { googleConfigured, requestGoogleCode } from '../features/auth/google';

export function SignInView() {
  const { status, me, pendingUserId, login, loginGoogle, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (status === 'checking') return <div className="auth-stage">{zhCN.common.loading}</div>;
  if (status === 'ready' && me) return <Navigate to={firstPermittedRoute(me.roles)} replace />;
  if (status === 'forbidden')
    return (
      <div className="auth-stage">
        <section className="auth-card">
          <h1>{zhCN.common.noAccess}</h1>
          <p>请联系平台管理员为此账号授权。</p>
          {pendingUserId && (
            <p>
              当前用户标识：<code>{pendingUserId}</code>
            </p>
          )}
          <button className="primary-button" onClick={() => void logout()}>
            {zhCN.common.signOut}
          </button>
        </section>
      </div>
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }
  async function submitGoogle() {
    setBusy(true);
    setError('');
    try {
      const code = await requestGoogleCode();
      if (code) await loginGoogle(code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google 登录失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-stage">
      <section className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="" />
          <span>Slogan Admin</span>
        </div>
        <h1>登录管理后台</h1>
        <p>使用已获授权的平台账号登录。</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            {zhCN.common.username}
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            {zhCN.common.password}
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? zhCN.common.loading : zhCN.common.signIn}
          </button>
        </form>
        <button
          className="outline-button google-button"
          disabled={busy}
          onClick={() => void submitGoogle()}
        >
          使用 Google 登录{googleConfigured() ? '' : '（需配置）'}
        </button>
      </section>
    </div>
  );
}
