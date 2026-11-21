import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Lightbulb,
  RotateCcw,
  Send,
  Volume2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { INTERVIEW_TRACKS } from '../data/corporateSeed';
import { exportInterviewReportPdf } from '../services/pdfExport';
import type { InterviewTurn, VoiceState } from '../types/hyra';
import { VoiceOrb } from './VoiceOrb';

interface InterviewLabProps {
  voiceState: VoiceState;
  audioLevel: number;
  interimTranscript: string;
  bargeInNotice: string | null;
  micError: string | null;
  selectedTrackId: string;
  currentQuestion: string;
  turns: InterviewTurn[];
  evaluating: boolean;
  onSelectTrack: (trackId: string) => void;
  onSelectQuestion: (question: string) => void;
  onSpeakQuestion: (question: string) => void;
  onToggleOrb: () => void;
  onSubmitAnswer: (transcript: string, durationSec: number) => Promise<void>;
  onResetSession: () => void;
}

const FILLER_REGEX = /\b(um+|uh+|like|basically|actually|literally|you know|sort of|kind of)\b/gi;

export function countFillerWords(text: string): number {
  const matches = text.match(FILLER_REGEX);
  return matches ? matches.length : 0;
}

export function InterviewLab({
  voiceState,
  audioLevel,
  interimTranscript,
  bargeInNotice,
  micError,
  selectedTrackId,
  currentQuestion,
  turns,
  evaluating,
  onSelectTrack,
  onSelectQuestion,
  onSpeakQuestion,
  onToggleOrb,
  onSubmitAnswer,
  onResetSession,
}: InterviewLabProps) {
  const [typedAnswer, setTypedAnswer] = useState('');

  const activeTrack =
    INTERVIEW_TRACKS.find((t) => t.id === selectedTrackId) || INTERVIEW_TRACKS[0];

  const liveWordCount = useMemo(() => {
    const src = (interimTranscript || typedAnswer).trim();
    if (!src) return 0;
    return src.split(/\s+/).length;
  }, [interimTranscript, typedAnswer]);

  const liveFillers = useMemo(
    () => countFillerWords(interimTranscript || typedAnswer),
    [interimTranscript, typedAnswer]
  );

  const avgScores = useMemo(() => {
    if (turns.length === 0) {
      return { clarity: 0, depth: 0, structure: 0, confidence: 0, wpm: 0, fillers: 0 };
    }
    const sum = turns.reduce(
      (acc, t) => ({
        clarity: acc.clarity + t.clarityScore,
        depth: acc.depth + t.technicalDepth,
        structure: acc.structure + t.structureScore,
        confidence: acc.confidence + t.confidenceScore,
        wpm: acc.wpm + t.wpm,
        fillers: acc.fillers + t.fillerCount,
      }),
      { clarity: 0, depth: 0, structure: 0, confidence: 0, wpm: 0, fillers: 0 }
    );
    const n = turns.length;
    return {
      clarity: Math.round(sum.clarity / n),
      depth: Math.round(sum.depth / n),
      structure: Math.round(sum.structure / n),
      confidence: Math.round(sum.confidence / n),
      wpm: Math.round(sum.wpm / n),
      fillers: sum.fillers,
    };
  }, [turns]);

  const radarData = useMemo(
    () => [
      { axis: 'Clarity', score: avgScores.clarity },
      { axis: 'Tech Depth', score: avgScores.depth },
      { axis: 'Structure', score: avgScores.structure },
      { axis: 'Confidence', score: avgScores.confidence },
    ],
    [avgScores]
  );

  const trendData = useMemo(
    () =>
      turns.map((t) => ({
        name: `Q${t.turnNumber}`,
        wpm: t.wpm,
        confidence: t.confidenceScore,
        clarity: t.clarityScore,
      })),
    [turns]
  );

  const latestTurn = turns[turns.length - 1] ?? null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = typedAnswer.trim();
    if (!cleaned || evaluating) return;
    setTypedAnswer('');
    const estDuration = Math.max(8, Math.round((cleaned.split(/\s+/).length / 135) * 60));
    await onSubmitAnswer(cleaned, estDuration);
  };

  return (
    <div className="max-w-[1520px] mx-auto px-4 lg:px-6 py-6 space-y-5">
      {/* Studio Header & Track Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Interview Lab & Voice Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Practice live voice interviews with real-time barge-in, pacing telemetry, and Gemini bar-raiser scoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/[0.08] overflow-x-auto">
            {INTERVIEW_TRACKS.map((track) => (
              <button
                key={track.id}
                type="button"
                onClick={() => onSelectTrack(track.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  track.id === selectedTrackId
                    ? 'bg-[#6366F1]/25 text-indigo-100 border border-[#6366F1]/45'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {track.role.replace('Senior ', '').replace('Staff ', '').replace('Principal ', '').replace('Lead ', '')}
              </button>
            ))}
          </div>

          {turns.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportInterviewReportPdf(activeTrack.role, turns)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3DF4FF] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={onResetSession}
                className="p-2 rounded-lg text-slate-400 hover:text-white bg-white/[0.05] border border-white/10"
                title="Reset session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Split Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT 5 COLS: Active Question + Voice Capture Stage */}
        <section className="lg:col-span-5 glass-panel rounded-2xl p-5 space-y-5">
          {/* Active Question Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400">
              <span className="text-[#00F0FF]">{activeTrack.role}</span>
              <button
                type="button"
                onClick={() => onSpeakQuestion(currentQuestion)}
                className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ask Aloud</span>
              </button>
            </div>
            <p className="text-base font-medium text-white leading-relaxed">{currentQuestion}</p>

            {/* Quick question switcher */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {activeTrack.questions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectQuestion(q)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                    currentQuestion === q
                      ? 'bg-white/[0.12] text-white'
                      : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Prompt {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-5 flex flex-col items-center">
            <VoiceOrb
              size="sm"
              state={evaluating ? 'thinking' : voiceState}
              audioLevel={audioLevel}
              onClick={onToggleOrb}
              labelOverride={
                evaluating
                  ? 'Scoring answer with Gemini…'
                  : voiceState === 'listening'
                  ? 'Recording Answer · Click or Space to Score'
                  : voiceState === 'speaking'
                  ? 'Interviewer Speaking · Click or Space to Barge-In'
                  : 'Click Orb or Press Space to Answer'
              }
            />

            <div className="mt-3 min-h-[22px] text-center">
              {bargeInNotice ? (
                <p className="text-xs font-mono text-[#00F0FF]">{bargeInNotice}</p>
              ) : micError ? (
                <p className="text-xs text-amber-300">{micError}</p>
              ) : interimTranscript ? (
                <p className="text-xs text-cyan-100/90 italic max-w-md">“{interimTranscript}”</p>
              ) : null}
            </div>
          </div>

          {/* Live Capture Telemetry */}
          <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-white/[0.07] text-center">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] py-2.5 px-2">
              <p className="text-[11px] text-slate-400">Draft Words</p>
              <p className="text-base font-mono font-semibold text-white tabular-nums mt-0.5">
                {liveWordCount}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] py-2.5 px-2">
              <p className="text-[11px] text-slate-400">Live Fillers</p>
              <p className="text-base font-mono font-semibold text-amber-300 tabular-nums mt-0.5">
                {liveFillers}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] py-2.5 px-2">
              <p className="text-[11px] text-slate-400">Avg Pace</p>
              <p className="text-base font-mono font-semibold text-[#00F0FF] tabular-nums mt-0.5">
                {avgScores.wpm > 0 ? `${avgScores.wpm}` : '—'} <span className="text-[10px] font-normal">wpm</span>
              </p>
            </div>
          </div>

          {/* Text Answer Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-2.5 pt-2 border-t border-white/[0.07]">
            <textarea
              rows={3}
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Or type / paste your interview response here to run full voice & structure analytics..."
              className="w-full bg-[#070B14] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]/60"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!typedAnswer.trim() || evaluating}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3DF4FF] disabled:opacity-45 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{evaluating ? 'Evaluating...' : 'Evaluate Answer'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* RIGHT 7 COLS: Recharts Analytics + Live Coaching Feed */}
        <section className="lg:col-span-7 space-y-5">
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Competency Radar</h2>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {turns.length} {turns.length === 1 ? 'turn' : 'turns'}
                </span>
              </div>
              <div className="h-56 w-full">
                {turns.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-6">
                    Complete your first spoken or typed response to populate the 4-axis competency chart.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.12)" />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: '#64748B', fontSize: 10 }}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#00F0FF"
                        fill="#00F0FF"
                        fillOpacity={0.22}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1222',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          fontSize: '12px',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Pace & Confidence Trend</h2>
                <span className="text-xs font-mono text-slate-400">WPM · Confidence</span>
              </div>
              <div className="h-56 w-full">
                {trendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-6">
                    Optimal speaking cadence is 125–155 WPM. Your turn-by-turn trend will appear here.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="hyraWpmGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="hyraConfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1222',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="wpm"
                        name="Pace (WPM)"
                        stroke="#6366F1"
                        fill="url(#hyraWpmGrad)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="confidence"
                        name="Confidence"
                        stroke="#00F0FF"
                        fill="url(#hyraConfGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Latest Bar-Raiser Coaching Feedback */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Live Coach Breakdown</h2>
              {latestTurn && (
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  Turn {latestTurn.turnNumber} · {latestTurn.wpm} WPM · {latestTurn.fillerCount} fillers
                </span>
              )}
            </div>

            {!latestTurn ? (
              <p className="text-sm text-slate-400 leading-relaxed">
                Click <span className="text-white font-medium">Ask Aloud</span> or answer the active prompt using your voice or keyboard. Hyra scores structure, technical depth, clarity, and delivery cadence, then adapts the next follow-up question.
              </p>
            ) : (
              <motion.div
                key={latestTurn.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-slate-200 leading-relaxed bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
                  {latestTurn.coachReply}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Observed Strengths</span>
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {latestTurn.strengths.map((s, idx) => (
                        <li key={idx} className="leading-relaxed">
                          · {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Targeted Improvements</span>
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {latestTurn.improvements.map((imp, idx) => (
                        <li key={idx} className="leading-relaxed">
                          · {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {latestTurn.followUpQuestion && (
                  <div className="pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-mono text-[#00F0FF]">Adaptive Follow-Up Ready</p>
                      <p className="text-xs text-slate-200">{latestTurn.followUpQuestion}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuestion(latestTurn.followUpQuestion);
                        onSpeakQuestion(latestTurn.followUpQuestion);
                      }}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#6366F1]/25 text-indigo-100 border border-[#6366F1]/45 hover:bg-[#6366F1]/35 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <span>Ask Follow-Up</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
