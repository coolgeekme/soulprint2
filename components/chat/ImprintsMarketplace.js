'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Search, Sparkles, Download, Check, X, ChevronLeft, Star, Loader2, Wand2, User, Zap } from 'lucide-react';

// ── Imprint Card ────────────────────────────────────────────────────────────
function ImprintCard({ imprint, isInstalled, onSelect, onInstall }) {
  return (
    <button
      onClick={() => onSelect(imprint)}
      className="group relative flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    >
      {isInstalled && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <Check className="w-3 h-3 mr-1" /> Active
          </Badge>
        </div>
      )}
      <div className="flex items-center gap-3 w-full">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
          style={{ backgroundColor: (imprint.color || '#6366F1') + '20' }}
        >
          {imprint.icon || '✨'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground truncate pr-12 group-hover:text-primary transition-colors">
            {imprint.name}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{imprint.short_description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {(imprint.tags || []).slice(0, 3).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-auto pt-1 text-[10px] text-muted-foreground w-full">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" /> {imprint.install_count || 0}
        </span>
        {imprint.rating_avg > 0 && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {imprint.rating_avg}
          </span>
        )}
        <span className="ml-auto capitalize">{imprint.category}</span>
      </div>
    </button>
  );
}

// ── Imprint Detail View ─────────────────────────────────────────────────────
function ImprintDetail({ imprint, isInstalled, installedUsageType, onBack, onInstall, onUninstall, projects, token }) {
  const [installType, setInstallType] = useState('default');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [rating, setRating] = useState(0);

  async function handleInstall() {
    setInstalling(true);
    try {
      const body = { imprint_id: imprint.id, usage_type: installType };
      if (installType === 'project' && selectedProjectId) {
        body.project_id = selectedProjectId;
      }
      const res = await fetch('/api/imprints/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onInstall();
      }
    } catch (e) {
      console.error('Install failed:', e);
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall() {
    setUninstalling(true);
    try {
      const res = await fetch('/api/imprints/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usage_type: installedUsageType || 'default' }),
      });
      if (res.ok) {
        onInstall(); // refresh
      }
    } catch (e) {
      console.error('Uninstall failed:', e);
    } finally {
      setUninstalling(false);
    }
  }

  async function handleRate(stars) {
    setRating(stars);
    try {
      await fetch('/api/imprints/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imprint_id: imprint.id, rating: stars }),
      });
    } catch (e) {
      console.error('Rate failed:', e);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: (imprint.color || '#6366F1') + '20' }}
        >
          {imprint.icon || '✨'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg text-foreground">{imprint.name}</h2>
          <p className="text-xs text-muted-foreground">{imprint.short_description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5">
        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">About</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{imprint.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {(imprint.tags || []).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Sample Conversation */}
        {imprint.sample_conversation?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Preview Conversation</h3>
            <div className="space-y-2 bg-muted/50 rounded-lg p-3">
              {imprint.sample_conversation.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? '' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : imprint.icon || '✨'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5 uppercase">
                      {msg.role === 'user' ? 'You' : imprint.name}
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {msg.content.substring(0, 400)}{msg.content.length > 400 ? '...' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Rate this Imprint</h3>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" /> {imprint.install_count || 0} installs</span>
          {imprint.rating_avg > 0 && (
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {imprint.rating_avg} ({imprint.rating_count} ratings)</span>
          )}
          <span className="capitalize">Category: {imprint.category}</span>
        </div>
      </div>

      {/* Install / Uninstall Footer */}
      <div className="pt-4 border-t border-border/50 space-y-3">
        {isInstalled ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <Check className="w-3 h-3 mr-1" /> Active as {installedUsageType || 'default'}
            </Badge>
            <Button variant="destructive" size="sm" onClick={handleUninstall} disabled={uninstalling}>
              {uninstalling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
              Remove
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground">Use as:</span>
              <Button
                variant={installType === 'default' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInstallType('default')}
                className="text-xs h-7"
              >
                Default Persona
              </Button>
              <Button
                variant={installType === 'project' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInstallType('project')}
                className="text-xs h-7"
              >
                Project Only
              </Button>
            </div>
            {installType === 'project' && (
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-md p-2"
              >
                <option value="">Select a project...</option>
                {(projects || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <Button
              onClick={handleInstall}
              disabled={installing || (installType === 'project' && !selectedProjectId)}
              className="w-full"
            >
              {installing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Activate Imprint
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── AI Imprint Generator Wizard ─────────────────────────────────────────────
function ImprintGenerator({ token, onComplete, onBack, projects }) {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [installType, setInstallType] = useState('default');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [installing, setInstalling] = useState(false);

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/imprints/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: description.trim(), name: name.trim() || undefined, category: category || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        setStep(3);
      } else {
        setError(data.error || 'Generation failed — please try again');
      }
    } catch (e) {
      setError('Connection error — please try again');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20">
          <Wand2 className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">Imprint Generator</h2>
          <p className="text-xs text-muted-foreground">Create a custom AI persona with GPT-4o</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {/* Step 1: Description */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Describe your ideal AI persona
              </label>
              <Textarea
                placeholder="Example: A sarcastic but brilliant detective who analyzes problems like crime scenes. Uses noir-style language and always finds the hidden clue everyone else missed..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Be specific about personality, expertise, communication style, and quirks. The more detail, the better.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name (optional)</label>
                <Input
                  placeholder="e.g., Detective Noir"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded-md p-2 h-9"
                >
                  <option value="">Auto-detect</option>
                  <option value="professional">Professional</option>
                  <option value="creative">Creative</option>
                  <option value="education">Education</option>
                  <option value="personality">Personality</option>
                  <option value="lifestyle">Lifestyle</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
            )}

            <Button
              onClick={() => { setStep(2); handleGenerate(); }}
              disabled={!description.trim() || generating}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
            >
              <Wand2 className="w-4 h-4 mr-2" /> Generate with AI
            </Button>
          </div>
        )}

        {/* Step 2: Generating */}
        {step === 2 && generating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <Loader2 className="w-20 h-20 text-violet-400/40 animate-spin absolute -top-2 -left-2" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Crafting your imprint...</p>
              <p className="text-xs text-muted-foreground mt-1">GPT-4o is building a unique persona just for you</p>
            </div>
          </div>
        )}

        {/* Step 2 error state */}
        {step === 2 && !generating && error && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
            <Button variant="outline" onClick={() => { setStep(1); setError(''); }}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {/* Step 3: Result — Choose how to activate */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-400">Imprint Created!</p>
                <p className="text-xs text-muted-foreground mt-0.5">{result.message}</p>
              </div>
            </div>

            {result.imprint && (
              <div className="border border-border/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
                    style={{ backgroundColor: (result.imprint.color || '#6366F1') + '20' }}
                  >
                    {result.imprint.icon || '✨'}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{result.imprint.name}</h3>
                    <p className="text-xs text-muted-foreground">{result.imprint.short_description}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{result.imprint.description}</p>
                <div className="flex flex-wrap gap-1">
                  {(result.imprint.tags || []).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>

                {/* Sample conversation preview */}
                {result.imprint.sample_conversation?.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Preview</p>
                    {result.imprint.sample_conversation.map((msg, i) => (
                      <div key={i} className="flex gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${msg.role === 'user' ? 'bg-primary/20' : 'bg-emerald-500/20'}`}>
                          {msg.role === 'user' ? <User className="w-2.5 h-2.5" /> : result.imprint.icon || '✨'}
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          {msg.content.substring(0, 200)}{msg.content.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Default / Project toggle for custom imprint */}
            <div className="border border-border/60 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">How would you like to use this imprint?</p>
              <div className="flex gap-2 items-center">
                <Button
                  variant={installType === 'default' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInstallType('default')}
                  className="text-xs h-7"
                >
                  Default Persona
                </Button>
                <Button
                  variant={installType === 'project' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInstallType('project')}
                  className="text-xs h-7"
                >
                  Project Only
                </Button>
              </div>
              {installType === 'project' && (
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-md p-2"
                >
                  <option value="">Select a project...</option>
                  {(projects || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <Button
              onClick={async () => {
                if (!result.imprint) return;
                setInstalling(true);
                try {
                  const body = { imprint_id: result.imprint.id, usage_type: installType };
                  if (installType === 'project' && selectedProjectId) body.project_id = selectedProjectId;
                  const res = await fetch('/api/imprints/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body),
                  });
                  if (res.ok) onComplete();
                } catch (e) {
                  console.error('Install failed:', e);
                } finally {
                  setInstalling(false);
                }
              }}
              disabled={installing || (installType === 'project' && !selectedProjectId)}
              className="w-full"
            >
              {installing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Activate as {installType === 'default' ? 'Default Persona' : 'Project Persona'}
            </Button>
            <button
              onClick={onComplete}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              Skip — don't activate now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active Imprint Indicator (for sidebar/header) ───────────────────────────
export function ActiveImprintBadge({ token, onClick }) {
  const [activeImprint, setActiveImprint] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/imprints/my', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.default_imprint?.imprint) {
          setActiveImprint(data.default_imprint.imprint);
        }
      })
      .catch(() => {});
  }, [token]);

  if (!activeImprint) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Open Imprints Marketplace"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Imprints</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/50 transition-all group"
      title={`Active: ${activeImprint.name}`}
    >
      <span className="text-base leading-none">{activeImprint.icon || '✨'}</span>
      <span className="text-foreground font-medium truncate max-w-[100px] group-hover:text-primary transition-colors">
        {activeImprint.name}
      </span>
    </button>
  );
}

// ── Main Marketplace Modal ──────────────────────────────────────────────────
export default function ImprintsMarketplace({ open, onClose, token, projects }) {
  const [view, setView] = useState('library'); // library | myimprints | detail | generator
  const [imprints, setImprints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImprint, setSelectedImprint] = useState(null);
  const [myImprints, setMyImprints] = useState({ default_imprint: null, project_imprints: [], created_imprints: [] });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popular');
  const [activeTab, setActiveTab] = useState('browse'); // browse | mine

  const fetchImprints = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);

      const [imprintsRes, myRes] = await Promise.all([
        fetch(`/api/imprints?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/imprints/my', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (imprintsRes.ok) {
        const data = await imprintsRes.json();
        setImprints(data.imprints || []);
        setCategories(data.categories || []);
      }
      if (myRes.ok) {
        const myData = await myRes.json();
        setMyImprints(myData);
      }
    } catch (e) {
      console.error('Fetch imprints error:', e);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    if (open) {
      fetchImprints();
      setView('library');
      setSelectedImprint(null);
    }
  }, [open, fetchImprints]);

  // Check if an imprint is installed
  function isImprintInstalled(imprintId) {
    if (myImprints.default_imprint?.imprint_id === imprintId) return true;
    return myImprints.project_imprints?.some(p => p.imprint_id === imprintId);
  }

  function getInstalledUsageType(imprintId) {
    if (myImprints.default_imprint?.imprint_id === imprintId) return 'default';
    const proj = myImprints.project_imprints?.find(p => p.imprint_id === imprintId);
    return proj ? 'project' : null;
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        {view === 'library' && (
          <>
            {/* Top Header */}
            <div className="px-5 pt-5 pb-3 border-b border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold">Imprints Marketplace</DialogTitle>
                    <p className="text-[10px] text-muted-foreground">Browse AI personas or create your own</p>
                  </div>
                </div>
                <Button
                  onClick={() => setView('generator')}
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-xs h-8"
                >
                  <Wand2 className="w-3 h-3 mr-1.5" /> Create Custom
                </Button>
              </div>

              {/* Browse / My Imprints toggle */}
              <div className="flex gap-1 mb-3 bg-muted/40 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('browse')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                    activeTab === 'browse' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Browse All
                </button>
                <button
                  onClick={() => setActiveTab('mine')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'mine' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  My Imprints
                  {(myImprints.created_imprints?.length > 0) && (
                    <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 rounded-full">
                      {myImprints.created_imprints.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Search + Category Tabs (only for browse tab) */}
              {activeTab === 'browse' && (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search imprints..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span>{cat.icon}</span> {cat.name}
                        <span className="opacity-60">({cat.count})</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sort bar — Browse tab only */}
            {activeTab === 'browse' && (
              <div className="px-5 py-2 flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground">Sort:</span>
                {[
                  { id: 'popular', label: 'Popular' },
                  { id: 'newest', label: 'Newest' },
                  { id: 'name', label: 'A-Z' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id)}
                    className={`px-2 py-0.5 rounded-full transition-colors ${
                      sortBy === s.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="ml-auto text-muted-foreground">{imprints.length} imprints</span>
              </div>
            )}

            {/* Browse Grid */}
            {activeTab === 'browse' && (
              <div className="flex-1 overflow-y-auto px-5 pb-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                ) : imprints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No imprints found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Try a different search or category</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {imprints.map(imp => (
                      <ImprintCard
                        key={imp.id || imp.slug}
                        imprint={imp}
                        isInstalled={isImprintInstalled(imp.id)}
                        onSelect={imp => { setSelectedImprint(imp); setView('detail'); }}
                        onInstall={() => fetchImprints()}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Imprints Tab Content */}
            {activeTab === 'mine' && (
              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3 space-y-4">
                {/* Currently Active Section */}
                {(myImprints.default_imprint || myImprints.project_imprints?.length > 0) && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Currently Active</h3>
                    <div className="space-y-2">
                      {myImprints.default_imprint?.imprint && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                            style={{ backgroundColor: (myImprints.default_imprint.imprint.color || '#6366F1') + '20' }}
                          >
                            {myImprints.default_imprint.imprint.icon || '✨'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {myImprints.default_imprint.imprint.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Default Persona</p>
                          </div>
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shrink-0">
                            <Check className="w-2.5 h-2.5 mr-0.5" /> Default
                          </Badge>
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/imprints/uninstall', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ usage_type: 'default' }),
                                });
                                fetchImprints();
                              } catch (e) { console.error(e); }
                            }}
                            className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                            title="Remove and revert to standard AI"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {myImprints.project_imprints?.map(pi => pi.imprint && (
                        <div key={pi.id} className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                            style={{ backgroundColor: (pi.imprint.color || '#6366F1') + '20' }}
                          >
                            {pi.imprint.icon || '✨'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{pi.imprint.name}</p>
                            <p className="text-[10px] text-muted-foreground">Project: {pi.project_id?.substring(0, 8)}...</p>
                          </div>
                          <Badge variant="secondary" className="text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/30 shrink-0">
                            Project
                          </Badge>
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/imprints/uninstall', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ usage_type: 'project', project_id: pi.project_id }),
                                });
                                fetchImprints();
                              } catch (e) { console.error(e); }
                            }}
                            className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Created Imprints */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Your Custom Imprints
                  </h3>
                  {(!myImprints.created_imprints || myImprints.created_imprints.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/60 rounded-xl">
                      <Wand2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No custom imprints yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Use the generator to create your first persona</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setView('generator')}
                        className="mt-3 text-xs"
                      >
                        <Wand2 className="w-3 h-3 mr-1.5" /> Create Custom
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myImprints.created_imprints.map(imp => (
                        <div key={imp.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-all group">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg cursor-pointer"
                            style={{ backgroundColor: (imp.color || '#6366F1') + '20' }}
                            onClick={() => { setSelectedImprint(imp); setView('detail'); }}
                          >
                            {imp.icon || '✨'}
                          </div>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => { setSelectedImprint(imp); setView('detail'); }}
                          >
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {imp.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{imp.short_description}</p>
                          </div>
                          {imp.is_currently_active ? (
                            <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shrink-0">
                              <Check className="w-2.5 h-2.5 mr-0.5" /> {imp.active_as}
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7 shrink-0"
                              onClick={async () => {
                                try {
                                  await fetch('/api/imprints/install', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ imprint_id: imp.id, usage_type: 'default' }),
                                  });
                                  fetchImprints();
                                } catch (e) { console.error(e); }
                              }}
                            >
                              <Zap className="w-2.5 h-2.5 mr-1" /> Activate
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active Imprint Footer */}
            {myImprints.default_imprint?.imprint && (
              <div className="px-5 py-2.5 border-t border-border/50 bg-muted/30 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-muted-foreground">Active:</span>
                <span className="text-xs font-medium text-foreground flex items-center gap-1">
                  {myImprints.default_imprint.imprint.icon} {myImprints.default_imprint.imprint.name}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/imprints/uninstall', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ usage_type: 'default' }),
                      });
                      fetchImprints();
                    } catch (e) { console.error('Remove failed:', e); }
                  }}
                  className="ml-auto text-[10px] text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                  title="Remove default imprint and return to standard AI personality"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            )}
          </>
        )}

        {view === 'detail' && selectedImprint && (
          <div className="p-5 flex-1 overflow-hidden">
            <ImprintDetail
              imprint={selectedImprint}
              isInstalled={isImprintInstalled(selectedImprint.id)}
              installedUsageType={getInstalledUsageType(selectedImprint.id)}
              onBack={() => { setView('library'); setSelectedImprint(null); }}
              onInstall={() => { fetchImprints(); }}
              onUninstall={() => { fetchImprints(); }}
              projects={projects}
              token={token}
            />
          </div>
        )}

        {view === 'generator' && (
          <div className="p-5 flex-1 overflow-hidden">
            <ImprintGenerator
              token={token}
              projects={projects}
              onComplete={() => { fetchImprints(); setView('library'); }}
              onBack={() => setView('library')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
