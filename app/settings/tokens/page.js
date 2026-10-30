'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Personal access tokens.
 *
 * These exist for one job: letting an editor's lifecycle hook call /api/sweep without a
 * browser session. Codex and every shell-hook harness (Cursor, Gemini CLI, Windsurf, Cline,
 * Copilot) can only run a command, so they need a credential that outlives a login.
 *
 * The plaintext is shown exactly once, immediately after creation. That is not a UI
 * preference — only a hash is stored, so it genuinely cannot be shown again, and the page
 * has to say so rather than letting someone discover it later.
 */

const card = {
  background: '#141A20',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 12,
  padding: '16px 18px',
  marginBottom: 10,
};

const muted = { color: '#707176', fontSize: 13 };

const btn = {
  background: '#F5531A',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost = {
  background: 'transparent',
  color: '#D2D3D7',
  border: '1px solid rgba(255,255,255,.18)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const input = {
  width: '100%',
  background: '#06090C',
  border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#fff',
  fontSize: 14,
};

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TokensPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState(null);       // plaintext, shown once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (t) => {
    try {
      const res = await fetch('/api/tokens', { headers: authHeaders(t) });
      if (res.status === 401) { localStorage.removeItem('sp_token'); router.push('/auth'); return; }
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {
      setError('Could not load tokens.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    if (!t) { router.push('/auth'); return; }
    setToken(t);
    load(t);
  }, [load, router]);

  async function create() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ name: name || 'Editor hook', scopes: ['sweep'] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not create token'); return; }
      setFresh(data.token);
      setName('');
      await load(token);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    if (res.status === 401) { localStorage.removeItem('sp_token'); router.push('/auth'); return; }
    await load(token);
  }

  async function copyFresh() {
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the token and copy it manually.');
    }
  }

  if (loading) {
    return <main style={{ padding: 40, color: '#D2D3D7' }}>Loading tokens…</main>;
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px', color: '#fff' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Access tokens</h1>
      <p style={{ ...muted, marginBottom: 24, lineHeight: 1.6 }}>
        For editor hooks. A token lets Codex, Cursor, Gemini CLI, Windsurf, Cline or Copilot
        save memories at the end of a session without you being signed in. It can write
        memories and nothing else — it cannot read your account, change billing, or delete
        anything.
      </p>

      {fresh && (
        <div style={{ ...card, border: '1px solid rgba(245,83,26,.55)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Copy this now — it cannot be shown again.</div>
          <div style={{ ...muted, marginBottom: 12 }}>
            Only a hash is stored, so there is no way to recover this. If you lose it, create another and revoke this one.
          </div>
          <code
            style={{
              display: 'block', wordBreak: 'break-all', background: '#06090C',
              border: '1px solid rgba(255,255,255,.14)', borderRadius: 8,
              padding: '12px 14px', fontSize: 13, lineHeight: 1.5, marginBottom: 12,
            }}
          >
            {fresh}
          </code>
          <button onClick={copyFresh} style={btn}>{copied ? 'Copied' : 'Copy token'}</button>
          <button onClick={() => setFresh(null)} style={{ ...btnGhost, marginLeft: 8 }}>Done</button>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Create a token</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What is this for? (e.g. Codex on my laptop)"
          style={{ ...input, marginBottom: 10 }}
        />
        <button onClick={create} disabled={creating} style={{ ...btn, opacity: creating ? 0.6 : 1 }}>
          {creating ? 'Creating…' : 'Create token'}
        </button>
        {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 600, margin: '26px 0 12px' }}>Your tokens</h2>
      {tokens.length === 0 ? (
        <p style={muted}>No tokens yet.</p>
      ) : (
        tokens.map((t) => (
          <div key={t.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
              <div style={{ ...muted, marginTop: 4 }}>
                <code style={{ fontSize: 12 }}>{t.prefix}…{t.last4}</code>
                {formatWhen(t.created_at) ? ` · created ${formatWhen(t.created_at)}` : ''}
                {t.last_used_at ? ` · last used ${formatWhen(t.last_used_at)}` : ' · never used'}
                {t.revoked_at ? ` · revoked ${formatWhen(t.revoked_at)}` : ''}
              </div>
              <div style={{ ...muted, marginTop: 4 }}>
                Scope: {(t.scopes || []).join(', ') || 'none'}
              </div>
            </div>
            {!t.revoked_at && (
              <button onClick={() => revoke(t.id)} style={{ ...btnGhost, color: '#ff6b6b', flexShrink: 0 }}>
                Revoke
              </button>
            )}
          </div>
        ))
      )}

      <h2 style={{ fontSize: 17, fontWeight: 600, margin: '28px 0 10px' }}>Use it from a hook</h2>
      <p style={{ ...muted, marginBottom: 10, lineHeight: 1.6 }}>
        Any editor that can run a shell command at the end of a session can call this:
      </p>
      <pre
        style={{
          background: '#06090C', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
          padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto', color: '#D2D3D7',
        }}
      >{`curl -X POST https://soulprintengine.ai/api/sweep \\
  -H "Authorization: Bearer $SOULPRINT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"memories":"fact one\\nfact two"}'`}</pre>
    </main>
  );
}
