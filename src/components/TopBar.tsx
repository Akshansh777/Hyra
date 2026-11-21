import { motion } from 'framer-motion';
import { AudioLines, Briefcase, Mic, ShieldAlert, Volume2 } from 'lucide-react';
import type { LanguageMode, RoleTab, StorageMeta, VoiceEngine, VoiceState } from '../types/hyra';

interface TopBarProps {
  activeTab: RoleTab;
  onTabChange: (tab: RoleTab) => void;
  languageMode: LanguageMode;
  onLanguageChange: (mode: LanguageMode) => void;
  voiceEngine: VoiceEngine;
  onVoiceEngineChange: (engine: VoiceEngine) => void;
  voiceState: VoiceState;
  storageMeta: StorageMeta;
  p0Count: number;
  pendingRequestCount: number;
}

const TABS: { id: RoleTab; label: string; icon: typeof Mic }[] = [
  { id: 'employee', label: 'Employee Desk', icon: Mic },
  { id: 'ops', label: 'Ops Dashboard', icon: ShieldAlert },
  { id: 'interview', label: 'Interview Lab', icon: AudioLines },
];

export function TopBar({
  activeTab,
  onTabChange,
  languageMode,
  onLanguageChange,
  voiceEngine,
  onVoiceEngineChange,
  voiceState,
  storageMeta,
  p0Count,
  pendingRequestCount,
}: TopBarProps) {
  const statusLabel =
    voiceState === 'listening'
      ? 'Listening'
      : voiceState === 'speaking'
      ? 'Speaking · Barge-In Ready'
      : voiceState === 'thinking'
      ? 'Processing'
      : storageMeta.mode === 'firestore'
      ? 'Firestore Live'
      : 'Local Live';

  const statusTone =
    voiceState === 'listening'
      ? 'text-[#00F0FF] border-[#00F0FF]/35 bg-[#00F0FF]/10'
      : voiceState === 'speaking'
      ? 'text-indigo-300 border-indigo-400/35 bg-indigo-500/15'
      : storageMeta.mode === 'firestore'
      ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
      : 'text-slate-300 border-white/10 bg-white/[0.04]';

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-white/[0.08] bg-[#070B14]/88 backdrop-blur-xl">
      <div className="max-w-[1520px] mx-auto h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Brand + Live Status Pill */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00F0FF]/25 via-[#6366F1]/25 to-transparent border border-[#00F0FF]/40 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#00F0FF]" />
            </div>
            <span className="font-mono text-sm font-semibold tracking-wider text-white whitespace-nowrap shrink-0">
              HYRA <span className="text-[#00F0FF]">//</span> OS
            </span>
          </div>

          <div
            className={`hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono whitespace-nowrap shrink-0 transition-colors ${statusTone}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                voiceState === 'listening'
                  ? 'bg-[#00F0FF]'
                  : voiceState === 'speaking'
                  ? 'bg-indigo-400'
                  : storageMeta.mode === 'firestore'
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400/70'
              }`}
            />
            <span>{statusLabel}</span>
          </div>
        </div>

        {/* 3-Tab Role Switcher */}
        <nav
          aria-label="Workspace roles"
          className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/[0.08] shrink-0"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const alertCount = tab.id === 'ops' ? p0Count + pendingRequestCount : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="hyra-active-tab"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-white/[0.09] border border-white/[0.12]"
                  />
                )}
                <Icon className={`relative z-10 w-3.5 h-3.5 ${isActive ? 'text-[#00F0FF]' : ''}`} />
                <span className="relative z-10">{tab.label}</span>
                {alertCount > 0 && (
                  <span
                    className={`relative z-10 font-mono text-[10px] tabular-nums ${
                      p0Count > 0 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Language & Voice Engine Toggles */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {/* Hinglish Mode Toggle */}
          <div
            role="group"
            aria-label="Language mode"
            className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-white/[0.08]"
          >
            {(['EN', 'HINGLISH'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onLanguageChange(mode)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  languageMode === mode
                    ? 'bg-[#00F0FF]/18 text-[#00F0FF] border border-[#00F0FF]/35'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {mode === 'EN' ? 'EN' : 'Hinglish'}
              </button>
            ))}
          </div>

          {/* Voice Engine Toggle */}
          <div
            role="group"
            aria-label="Voice engine"
            className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-white/[0.08]"
          >
            <button
              type="button"
              onClick={() => onVoiceEngineChange('elevenlabs')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                voiceEngine === 'elevenlabs'
                  ? 'bg-[#6366F1]/25 text-indigo-200 border border-[#6366F1]/45'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Uses ElevenLabs TTS when VITE_ELEVENLABS_API_KEY is configured, otherwise falls back automatically"
            >
              <Volume2 className="w-3 h-3" />
              <span>ElevenLabs</span>
            </button>
            <button
              type="button"
              onClick={() => onVoiceEngineChange('browser')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                voiceEngine === 'browser'
                  ? 'bg-white/[0.11] text-white border border-white/[0.15]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Browser
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
