import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Mail, MessageSquare, RefreshCw, X } from 'lucide-react';
import { generateGhostWriteDraft } from '../services/hyraApi';
import type { GhostWriteContext, GhostWriteDraft, LanguageMode } from '../types/hyra';

interface GhostWriteModalProps {
  context: GhostWriteContext | null;
  languageMode: LanguageMode;
  onClose: () => void;
}

export function GhostWriteModal({ context, languageMode, onClose }: GhostWriteModalProps) {
  const [channel, setChannel] = useState<'slack' | 'email'>('slack');
  const [draft, setDraft] = useState<GhostWriteDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadDraft = async (ctx: GhostWriteContext) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await generateGhostWriteDraft(ctx, languageMode);
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate manager handover draft.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!context) {
      setDraft(null);
      return;
    }
    void loadDraft(context);
  }, [context]);

  const handleCopy = async () => {
    if (!draft) return;
    const textToCopy =
      channel === 'slack'
        ? draft.slackMessage
        : `Subject: ${draft.emailSubject}\n\n${draft.emailBody}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AnimatePresence>
      {context && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#070B14]/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl glass-panel rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Ghost-Write to Manager</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {context.recordCode} · {context.title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Summary */}
            {(context.calendarConflictSummary || context.weatherTriggerSummary) && (
              <div className="px-5 py-3 bg-white/[0.025] border-b border-white/[0.07] space-y-1 text-xs">
                {context.calendarConflictSummary && (
                  <p className="text-amber-300">
                    Calendar Context: {context.calendarConflictSummary}
                  </p>
                )}
                {context.weatherTriggerSummary && (
                  <p className="text-emerald-300">
                    Environmental Trigger: {context.weatherTriggerSummary}
                  </p>
                )}
              </div>
            )}

            {/* Channel Tabs & Actions */}
            <div className="px-5 pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/80 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('slack');
                    setCopied(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    channel === 'slack' ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Slack DM</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('email');
                    setCopied(false);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    channel === 'email' ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Email Handover</span>
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void loadDraft(context)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            {/* Draft Body */}
            <div className="p-5">
              {loading ? (
                <div className="h-44 rounded-xl bg-[#070B14]/80 border border-white/[0.07] flex flex-col items-center justify-center gap-2.5 text-xs font-mono text-slate-400">
                  <span className="w-5 h-5 rounded-full border-2 border-[#00F0FF]/30 border-t-[#00F0FF] animate-spin" />
                  <span>Gemini is drafting a tailored handover note…</span>
                </div>
              ) : error ? (
                <div className="rounded-xl p-4 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
                  {error}
                </div>
              ) : draft ? (
                <div className="space-y-3">
                  {channel === 'email' && (
                    <div className="rounded-lg bg-[#070B14] border border-white/10 px-3.5 py-2 text-xs">
                      <span className="text-slate-500 font-mono mr-2">Subject:</span>
                      <span className="text-white font-medium">{draft.emailSubject}</span>
                    </div>
                  )}
                  <textarea
                    rows={7}
                    readOnly
                    value={channel === 'slack' ? draft.slackMessage : draft.emailBody}
                    className="w-full rounded-xl bg-[#070B14] border border-white/10 p-3.5 text-sm text-slate-100 leading-relaxed focus:outline-none"
                  />
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#070B14]/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!draft || loading}
                onClick={() => void handleCopy()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3EF5FF] disabled:opacity-45 flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : `Copy ${channel === 'slack' ? 'Slack DM' : 'Email'}`}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
