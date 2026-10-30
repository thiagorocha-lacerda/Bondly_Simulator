import { useEffect, useState, type ReactNode } from 'react';

/**
 * PreviewGate — porta de senha ÚNICA para o build de PREVIEW ESTÁTICO (validação interna da UI).
 *
 * ⚠️ AVISO DE SEGURANÇA (consciente, decisão do CTO):
 * Num Static Site NÃO há servidor para verificar a senha. A comparação acontece no browser e a
 * senha vive no bundle (VITE_PREVIEW_PASSWORD é embutida no build). Qualquer pessoa com o link +
 * DevTools consegue lê-la. Isto NÃO é segurança — é um "aviso de não-entre" para validação
 * interna sem link externo. A segurança REAL do produto é o Web Service (OAuth + RBAC + 2º fator),
 * que permanece intacto no render.yaml. Este gate só existe quando VITE_PREVIEW_MODE === 'true'.
 */

const UNLOCK_KEY = 'bondly-preview-unlocked';

function previewEnabled(): boolean {
  return import.meta.env.VITE_PREVIEW_MODE === 'true';
}

function expectedPassword(): string {
  return (import.meta.env.VITE_PREVIEW_PASSWORD as string | undefined) ?? '';
}

export function PreviewGate({ children }: { children: ReactNode }) {
  // Fora do modo preview (Web Service real), o gate é inerte — não renderiza nada próprio.
  if (!previewEnabled()) return <>{children}</>;

  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (unlocked) {
      try {
        sessionStorage.setItem(UNLOCK_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, [unlocked]);

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = expectedPassword();
    // Comparação cosmética no cliente — documentada como inseguro por design (ver cabeçalho).
    if (expected.length > 0 && value === expected) {
      setError(false);
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg, #0b0d12)',
        color: 'var(--fg, #e8ebf2)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--panel, #161a22)',
          color: 'var(--fg, #e8ebf2)',
          border: '1px solid var(--border, #2a2f3a)',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.5 }}>
          BONDLY <span style={{ opacity: 0.6, fontWeight: 400 }}>· preview interno</span>
        </div>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
          Ambiente de validação da interface. Digite a senha de acesso para continuar.
        </p>
        <label htmlFor="preview-pw" style={{ fontSize: 12, opacity: 0.7, display: 'block', marginBottom: 6 }}>
          Senha de acesso
        </label>
        <input
          id="preview-pw"
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 8,
            border: `1px solid ${error ? 'var(--danger, #e5484d)' : 'var(--border, #2a2f3a)'}`,
            background: 'var(--bg, #0b0d12)',
            color: 'var(--fg, #e8ebf2)',
            outline: 'none',
          }}
        />
        {error && (
          <div role="alert" style={{ color: 'var(--danger, #e5484d)', fontSize: 12, marginTop: 8 }}>
            Senha incorreta.
          </div>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            marginTop: 20,
            padding: '11px 12px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent, #4f7cff)',
            color: '#fff',
          }}
        >
          Entrar
        </button>
        <p style={{ fontSize: 11, opacity: 0.45, marginTop: 18, lineHeight: 1.5 }}>
          Preview estático para validação interna. Não substitui o controle de acesso de produção.
        </p>
      </form>
    </div>
  );
}
