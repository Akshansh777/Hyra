import { motion } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react';
import type { VoiceState } from '../types/hyra';

interface VoiceOrbProps {
  state: VoiceState;
  audioLevel: number;
  onClick: () => void;
  size?: 'md' | 'sm';
  labelOverride?: string;
}

export function VoiceOrb({
  state,
  audioLevel,
  onClick,
  size = 'md',
  labelOverride,
}: VoiceOrbProps) {
  const isSmall = size === 'sm';
  const dimClass = isSmall ? 'w-32 h-32' : 'w-44 h-44';
  const coreClass = isSmall ? 'w-20 h-20' : 'w-28 h-28';

  const reactiveScale = 1 + Math.min(0.28, audioLevel * 0.38);

  const ringColor =
    state === 'listening'
      ? 'rgba(0, 240, 255, 0.75)'
      : state === 'speaking'
      ? 'rgba(99, 102, 241, 0.85)'
      : state === 'thinking'
      ? 'rgba(129, 140, 248, 0.65)'
      : 'rgba(0, 240, 255, 0.28)';

  const glowShadow =
    state === 'listening'
      ? '0 0 60px rgba(0, 240, 255, 0.34), inset 0 0 28px rgba(0, 240, 255, 0.28)'
      : state === 'speaking'
      ? '0 0 64px rgba(99, 102, 241, 0.42), inset 0 0 32px rgba(0, 240, 255, 0.28)'
      : state === 'thinking'
      ? '0 0 42px rgba(99, 102, 241, 0.28), inset 0 0 22px rgba(99, 102, 241, 0.22)'
      : '0 0 36px rgba(0, 240, 255, 0.14), inset 0 0 20px rgba(0, 240, 255, 0.12)';

  const primaryLabel =
    labelOverride ||
    (state === 'listening'
      ? 'Listening · Click or Space to send'
      : state === 'speaking'
      ? 'Hyra Speaking · Click or Space to Barge-In'
      : state === 'thinking'
      ? 'Analyzing & executing action…'
      : 'Click Orb or Press Space to Speak');

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <button
        type="button"
        onClick={onClick}
        aria-label={primaryLabel}
        className={`relative ${dimClass} rounded-full flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#070B14] group`}
      >
        {/* Outer reactive acoustic halo */}
        <motion.div
          animate={{
            scale: state === 'idle' ? [1, 1.04, 1] : reactiveScale * 1.12,
            opacity: state === 'idle' ? [0.22, 0.38, 0.22] : 0.45 + audioLevel * 0.4,
          }}
          transition={
            state === 'idle'
              ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }
              : { type: 'spring', stiffness: 280, damping: 22 }
          }
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `1px solid ${ringColor}`,
            background:
              state === 'speaking'
                ? 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(0,240,255,0.06) 55%, transparent 72%)'
                : 'radial-gradient(circle, rgba(0,240,255,0.16) 0%, rgba(99,102,241,0.05) 58%, transparent 74%)',
          }}
        />

        {/* Rotating segmented Jarvis HUD ring */}
        <motion.svg
          viewBox="0 0 200 200"
          className="absolute inset-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] pointer-events-none"
          animate={{
            rotate: state === 'thinking' ? 360 : state === 'listening' || state === 'speaking' ? 360 : 0,
          }}
          transition={
            state === 'idle'
              ? { duration: 0.4 }
              : {
                  duration: state === 'thinking' ? 2.4 : 11,
                  repeat: Infinity,
                  ease: 'linear',
                }
          }
        >
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke={state === 'speaking' ? '#6366F1' : '#00F0FF'}
            strokeOpacity={state === 'idle' ? '0.28' : '0.68'}
            strokeWidth="1.25"
            strokeDasharray="24 12 6 10"
          />
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={state === 'listening' ? '#00F0FF' : '#818CF8'}
            strokeOpacity={state === 'idle' ? '0.18' : '0.45'}
            strokeWidth="1"
            strokeDasharray="4 10"
          />
        </motion.svg>

        {/* Counter-rotating inner telemetry arc */}
        <motion.svg
          viewBox="0 0 200 200"
          className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] pointer-events-none"
          animate={{ rotate: state === 'idle' ? 0 : -360 }}
          transition={
            state === 'idle'
              ? { duration: 0.4 }
              : { duration: state === 'thinking' ? 3.2 : 16, repeat: Infinity, ease: 'linear' }
          }
        >
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="#00F0FF"
            strokeOpacity={state === 'idle' ? '0.16' : '0.42'}
            strokeWidth="1.5"
            strokeDasharray="48 92"
          />
        </motion.svg>

        {/* Core glowing orb */}
        <motion.div
          animate={{
            scale: state === 'idle' ? 1 : reactiveScale,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          style={{ boxShadow: glowShadow }}
          className={`relative z-10 ${coreClass} rounded-full bg-gradient-to-br from-[#0F1E36] via-[#0B1325] to-[#070B14] border border-white/15 flex flex-col items-center justify-center transition-transform group-hover:scale-[1.03]`}
        >
          {state === 'speaking' ? (
            <div className="flex items-center gap-1 h-7">
              {[0.55, 0.95, 1, 0.8, 0.5].map((mult, idx) => (
                <motion.span
                  key={idx}
                  animate={{
                    scaleY: [0.35, Math.max(0.45, mult * (0.55 + audioLevel * 0.9)), 0.35],
                  }}
                  transition={{
                    duration: 0.45 + idx * 0.08,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="w-1 h-7 rounded-full bg-gradient-to-t from-[#6366F1] to-[#00F0FF] origin-center"
                />
              ))}
            </div>
          ) : state === 'listening' ? (
            <div className="flex flex-col items-center gap-1">
              <Mic className="w-6 h-6 text-[#00F0FF]" />
              <div className="flex items-center gap-0.5 h-3">
                {[0.5, 0.9, 0.65, 1, 0.6].map((m, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ scaleY: Math.max(0.25, m * (0.3 + audioLevel * 1.4)) }}
                    transition={{ duration: 0.08 }}
                    className="w-0.5 h-3 rounded-full bg-[#00F0FF] origin-center"
                  />
                ))}
              </div>
            </div>
          ) : state === 'thinking' ? (
            <div className="w-6 h-6 rounded-full border-2 border-[#00F0FF]/30 border-t-[#00F0FF] animate-spin" />
          ) : (
            <Mic className="w-6 h-6 text-slate-200 group-hover:text-[#00F0FF] transition-colors" />
          )}
        </motion.div>
      </button>

      {/* Action Hint Text */}
      <div className="text-center space-y-1">
        <p className="text-xs font-medium text-slate-200">{primaryLabel}</p>
        {state === 'speaking' && (
          <p className="text-[11px] font-mono text-[#00F0FF]/90 flex items-center justify-center gap-1.5">
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Speak, click orb, or hit Space to interrupt immediately</span>
          </p>
        )}
        {state === 'listening' && (
          <p className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
            <MicOff className="w-3 h-3" />
            <span>Auto-sends after brief pause · Click orb to commit now</span>
          </p>
        )}
      </div>
    </div>
  );
}
