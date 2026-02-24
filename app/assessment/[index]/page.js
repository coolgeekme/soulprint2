'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Mic, X, ChevronLeft } from 'lucide-react';

const PILLAR_LABELS = {
  communication: 'COMMUNICATION',
  emotional_intelligence: 'EMOTIONAL INTEL.',
  decision_making: 'DECISION MAKING',
  social_dynamics: 'SOCIAL DYNAMICS',
  cognitive_style: 'COGNITIVE STYLE',
  assertiveness: 'ASSERTIVENESS',
};

export default function AssessmentQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const index = parseInt(params.index) || 1;

  const [questions, setQuestions] = useState([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingAnswers, setExistingAnswers] = useState({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('sp_token') : '';

  const loadData = useCallback(async () => {
    if (!token) { router.push('/auth'); return; }
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        fetch('/api/assessment/questions'),
        fetch('/api/assessment/progress', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const qs = await qRes.json();
      const prog = await pRes.json();
      setQuestions(qs);

      // Load existing answers
      const answeredMap = {};
      if (prog.answered && prog.answered.length > 0) {
        // Store which question IDs have been answered
        prog.answered.forEach(id => { answeredMap[id] = true; });
      }
      setExistingAnswers(answeredMap);

      // Get current question's existing answer if any
      const currentQ = qs[index - 1];
      if (currentQ && answeredMap[currentQ.id]) {
        // We don't store the text here, just mark as answered
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [index, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentQuestion = questions[index - 1];
  const total = 36;
  const pillar = currentQuestion?.pillar || 'communication';

  async function saveAndNavigate(next) {
    if (!currentQuestion) return;
    setSaving(true);
    try {
      await fetch('/api/assessment/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer_text: answer,
        }),
      });
    } catch (e) { console.error(e); }
    setSaving(false);
    setAnswer('');
    if (next <= total) {
      router.push(`/assessment/${next}`);
    } else {
      router.push('/assessment/final');
    }
  }

  async function handleSkip() {
    if (!currentQuestion) return;
    setSaving(true);
    try {
      await fetch('/api/assessment/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question_id: currentQuestion.id, answer_text: '[skipped]' }),
      });
    } catch (e) { console.error(e); }
    setSaving(false);
    setAnswer('');
    const next = index + 1;
    if (next <= total) {
      router.push(`/assessment/${next}`);
    } else {
      router.push('/assessment/final');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading question...</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Question not found</p>
          <button onClick={() => router.push('/assessment')} className="btn-orange px-6 py-3 rounded-lg text-sm">Back to Assessment</button>
        </div>
      </div>
    );
  }

  const progress = (index / total) * 100;

  return (
    <div className="min-h-screen grid-bg flex flex-col px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.1)_0%,transparent_70%)]" />

      {/* Top bar */}
      <div className="relative z-10 max-w-xl mx-auto w-full pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => index > 1 ? router.push(`/assessment/${index - 1}`) : router.push('/assessment')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="px-3 py-1 rounded border border-orange-500/40 bg-orange-500/10">
            <span className="text-orange-400 text-[10px] font-bold tracking-widest uppercase">PILLAR: {PILLAR_LABELS[pillar]}</span>
          </div>
          <button onClick={() => router.push('/assessment')} className="text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-orange-500 text-sm font-bold">
            <span className="text-2xl">{String(index).padStart(2, '0')}</span>
            <span className="text-gray-600">/{String(total).padStart(2, '0')}</span>
          </span>
          <span className="text-[10px] text-gray-600 tracking-widest font-bold uppercase">ASSESSMENT</span>
        </div>
        <div className="w-full h-0.5 bg-white/5 rounded-full mb-12">
          <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-8">
          {currentQuestion.question_text}
        </h2>

        {/* Answer area */}
        <div className="relative mb-2">
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="I usually prefer to..."
            rows={6}
            className="w-full bg-[#111] border border-orange-500/30 text-white placeholder-gray-700 text-sm p-4 rounded-xl resize-none focus:border-orange-500/60 transition-colors"
            autoFocus
          />
          <button className="absolute bottom-4 right-4 text-orange-500/60 hover:text-orange-500 transition-colors">
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-orange-500/50 flex items-center gap-1.5 mb-12">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500/50 inline-block" />
          Analysis in progress. SoulPrint adapts tone to your communication matrix.
        </p>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 mt-auto pb-8 max-w-xl mx-auto w-full">
        <div className="flex justify-center mb-4">
          <button onClick={handleSkip} disabled={saving}
            className="px-6 py-2 text-sm text-gray-500 border border-white/10 rounded-lg hover:border-white/20 hover:text-gray-300 transition-all disabled:opacity-50">
            Skip
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => index > 1 ? router.push(`/assessment/${index - 1}`) : router.push('/assessment')}
            className="flex-1 py-4 bg-[#1a1a1a] border border-white/10 text-white font-condensed font-bold text-sm tracking-widest rounded-xl hover:border-white/20 transition-all uppercase"
          >
            BACK
          </button>
          <button
            onClick={() => saveAndNavigate(index + 1)}
            disabled={saving}
            className="flex-[2] btn-orange py-4 rounded-xl text-sm disabled:opacity-50"
          >
            {saving ? 'SAVING...' : 'CONTINUE →'}
          </button>
        </div>
      </div>
    </div>
  );
}
