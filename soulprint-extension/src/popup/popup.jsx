import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, LogIn, LogOut, Sparkles } from 'lucide-react';
import { sendRuntimeMessage } from '../shared/chrome';
import './popup.css';
import './google.css';

function Popup() {
  const [session, setSession] = useState(null), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [loading, setLoading] = useState(true), [googleLoading, setGoogleLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => { sendRuntimeMessage({ action: 'session' }).then(setSession).catch(() => setSession({ authenticated: false })).finally(() => setLoading(false)); }, []);
  async function login(event) { event.preventDefault(); setLoading(true); setError(''); try { await sendRuntimeMessage({ action: 'login', email, password }); setSession({ authenticated: true, user: { email } }); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  async function googleLogin() { setGoogleLoading(true); setError(''); try { const user = await sendRuntimeMessage({ action: 'googleLogin' }); setSession({ authenticated: true, user }); } catch (err) { setError(err.message); } finally { setGoogleLoading(false); } }
  async function openSidebar() { setError(''); try { await sendRuntimeMessage({ action: 'openSidebar' }); window.close(); } catch { setError('SoulPrint cannot open on this browser page. Try a regular website tab.'); } }
  async function logout() { await sendRuntimeMessage({ action: 'logout' }); setSession({ authenticated: false }); }
  if (loading && !session) return <main className="popup center"><span className="spinner" /> Checking your session…</main>;
  return <main className="popup"><header><span className="brand-mark"><Sparkles size={19} /></span><div><strong>SoulPrint</strong><small>AI in every tab</small></div></header>{session?.authenticated ? <section className="signed-in"><div className="welcome"><span>Ready when you are</span><small>{session.user?.email || 'Signed in to SoulPrint'}</small></div><button className="primary" onClick={openSidebar}>Open sidebar <ArrowRight size={17} /></button><button className="ghost" onClick={logout}><LogOut size={15} /> Sign out</button></section> : <form onSubmit={login}><h1>Welcome back</h1><p>Use your SoulPrint account to continue.</p><button className="google" type="button" onClick={googleLogin} disabled={googleLoading || loading}>{googleLoading ? <span className="spinner" /> : <span className="google-mark">G</span>} Continue with Google</button><div className="divider"><span>or</span></div><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="error">{error}</div>}<button className="primary" disabled={loading || googleLoading}>{loading ? <span className="spinner" /> : <LogIn size={17} />} Sign in with email</button><div className="links"><a href="https://soulprintengine.ai/auth" target="_blank" rel="noreferrer">Forgot password?</a><a href="https://soulprintengine.ai/auth" target="_blank" rel="noreferrer">Create account</a></div></form>}{error && session?.authenticated && <div className="error footer-error">{error}</div>}<footer>Ctrl + Shift + S toggles the sidebar</footer></main>;
}
createRoot(document.getElementById('root')).render(<Popup />);
