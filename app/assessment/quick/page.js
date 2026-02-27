'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Sparkles, RefreshCw } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function QuickAssessmentPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState('layer1'); // 'layer1', 'layer2', 'naming', 'complete'
  const [assistantName, setAssistantName] = useState('');
  const [sliderValue, setSliderValue] = useState(50);

  // Load questions
  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }
    
    fetch('/api/assessment/layered/questions', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setQuestions(data.layer1 || []);
        setFollowUps(data.layer2 || []);
        if (data.progress?.answered) {
          // Restore answers if any
          const restored = {};
          data.progress.answered.forEach(id => {
            restored[id] = localStorage.getItem(`layered_answer_${id}`) || '';
          });
          setAnswers(restored);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  // Get current question
  const allQuestions = phase === 'layer1' ? questions : followUps;
  const currentQuestion = allQuestions[currentIndex];
  const totalQuestions = questions.length + followUps.length;
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / totalQuestions) * 100);

  // Submit answer
  const submitAnswer = useCallback(async (questionId, answer) => {
    const token = localStorage.getItem('sp_token');
    if (!token) return;
    
    // Save locally for restoration
    localStorage.setItem(`layered_answer_${questionId}`, answer);
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    try {
      const res = await fetch('/api/assessment/layered/answer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          question_id: questionId, 
          answer,
          layer: phase === 'layer1' ? 1 : 2
        })
      });
      const data = await res.json();
      
      // If Layer 1 is complete and we have follow-ups, switch to Layer 2
      if (data.layer1_complete && data.follow_up_questions?.length > 0 && phase === 'layer1') {
        setFollowUps(data.follow_up_questions);
      }
      
      return data;
    } catch (e) {
      console.error('Failed to submit answer:', e);
    }
  }, [phase]);

  // Handle option selection
  const handleSelect = async (value) => {
    if (!currentQuestion) return;
    
    await submitAnswer(currentQuestion.id, value);
    
    // Move to next question
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (phase === 'layer1') {
      // Check if we have follow-ups
      if (followUps.length > 0) {
        setPhase('layer2');
        setCurrentIndex(0);
      } else {
        setPhase('naming');
      }
    } else {
      // Finished Layer 2
      setPhase('naming');
    }
  };

  // Handle text input
  const handleTextSubmit = async () => {
    if (!currentQuestion || !answers[currentQuestion.id]) return;
    await submitAnswer(currentQuestion.id, answers[currentQuestion.id]);
    
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (phase === 'layer1') {
      if (followUps.length > 0) {
        setPhase('layer2');
        setCurrentIndex(0);
      } else {
        setPhase('naming');
      }
    } else {
      setPhase('naming');
    }
  };

  // Handle slider change
  const handleSliderSubmit = async () => {
    if (!currentQuestion) return;
    await submitAnswer(currentQuestion.id, sliderValue);
    
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (phase === 'layer1') {
      if (followUps.length > 0) {
        setPhase('layer2');
        setCurrentIndex(0);
      } else {
        setPhase('naming');
      }
    } else {
      setPhase('naming');
    }
  };

  // Complete assessment
  const handleComplete = async () => {
    setSubmitting(true);
    const token = localStorage.getItem('sp_token');
    
    try {
      const res = await fetch('/api/assessment/layered/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ assistant_name: assistantName || 'SoulPrint' })
      });
      const data = await res.json();
      
      if (data.success) {
        setPhase('complete');
        // Clear local storage
        Object.keys(answers).forEach(id => {
          localStorage.removeItem(`layered_answer_${id}`);
        });
        
        // Redirect to chat after showing summary
        setTimeout(() => router.push('/chat'), 3000);
      }
    } catch (e) {
      console.error('Failed to complete assessment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // Go back
  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (phase === 'layer2') {
      setPhase('layer1');
      setCurrentIndex(questions.length - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Complete phase - show summary
  if (phase === 'complete') {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center py-8 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">You're All Set!</h1>
          <p className="text-gray-400 mb-6">
            Based on what you've shared, here's how I'll communicate with you:
          </p>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 text-left text-sm text-gray-300 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Adapted to your communication preferences</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>I'll learn more as we chat</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>You can adjust settings anytime</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-6">Redirecting to chat...</p>
        </div>
      </div>
    );
  }

  // Naming phase
  if (phase === 'naming') {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center py-8 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />
        
        <div className="relative z-10 w-full max-w-md flex-1 flex flex-col">
          <button onClick={() => setPhase(followUps.length > 0 ? 'layer2' : 'layer1')} className="text-gray-500 text-sm hover:text-gray-300 transition-colors mb-8 flex items-center gap-1">
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Almost Done!</h1>
              <p className="text-gray-400 text-sm text-center">What would you like to call me?</p>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                value={assistantName}
                onChange={e => setAssistantName(e.target.value)}
                placeholder="SoulPrint"
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-4 text-white text-center text-lg placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Random Name Generator */}
            <button
              type="button"
              onClick={() => {
                const names = ['Atlas', 'Nova', 'Echo', 'Sage', 'Onyx', 'Luna', 'Phoenix', 'Aria', 'Kai', 'Orion', 'Zephyr', 'Ember', 'Pixel', 'Cosmo', 'Astra', 'Maven', 'Prism', 'Zenith', 'Cipher', 'Nimbus'];
                setAssistantName(names[Math.floor(Math.random() * names.length)]);
              }}
              className="text-orange-500 hover:text-orange-400 text-sm mb-4 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Suggest a random name
            </button>

            {/* Reassuring message */}
            <p className="text-gray-600 text-xs text-center mb-6">
              Don't worry, you can always change my name later in settings.
            </p>

            <button
              onClick={handleComplete}
              disabled={submitting}
              className="btn-orange w-full py-4 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {submitting ? 'Setting up...' : 'Start Chatting →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Question phase
  return (
    <div className="min-h-screen grid-bg flex flex-col items-center py-8 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={goBack}
            disabled={currentIndex === 0 && phase === 'layer1'}
            className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <span className="text-xs text-gray-500">
              {phase === 'layer1' ? 'Getting to know you' : 'Quick follow-ups'}
            </span>
          </div>
          <div className="w-6" />
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{answeredCount}/{totalQuestions}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        {currentQuestion && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <p className="text-xs text-orange-500 uppercase tracking-wider mb-3">
                {currentQuestion.category?.replace('_', ' ') || 'Question'}
              </p>
              <h2 className="text-xl text-white font-medium leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Options */}
            {currentQuestion.type === 'text' ? (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                  placeholder={currentQuestion.placeholder || 'Share your thoughts...'}
                  className="flex-1 min-h-[150px] bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!answers[currentQuestion.id]?.trim()}
                  className="btn-orange w-full py-3 rounded-xl text-sm mt-4 disabled:opacity-50"
                >
                  Continue <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            ) : currentQuestion.type === 'slider' ? (
              <div className="flex-1 flex flex-col justify-center">
                <div className="space-y-6">
                  <input
                    type="range"
                    min={currentQuestion.min || 0}
                    max={currentQuestion.max || 100}
                    value={sliderValue}
                    onChange={e => setSliderValue(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{currentQuestion.minLabel}</span>
                    <span>{currentQuestion.maxLabel}</span>
                  </div>
                </div>
                <button
                  onClick={handleSliderSubmit}
                  className="btn-orange w-full py-3 rounded-xl text-sm mt-8"
                >
                  Continue <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentQuestion.options?.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-4 py-4 rounded-xl border transition-all duration-200 ${
                      answers[currentQuestion.id] === opt.value
                        ? 'bg-orange-500/20 border-orange-500 text-white'
                        : 'bg-[#1a1a1a] border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
