'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Route } from 'lucide-react';
import { GlassScene } from '../../../components/glass-scene';
import { ApiError } from '../../../lib/api';
import { Field } from '../../../components/ui';
import { useAuth } from '../../../providers/auth-provider';

export default function LoginPage() {
  const { login, token } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) router.replace('/dashboard');
  }, [token, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-composition">
        <GlassScene />
        <form className="login-card" onSubmit={submit}>
          <div className="login-brand">
            <span className="brand-mark"><Route size={18} aria-hidden /></span>
            <span className="brand-name">TraceChain</span>
          </div>
          <h1>Iniciar sesión</h1>
          <p data-muted style={{ marginTop: 6, marginBottom: 24, fontSize: 13 }}>
            Plataforma de trazabilidad e impacto potencial.
          </p>
          <div className="form-grid">
            <Field label="Correo">
              <input type="email" required autoComplete="username" value={email}
                onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Contraseña">
              <input type="password" required autoComplete="current-password" value={password}
                onChange={(event) => setPassword(event.target.value)} />
            </Field>
            {error ? <div className="warning-strip" role="alert">{error}</div> : null}
            <button className="button button-primary" disabled={busy} type="submit">
              {busy ? 'Entrando…' : 'Entrar'} <ArrowUpRight aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
