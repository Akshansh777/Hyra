import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceController } from '../services/voiceService';
import type { LanguageMode, VoiceEngine, VoiceState } from '../types/hyra';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseVoicePipelineOptions {
  languageMode: LanguageMode;
  voiceEngine: VoiceEngine;
  enableSpacebarShortcut?: boolean;
  onFinalTranscript: (transcript: string, meta: { durationSec: number }) => void;
  onBargeIn?: () => void;
}

export function useVoicePipeline({
  languageMode,
  voiceEngine,
  enableSpacebarShortcut = true,
  onFinalTranscript,
  onBargeIn,
}: UseVoicePipelineOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [bargeInNotice, setBargeInNotice] = useState<string | null>(null);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));

  const stateRef = useRef<VoiceState>('idle');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const listeningStartedAtRef = useRef<number>(0);
  const finalBufferRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  const onBargeInRef = useRef(onBargeIn);
  const langRef = useRef(languageMode);
  const engineRef = useRef(voiceEngine);

  onFinalRef.current = onFinalTranscript;
  onBargeInRef.current = onBargeIn;
  langRef.current = languageMode;
  engineRef.current = voiceEngine;

  const updateState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setVoiceState(next);
  }, []);

  const flashNotice = useCallback((msg: string) => {
    setBargeInNotice(msg);
    window.setTimeout(() => {
      setBargeInNotice((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const stopMicAnalyser = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startMicAnalyser = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!mediaStreamRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const norm = Math.min(1, sum / (data.length * 115));
        if (stateRef.current === 'listening') {
          setAudioLevel(norm);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic analyser is optional visual enhancement; SpeechRecognition handles core capture
    }
  }, []);

  const stopListening = useCallback(
    (commitBuffered = false) => {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }

      stopMicAnalyser();

      const buffered = finalBufferRef.current.trim();
      finalBufferRef.current = '';
      setInterimTranscript('');

      if (commitBuffered && buffered) {
        const durationSec = Math.max(1, Math.round((Date.now() - listeningStartedAtRef.current) / 1000));
        updateState('thinking');
        onFinalRef.current(buffered, { durationSec });
      } else if (stateRef.current === 'listening') {
        updateState('idle');
      }
    },
    [stopMicAnalyser, updateState]
  );

  const startListening = useCallback(() => {
    setMicError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicError('Web Speech API is unavailable in this browser — use text input below.');
      return;
    }

    // Immediate barge-in if Hyra is currently speaking
    if (stateRef.current === 'speaking') {
      voiceController.abortAllSpeech(true);
      onBargeInRef.current?.();
      flashNotice('Barge-in active · Listening');
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langRef.current === 'HINGLISH' ? 'en-IN' : 'en-US';

    finalBufferRef.current = '';
    listeningStartedAtRef.current = Date.now();
    setInterimTranscript('');
    updateState('listening');
    void startMicAnalyser();

    const flushAndCommit = () => {
      const combined = finalBufferRef.current.trim();
      if (!combined) return;
      stopListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalBufferRef.current += `${text} `;
        } else {
          interim += text;
        }
      }

      const display = `${finalBufferRef.current}${interim}`.trim();
      setInterimTranscript(display);

      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
      }
      if (finalBufferRef.current.trim()) {
        silenceTimerRef.current = window.setTimeout(flushAndCommit, 1450);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicError('Microphone permission denied. Allow mic access or type below.');
        stopListening(false);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setMicError(`Voice capture error: ${event.error}`);
        stopListening(false);
      }
    };

    recognition.onend = () => {
      if (stateRef.current === 'listening') {
        const pending = finalBufferRef.current.trim();
        if (pending) {
          stopListening(true);
        } else {
          stopMicAnalyser();
          updateState('idle');
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMicError('Could not start microphone capture.');
      stopListening(false);
    }
  }, [flashNotice, startMicAnalyser, stopListening, stopMicAnalyser, updateState]);

  const bargeIn = useCallback(() => {
    voiceController.abortAllSpeech(true);
    onBargeInRef.current?.();
    flashNotice('Speech interrupted · Listening');
    startListening();
  }, [flashNotice, startListening]);

  const stopSpeaking = useCallback(() => {
    voiceController.abortAllSpeech(true);
    if (stateRef.current === 'speaking') {
      updateState('idle');
    }
  }, [updateState]);

  const speakText = useCallback(
    async (text: string) => {
      if (stateRef.current === 'listening') {
        stopListening(false);
      }
      setEngineNote(null);
      updateState('speaking');

      // Lightweight barge-in speech detector while Hyra speaks
      let bargeRec: SpeechRecognitionInstance | null = null;
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        try {
          bargeRec = new Ctor();
          bargeRec.continuous = false;
          bargeRec.interimResults = true;
          bargeRec.lang = langRef.current === 'HINGLISH' ? 'en-IN' : 'en-US';
          bargeRec.onspeechstart = () => {
            if (stateRef.current === 'speaking') {
              try {
                bargeRec?.abort();
              } catch {
                // ignore
              }
              bargeIn();
            }
          };
          bargeRec.onerror = () => {
            // ignore silent background barge monitor failures
          };
          bargeRec.start();
        } catch {
          bargeRec = null;
        }
      }

      const stopBargeMonitor = () => {
        if (bargeRec) {
          bargeRec.onspeechstart = null;
          bargeRec.onerror = null;
          try {
            bargeRec.abort();
          } catch {
            // ignore
          }
          bargeRec = null;
        }
      };

      await voiceController.speak(text, engineRef.current, langRef.current, {
        onStart: (_used, fallbackReason) => {
          if (fallbackReason) {
            setEngineNote(fallbackReason);
          }
        },
        onAudioLevel: (lvl) => {
          if (stateRef.current === 'speaking') {
            setAudioLevel(lvl);
          }
        },
        onEnd: () => {
          stopBargeMonitor();
          if (stateRef.current === 'speaking') {
            updateState('idle');
          }
        },
        onAbort: () => {
          stopBargeMonitor();
        },
      });
    },
    [bargeIn, stopListening, updateState]
  );

  const toggleOrb = useCallback(() => {
    if (stateRef.current === 'speaking') {
      bargeIn();
    } else if (stateRef.current === 'listening') {
      stopListening(Boolean(finalBufferRef.current.trim()));
    } else if (stateRef.current === 'idle') {
      startListening();
    }
  }, [bargeIn, startListening, stopListening]);

  // Global Spacebar Barge-In & Push-to-Talk shortcut
  useEffect(() => {
    if (!enableSpacebarShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      toggleOrb();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableSpacebarShortcut, toggleOrb]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceController.abortAllSpeech(false);
      stopListening(false);
    };
  }, [stopListening]);

  return {
    voiceState,
    setVoiceState: updateState,
    interimTranscript,
    audioLevel,
    bargeInNotice,
    engineNote,
    micError,
    speechSupported,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    bargeIn,
    toggleOrb,
  };
}
