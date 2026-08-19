'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['health', 'preferences', 'personal', 'work', 'family', 'travel', 'hobbies', 'goals', 'other'];

function authHeaders(token, extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extra };
}

export default function MemoriesPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState('');
  const [keepOverrides, setKeepOverrides] = useState({});

  const [editId, setEditId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async (t) => {
    try {
      const res = await fetch('/api/memories', { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) { localStorage.removeItem('sp_token'); router.push('/auth'); return; }
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) {
      console.error('load memories failed', e);
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

  const runScan = async () => {
    setScanning(true);
    setScanError('');
    setScanDone(false);
    try {
      const res = await fetch('/api/memories/cleanup', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });
      if (res.status === 401) { localStorage.removeItem('sp_token'); router.push('/auth'); return; }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setKeepOverrides({});
    } catch (e) {
      setScanError('Scan failed. Try again.');
    } finally {
      setScanning(false);
      setScanDone(true);
    }
  };

  const applySuggestion = async (sug) => {
    const keepId = keepOverrides[sug.id] ?? sug.keep_id;
    const toDelete = sug.memories.filter((m) => m.id !== keepId).map((m) => m.id);
    if (toDelete.length === 0) { dismissSuggestion(sug); return; }
    await Promise.all(
      toDelete.map((id) => fetch(`/api/memories/${id}`, { method: 'DELETE', headers: authHeaders(token) }))
    );
    await load(token);
    setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
  };

  const dismissSuggestion = (sug) => setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));

  const deleteMemory = async (id) => {
    await fetch(`/api/memories/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    await load(token);
  };

  const startEdit = (m) => { setEditId(m.id); setEditContent(m.content); };
  const saveEdit = async (id) => {
    await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ content: editContent }),
    });
    setEditId(null);
    await load(token);
  };

  const filtered = memories.filter((m) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || (m.content || '').toLowerCase().includes(q);
    const matchC = !category || m.category === category;
    return matchQ && matchC;
  });

  return (
    <div style={{ background: '#0D1217', minHeight: '100vh', color: '#D2D3D7', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: '#F64000', textTransform: 'uppercase', fontWeight: 600 }}>SoulPrint</div>
            <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 700, margin: '4px 0 0', textTransform: 'uppercase', fontFamily: '"Barlow Condensed", Impact, sans-serif' }}>
              Your memories
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/chat" style={{ color: '#707176', fontSize: 14, textDecoration: 'none', padding: '10px 16px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8 }}>Back to chat</a>
            <button onClick={runScan} disabled={scanning}
              style={{ background: '#F64000', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.7 : 1 }}>
              {scanning ? 'Scanning…' : 'Scan for issues'}
            </button>
          </div>
        </div>

        {/* Scan results */}
        {scanError && <p style={{ color: '#ff6b6b' }}>{scanError}</p>}

        {scanning && (
          <div style={{ background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 20 }}>
            <p style={{ color: '#D2D3D7' }}>Reviewing {memories.length} memories for duplicates, contradictions, and outdated info…</p>
            <p style={{ color: '#707176', fontSize: 13, marginTop: 6 }}>This can take a minute for large memory sets.</p>
          </div>
        )}

        {scanDone && !scanning && suggestions.length === 0 && (
          <div style={{ background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <p style={{ color: '#3ED97E', fontWeight: 600 }}>✓ Nothing to clean up.</p>
            <p style={{ color: '#707176', fontSize: 14, marginTop: 4 }}>No duplicates, contradictions, or outdated memories found.</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: '#fff', fontSize: 20, textTransform: 'uppercase', fontFamily: '"Barlow Condensed", Impact, sans-serif', marginBottom: 12 }}>
              {suggestions.length} issue{suggestions.length === 1 ? '' : 's'} found
            </h2>
            {suggestions.map((sug) => {
              const keepId = keepOverrides[sug.id] ?? sug.keep_id;
              return (
                <div key={sug.id} style={{ background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <span style={{ background: sug.type === 'duplicate' ? '#F64000' : sug.type === 'contradiction' ? '#f6a800' : '#707176', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {sug.type}
                      </span>
                      <span style={{ marginLeft: 10, color: '#fff', fontSize: 14, fontWeight: 600 }}>{sug.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => dismissSuggestion(sug)} style={{ background: 'transparent', color: '#707176', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Dismiss</button>
                      <button onClick={() => applySuggestion(sug)} style={{ background: '#F64000', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                    </div>
                  </div>
                  {sug.reason && <p style={{ color: '#707176', fontSize: 13, marginBottom: 10 }}>{sug.reason}</p>}
                  {sug.memories.map((m) => {
                    const isKeep = m.id === keepId;
                    return (
                      <div key={m.id} onClick={() => sug.type !== 'stale' && setKeepOverrides((p) => ({ ...p, [sug.id]: m.id }))}
                        style={{
                          padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: sug.type === 'stale' ? 'default' : 'pointer',
                          background: isKeep ? 'rgba(62,217,126,.1)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${isKeep ? 'rgba(62,217,126,.5)' : 'rgba(255,255,255,.06)'}`,
                        }}>
                        <div style={{ fontSize: 14, color: '#fff' }}>{m.content}</div>
                        <div style={{ fontSize: 12, color: '#707176', marginTop: 3 }}>
                          {m.category} · {m.importance}
                          {isKeep && <span style={{ color: '#3ED97E', marginLeft: 8, fontWeight: 600 }}>KEEPING</span>}
                          {!isKeep && sug.type !== 'stale' && <span style={{ marginLeft: 8 }}>— click to keep this instead</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Manual list */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memories…"
            style={{ flex: 1, background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14 }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '10px 12px', color: '#D2D3D7', fontSize: 14 }}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <p style={{ color: '#707176', fontSize: 13, marginBottom: 12 }}>{memories.length} total · showing {filtered.length}</p>

        {loading ? (
          <p style={{ color: '#707176' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#707176' }}>No memories match.</p>
        ) : (
          <div>
            {filtered.map((m) => (
              <div key={m.id} style={{ background: '#141A20', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {editId === m.id ? (
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2}
                      style={{ width: '100%', background: '#06090C', border: '1px solid rgba(246,64,0,.5)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 14 }} />
                  ) : (
                    <div style={{ fontSize: 14, color: '#fff' }}>{m.content}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#707176', marginTop: 3 }}>{m.category} · {m.importance}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {editId === m.id ? (
                    <>
                      <button onClick={() => saveEdit(m.id)} style={btn}>Save</button>
                      <button onClick={() => setEditId(null)} style={btnGhost}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(m)} style={btnGhost}>Edit</button>
                      <button onClick={() => deleteMemory(m.id)} style={{ ...btnGhost, color: '#ff6b6b' }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btn = { background: '#F64000', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost = { background: 'transparent', color: '#D2D3D7', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer' };
