import type { LanguageMode, VoiceEngine } from '../types/hyra';

const DEFAULT_ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM';

export interface SpeakCallbacks {
  onStart?: (usedEngine: VoiceEngine, fallbackReason?: string) => void;
  onAudioLevel?: (level: number) => void;
  onEnd?: () => void;
  onAbort?: () => void;
}

class VoiceSpeechController {
  private abortController: AbortController | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private activeBlobUrl: string | null = null;
  private audioCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private rafId: number | null = null;
  private synthWaveInterval: number | null = null;
  private currentCallbacks: SpeakCallbacks | null = null;

  public hasElevenLabsKey(): boolean {
    const key = import.meta.env.VITE_ELEVENLABS_API_KEY;
    return Boolean(key && key.trim().length > 8);
  }

  public abortAllSpeech(triggerAbortCallback = true) {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.synthWaveInterval !== null) {
      window.clearInterval(this.synthWaveInterval);
      this.synthWaveInterval = null;
    }

    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // already stopped
      }
      this.activeSource = null;
    }

    if (this.activeAudio) {
      try {
        this.activeAudio.onended = null;
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
        this.activeAudio.src = '';
      } catch {
        // ignore
      }
      this.activeAudio = null;
    }

    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
      this.activeBlobUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const cb = this.currentCallbacks;
    this.currentCallbacks = null;
    cb?.onAudioLevel?.(0);
    if (triggerAbortCallback) {
      cb?.onAbort?.();
    }
  }

  public async speak(
    text: string,
    preferredEngine: VoiceEngine,
    languageMode: LanguageMode,
    callbacks: SpeakCallbacks = {}
  ): Promise<void> {
    this.abortAllSpeech(false);
    const cleaned = text.trim();
    if (!cleaned) {
      callbacks.onEnd?.();
      return;
    }

    this.currentCallbacks = callbacks;

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY?.trim();
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE;

    if (preferredEngine === 'elevenlabs' && apiKey) {
      try {
        await this.speakWithElevenLabs(cleaned, apiKey, voiceId, callbacks);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const reason =
          err instanceof Error ? err.message : 'ElevenLabs unavailable — switched to Browser Speech';
        await this.speakWithBrowserSynthesis(cleaned, languageMode, callbacks, reason);
        return;
      }
    }

    const fallbackReason =
      preferredEngine === 'elevenlabs' && !apiKey
        ? 'No VITE_ELEVENLABS_API_KEY set — using Browser Speech'
        : undefined;
    await this.speakWithBrowserSynthesis(cleaned, languageMode, callbacks, fallbackReason);
  }

  private async speakWithElevenLabs(
    text: string,
    apiKey: string,
    voiceId: string,
    callbacks: SpeakCallbacks
  ): Promise<void> {
    const controller = new AbortController();
    this.abortController = controller;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.78,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs HTTP ${response.status} — switched to Browser Speech`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (controller.signal.aborted) return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const decoded = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
    if (controller.signal.aborted) return;

    const source = this.audioCtx.createBufferSource();
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 128;

    source.buffer = decoded;
    source.connect(analyser);
    analyser.connect(this.audioCtx.destination);
    this.activeSource = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const pumpLevel = () => {
      if (!this.activeSource) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const normalized = Math.min(1, sum / (dataArray.length * 145));
      callbacks.onAudioLevel?.(normalized);
      this.rafId = requestAnimationFrame(pumpLevel);
    };

    callbacks.onStart?.('elevenlabs');
    pumpLevel();

    return new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.activeSource = null;
        this.abortController = null;
        this.currentCallbacks = null;
        callbacks.onAudioLevel?.(0);
        callbacks.onEnd?.();
        resolve();
      };
      source.start(0);
    });
  }

  private async speakWithBrowserSynthesis(
    text: string,
    languageMode: LanguageMode,
    callbacks: SpeakCallbacks,
    fallbackReason?: string
  ): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks.onStart?.('browser', 'Speech synthesis unavailable in this browser');
      callbacks.onEnd?.();
      return;
    }

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const targetLang = languageMode === 'HINGLISH' ? 'en-IN' : 'en-US';
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase().includes(targetLang.toLowerCase())) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.lang = targetLang;
      utterance.rate = languageMode === 'HINGLISH' ? 1.02 : 1.04;
      utterance.pitch = 1.0;

      let phase = 0;
      utterance.onstart = () => {
        callbacks.onStart?.('browser', fallbackReason);
        this.synthWaveInterval = window.setInterval(() => {
          phase += 0.45;
          const syntheticLevel = 0.28 + Math.abs(Math.sin(phase) * Math.cos(phase * 0.55)) * 0.58;
          callbacks.onAudioLevel?.(syntheticLevel);
        }, 70);
      };

      const finish = () => {
        if (this.synthWaveInterval !== null) {
          window.clearInterval(this.synthWaveInterval);
          this.synthWaveInterval = null;
        }
        this.currentCallbacks = null;
        callbacks.onAudioLevel?.(0);
        callbacks.onEnd?.();
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }
}

export const voiceController = new VoiceSpeechController();
