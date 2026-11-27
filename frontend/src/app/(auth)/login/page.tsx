'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../../providers/auth-provider';
import { ApiError } from '../../../lib/api';
import { Field, PageHeader } from '../../../components/ui';

export default function LoginPage() {
  const { login, token } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    router.replace('/dashboard');
    return null;
  }

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
    <main className="home" data-surface>
      <PageHeader title="Iniciar sesión"
        description="TraceChain · análisis de trazabilidad e impacto potencial." />
      <form className="form-grid" onSubmit={submit}>
        <Field label="Correo">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña">
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <div className="state state-error" role="alert">{error}</div> : null}
        <div className="form-actions">
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  );
}
