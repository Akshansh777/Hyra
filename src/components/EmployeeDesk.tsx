import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Camera,
  CheckCircle2,
  CloudRain,
  Download,
  Mail,
  Mic,
  Plus,
  Send,
  ShieldAlert,
  Square,
  Ticket,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { QUICK_PROMPTS } from '../data/corporateSeed';
import { checkTeamCalendarConflicts } from '../data/teamCalendar.js';
import { exportCorporateApprovalPassPdf, exportTicketPdf } from '../services/pdfExport';
import type {
  CorporateTicket,
  DeskActionCard,
  DeskMessage,
  GhostWriteContext,
  LanguageMode,
  RequestType,
  TicketCategory,
  TicketPriority,
  VisionDiagnosis,
  VoiceState,
  WorkplaceRequest,
} from '../types/hyra';
import { VoiceOrb } from './VoiceOrb';

interface EmployeeDeskProps {
  languageMode: LanguageMode;
  voiceState: VoiceState;
  audioLevel: number;
  interimTranscript: string;
  bargeInNotice: string | null;
  engineNote: string | null;
  micError: string | null;
  messages: DeskMessage[];
  actionCards: DeskActionCard[];
  tickets: CorporateTicket[];
  requests: WorkplaceRequest[];
  activeEmployeeName: string;
  activeDepartment: string;
  simulateSevereAlert: boolean;
  diagnosingImage: boolean;
  onToggleSimulateAlert: () => void;
  onToggleOrb: () => void;
  onStopSpeaking: () => void;
  onSendMessage: (text: string, source: 'voice' | 'chat') => Promise<void>;
  onDiagnoseImage: (file: File, note?: string) => Promise<void>;
  onAutoLogVisionTicket: (diagnosis: VisionDiagnosis) => Promise<void>;
  onOpenGhostWrite: (context: GhostWriteContext) => void;
  onCreateManualTicket: (payload: {
    title: string;
    summary: string;
    category: TicketCategory;
    priority: TicketPriority;
  }) => Promise<void>;
  onCreateManualRequest: (payload: {
    type: RequestType;
    title: string;
    reason: string;
    dateRange: string;
  }) => Promise<void>;
}

type PanelFilter = 'feed' | 'tickets' | 'requests';

export function EmployeeDesk({
  languageMode,
  voiceState,
  audioLevel,
  interimTranscript,
  bargeInNotice,
  engineNote,
  micError,
  messages,
  actionCards,
  tickets,
  requests,
  activeEmployeeName,
  activeDepartment,
  simulateSevereAlert,
  diagnosingImage,
  onToggleSimulateAlert,
  onToggleOrb,
  onStopSpeaking,
  onSendMessage,
  onDiagnoseImage,
  onAutoLogVisionTicket,
  onOpenGhostWrite,
  onCreateManualTicket,
  onCreateManualRequest,
}: EmployeeDeskProps) {
  const [inputText, setInputText] = useState('');
  const [panelFilter, setPanelFilter] = useState<PanelFilter>('feed');
  const [manualModal, setManualModal] = useState<'ticket' | 'request' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loggingVisionId, setLoggingVisionId] = useState<string | null>(null);

  // Manual ticket form state
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>('Hardware');
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>('P1');

  // Manual request form state
  const [reqType, setReqType] = useState<RequestType>('WFH');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDates, setReqDates] = useState('Tomorrow');
  const [reqReason, setReqReason] = useState('');

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || voiceState === 'thinking' || diagnosingImage) return;
    setInputText('');
    await onSendMessage(trimmed, 'chat');
  };

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/') || diagnosingImage) return;
    await onDiagnoseImage(file, inputText.trim() || undefined);
    setInputText('');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    await handleImageFile(file);
  };

  const handleManualTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketSummary.trim()) return;
    setSubmitting(true);
    try {
      await onCreateManualTicket({
        title: ticketTitle.trim(),
        summary: ticketSummary.trim(),
        category: ticketCategory,
        priority: ticketPriority,
      });
      setTicketTitle('');
      setTicketSummary('');
      setManualModal(null);
      setPanelFilter('feed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqReason.trim()) return;
    setSubmitting(true);
    try {
      await onCreateManualRequest({
        type: reqType,
        title: reqTitle.trim(),
        reason: reqReason.trim(),
        dateRange: reqDates.trim() || 'Tomorrow',
      });
      setReqTitle('');
      setReqReason('');
      setManualModal(null);
      setPanelFilter('feed');
    } finally {
      setSubmitting(false);
    }
  };

  const prompts = QUICK_PROMPTS[languageMode];

  const isHardwareOrLeaveCard = (card: DeskActionCard) =>
    card.kind === 'request' ||
    card.kind === 'weather_wfh' ||
    (card.kind === 'ticket' &&
      (card.category === 'Hardware' ||
        /hardware|laptop|dock|screen|headset|replace|monitor/i.test(card.title)));

  return (
    <div className="max-w-[1520px] mx-auto px-4 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[calc(100vh-4.25rem)]">
      {/* LEFT 45% — Hyra Voice & Multimodal HUD */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => void handleDrop(e)}
        className={`lg:col-span-5 glass-panel rounded-2xl flex flex-col overflow-hidden min-h-[660px] lg:h-[calc(100vh-6.75rem)] transition-colors ${
          dragActive ? 'border-[#00F0FF] bg-[#00F0FF]/[0.05]' : ''
        }`}
      >
        {/* Desk Identity & Environmental Alert Simulator Strip */}
        <div className="px-5 py-3 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-white">Hyra Voice & Vision HUD</h1>
            <p className="text-xs text-slate-400">
              {activeEmployeeName} · {activeDepartment}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleSimulateAlert}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition-colors whitespace-nowrap ${
              simulateSevereAlert
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle simulated Noida/Delhi NCR AQI > 300 & Heavy Rain Alert for instant §2.2 WFH Auto-Approval demo"
          >
            <CloudRain className="w-3.5 h-3.5 shrink-0" />
            <span>
              {simulateSevereAlert ? 'Severe Rain/AQI Alert: ON' : 'Simulate Severe Rain/AQI'}
            </span>
          </button>
        </div>

        {/* Jarvis Voice Orb Stage + Snap & Fix Dropzone */}
        <div className="px-5 pt-4 pb-3.5 border-b border-white/[0.06] bg-gradient-to-b from-[#00F0FF]/[0.03] to-transparent">
          <VoiceOrb
            size="sm"
            state={diagnosingImage ? 'thinking' : voiceState}
            audioLevel={audioLevel}
            onClick={onToggleOrb}
            labelOverride={
              diagnosingImage
                ? 'Gemini Vision analyzing screenshot…'
                : undefined
            }
          />

          {/* Transient notices */}
          <div className="mt-2.5 min-h-[20px] flex flex-col items-center gap-1">
            <AnimatePresence mode="wait">
              {bargeInNotice && (
                <motion.p
                  key="barge"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-mono text-[#00F0FF]"
                >
                  {bargeInNotice}
                </motion.p>
              )}
              {!bargeInNotice && interimTranscript && (
                <motion.p
                  key="interim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-cyan-100/90 text-center max-w-md line-clamp-2 italic"
                >
                  “{interimTranscript}”
                </motion.p>
              )}
              {!bargeInNotice && !interimTranscript && micError && (
                <p className="text-xs text-amber-300 text-center">{micError}</p>
              )}
              {!bargeInNotice && !interimTranscript && !micError && engineNote && (
                <p className="text-[11px] font-mono text-slate-400 text-center">{engineNote}</p>
              )}
            </AnimatePresence>
          </div>

          {/* Snap & Fix Multimodal Dropzone Bar */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              void handleImageFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={diagnosingImage}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-white/15 hover:border-[#00F0FF]/55 bg-white/[0.025] hover:bg-[#00F0FF]/[0.05] transition-colors flex items-center justify-center gap-2 text-xs text-slate-300 hover:text-white disabled:opacity-50"
          >
            {diagnosingImage ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border border-[#00F0FF]/40 border-t-[#00F0FF] animate-spin" />
                <span className="font-mono text-[#00F0FF]">Diagnosing error photo with Gemini Vision…</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>
                  <strong className="font-medium text-white">Snap & Fix IT Diagnostics:</strong> Upload or drop photo of error screen / VPN popup / broken hardware
                </span>
                <Upload className="w-3 h-3 text-slate-400 shrink-0 hidden sm:inline" />
              </>
            )}
          </button>

          {/* Quick Action Prompt Buttons */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {prompts.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={voiceState === 'thinking' || diagnosingImage}
                onClick={() => void onSendMessage(item.prompt, 'chat')}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 bg-white/[0.04] hover:bg-white/[0.09] hover:text-white border border-white/[0.07] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Transcript Conversation Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-1 font-mono">
                  <span>{isUser ? activeEmployeeName : 'Hyra'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.linkedRecordCode && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#00F0FF]">{msg.linkedRecordCode}</span>
                    </>
                  )}
                  {msg.interrupted && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300">Barge-in interrupted</span>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#6366F1]/20 border border-[#6366F1]/35 text-slate-100'
                      : 'bg-white/[0.04] border border-white/[0.08] text-slate-100'
                  }`}
                >
                  {msg.imagePreviewUrl && (
                    <img
                      src={msg.imagePreviewUrl}
                      alt="Uploaded IT diagnostic photo"
                      className="mb-2.5 rounded-lg max-h-36 w-auto object-cover border border-white/10"
                    />
                  )}
                  <p>{msg.text}</p>
                  {(msg.handbookSection || msg.policyCitation) && (
                    <p className="mt-2 pt-2 border-t border-white/[0.07] text-xs font-mono text-[#00F0FF]/90 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Source: {msg.handbookSection || msg.policyCitation}
                      </span>
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}

          {(voiceState === 'thinking' || diagnosingImage) && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-3 h-3 rounded-full border border-[#00F0FF]/40 border-t-[#00F0FF] animate-spin" />
              <span>
                {diagnosingImage
                  ? 'Running Gemini Vision hardware/error analysis…'
                  : 'Hyra is running RAG & executing Gemini function tools…'}
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Multimodal Input Bar */}
        <form
          onSubmit={handleSubmitText}
          className="p-3.5 border-t border-white/[0.08] bg-[#070B14]/70 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onToggleOrb}
            title={voiceState === 'speaking' ? 'Barge-In & Listen' : 'Toggle Microphone'}
            className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
              voiceState === 'listening'
                ? 'bg-[#00F0FF]/20 border-[#00F0FF]/50 text-[#00F0FF]'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={diagnosingImage}
            onClick={() => fileInputRef.current?.click()}
            title="Snap & Fix: Upload error screenshot or hardware photo"
            className="p-2.5 rounded-xl border bg-white/[0.04] border-white/10 text-slate-300 hover:text-[#00F0FF] hover:border-[#00F0FF]/40 transition-colors shrink-0 disabled:opacity-45"
          >
            <Camera className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              languageMode === 'HINGLISH'
                ? 'Bol ya type karo (e.g. "Noida mein barish hai, WFH check karo")...'
                : 'Ask Handbook, request WFH, check Noida AQI, or report IT issue...'
            }
            className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]/60"
          />

          {voiceState === 'speaking' && (
            <button
              type="button"
              onClick={onStopSpeaking}
              title="Stop Hyra speech"
              className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-400/35 text-rose-200 text-xs font-medium hover:bg-rose-500/30 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() || voiceState === 'thinking' || diagnosingImage}
            className="px-3.5 py-2.5 rounded-xl bg-[#00F0FF] text-[#070B14] font-semibold text-xs hover:bg-[#3CF3FF] transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </section>

      {/* RIGHT 55% — Live Action & Cards Panel */}
      <section className="lg:col-span-7 glass-panel rounded-2xl flex flex-col overflow-hidden min-h-[660px] lg:h-[calc(100vh-6.75rem)]">
        {/* Panel Header & Segmented Filter */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/80 border border-white/[0.07]">
            {(
              [
                { id: 'feed', label: `Live Actions (${actionCards.length})` },
                { id: 'tickets', label: `Tickets (${tickets.length})` },
                { id: 'requests', label: `Requests (${requests.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanelFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  panelFilter === tab.id
                    ? 'bg-white/[0.11] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualModal('ticket')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>Log Ticket</span>
            </button>
            <button
              type="button"
              onClick={() => setManualModal('request')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-[#6366F1]/20 hover:bg-[#6366F1]/30 border border-[#6366F1]/40 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <CalendarClock className="w-3.5 h-3.5 text-indigo-300" />
              <span>New Request</span>
            </button>
          </div>
        </div>

        {/* Manual Form Drawer */}
        <AnimatePresence>
          {manualModal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/[0.08] bg-slate-900/75 overflow-hidden"
            >
              {manualModal === 'ticket' ? (
                <form onSubmit={handleManualTicketSubmit} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Create Support / Hardware Ticket</h2>
                    <button
                      type="button"
                      onClick={() => setManualModal(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                      placeholder="Issue headline (e.g. Cracked MacBook display replacement)"
                      className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                    />
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value as TicketCategory)}
                      className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#00F0FF]"
                    >
                      <option value="Hardware">Hardware</option>
                      <option value="Security">Security</option>
                      <option value="IT Access">IT Access</option>
                      <option value="Payroll">Payroll</option>
                      <option value="Facilities">Facilities</option>
                    </select>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value as TicketPriority)}
                      className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#00F0FF]"
                    >
                      <option value="P0">P0-CRITICAL · Security</option>
                      <option value="P1">P1 · High Priority</option>
                      <option value="P2">P2 · Standard</option>
                      <option value="P3">P3 · Low</option>
                    </select>
                    <textarea
                      required
                      rows={2}
                      value={ticketSummary}
                      onChange={(e) => setTicketSummary(e.target.value)}
                      placeholder="Describe symptoms, device serial, or error code..."
                      className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManualModal(null)}
                      className="px-3.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3DF5FF] disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleManualRequestSubmit} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Submit Leave / WFH / Equipment Request</h2>
                    <button
                      type="button"
                      onClick={() => setManualModal(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={reqType}
                      onChange={(e) => setReqType(e.target.value as RequestType)}
                      className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#00F0FF]"
                    >
                      <option value="WFH">Work From Home (WFH)</option>
                      <option value="PTO">Paid Time Off (PTO)</option>
                      <option value="Equipment">Hardware Replacement / Equipment</option>
                      <option value="Travel">Business Travel</option>
                      <option value="Access">JIT System Access</option>
                    </select>
                    <input
                      required
                      value={reqDates}
                      onChange={(e) => setReqDates(e.target.value)}
                      placeholder="Dates (e.g. Tomorrow, Thu – Fri)"
                      className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                    />
                    <input
                      required
                      value={reqTitle}
                      onChange={(e) => setReqTitle(e.target.value)}
                      placeholder="Request title (e.g. WFH sprint focus day)"
                      className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                    />
                    <textarea
                      required
                      rows={2}
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="Brief context for Ops / Manager approval..."
                      className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                    />
                  </div>
                  {/* Live Squad Calendar Preview */}
                  {reqDates.trim() && (
                    <p className="text-xs font-mono text-amber-300/90">
                      Squad Calendar Check: {checkTeamCalendarConflicts(reqDates).summary}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManualModal(null)}
                      className="px-3.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#6366F1] text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Send for Approval'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Right Panel Cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {panelFilter === 'feed' && (
            <div className="space-y-3.5">
              {actionCards.map((card) => {
                const isP0 = card.kind === 'escalation';
                const isPolicy = card.kind === 'policy';
                const isWeatherWfh = card.kind === 'weather_wfh';
                const isVision = card.kind === 'vision';
                const linkedTicket = tickets.find((t) => t.ticketCode === card.code);
                const linkedRequest = requests.find((r) => r.requestCode === card.code);
                const liveStatus = linkedTicket?.status || linkedRequest?.status || card.status;
                const conflict = linkedRequest?.calendarConflict || card.calendarConflict;
                const weather = linkedRequest?.weatherTrigger || card.weatherTrigger;
                const showGhostAndPass = isHardwareOrLeaveCard(card);
                const isPassHardware =
                  card.kind === 'ticket' || card.requestType === 'Equipment';

                return (
                  <motion.article
                    key={card.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 border transition-colors space-y-3 ${
                      isP0
                        ? 'bg-rose-500/[0.08] border-rose-500/40'
                        : isWeatherWfh && weather?.autoApproved
                        ? 'bg-emerald-500/[0.06] border-emerald-400/35'
                        : isVision
                        ? 'bg-[#00F0FF]/[0.05] border-[#00F0FF]/30'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15'
                    }`}
                  >
                    {/* Top Metadata Line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                          {isP0 ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : isWeatherWfh ? (
                            <CloudRain className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isVision ? (
                            <Wrench className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                          ) : isPolicy ? (
                            <BookOpen className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                          ) : card.kind === 'request' ? (
                            <CalendarClock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          ) : (
                            <Ticket className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                          )}
                          <span className={isP0 ? 'text-rose-300 font-semibold' : 'text-[#00F0FF]'}>
                            {card.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{card.subtitle}</span>
                          {card.sentiment && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-300">tone: {card.sentiment}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              liveStatus === 'approved' || liveStatus === 'resolved' || liveStatus === 'verified'
                                ? 'text-emerald-400 font-medium'
                                : liveStatus === 'escalated' || liveStatus === 'declined'
                                ? 'text-rose-400 font-medium'
                                : 'text-amber-300 font-medium'
                            }
                          >
                            {liveStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                      </div>

                      {card.handbookCitation && (
                        <span className="text-[11px] font-mono text-[#00F0FF]/90 whitespace-nowrap shrink-0">
                          Source: {card.handbookCitation}
                        </span>
                      )}
                    </div>

                    {/* Environmental Auto-Approval Telemetry Block */}
                    {weather && (
                      <div
                        className={`rounded-lg p-3 border text-xs space-y-1.5 ${
                          weather.autoApproved
                            ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-100'
                            : 'bg-slate-900/70 border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                          <span className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {weather.autoApproved
                              ? 'Auto-Approved via Environmental Trigger'
                              : `Live Weather Check · ${weather.city}`}
                          </span>
                          <span className="tabular-nums text-[11px]">
                            AQI {weather.aqi} ({weather.aqiLabel}) · Rain {weather.rainMmPerHr} mm/hr · {weather.temperatureC}°C
                          </span>
                        </div>
                        <p className="text-slate-200/90 leading-relaxed">{weather.triggerReason}</p>
                      </div>
                    )}

                    {/* Team Calendar Conflict Warning Block */}
                    {conflict?.hasConflict && (
                      <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-400/35 text-xs space-y-1">
                        <p className="font-mono font-semibold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Calendar Conflict Warning ({conflict.count} squad overlap)</span>
                        </p>
                        <p className="text-amber-100/90 leading-relaxed">{conflict.summary}</p>
                      </div>
                    )}

                    {/* Vision Snap & Fix Diagnosis Block */}
                    {isVision && card.visionDiagnosis && (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
                        <img
                          src={card.visionDiagnosis.imagePreviewUrl}
                          alt="Diagnosed hardware or error screen"
                          className="sm:col-span-4 rounded-lg w-full h-28 object-cover border border-white/10"
                        />
                        <div className="sm:col-span-8 space-y-2">
                          <p className="text-xs font-mono text-[#00F0FF]">
                            Detected: {card.visionDiagnosis.detectedError} · {card.visionDiagnosis.priority}
                          </p>
                          <ol className="space-y-1.5 text-xs text-slate-200">
                            {card.visionDiagnosis.twoStepFix.map((step, i) => (
                              <li key={i} className="leading-relaxed">
                                <span className="font-mono text-[#00F0FF] mr-1.5">0{i + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            {card.visionDiagnosis.loggedTicketCode ? (
                              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Logged as {card.visionDiagnosis.loggedTicketCode}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={loggingVisionId === card.visionDiagnosis.id}
                                onClick={async () => {
                                  setLoggingVisionId(card.visionDiagnosis!.id);
                                  try {
                                    await onAutoLogVisionTicket(card.visionDiagnosis!);
                                  } finally {
                                    setLoggingVisionId(null);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3DF4FF] disabled:opacity-50"
                              >
                                {loggingVisionId === card.visionDiagnosis.id
                                  ? 'Logging Ticket…'
                                  : 'Auto-Log IT Ticket with Diagnosis'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard description */}
                    {!isVision && (
                      <p className="text-xs text-slate-300 leading-relaxed">{card.details}</p>
                    )}

                    {linkedRequest?.reviewerNote && !weather?.autoApproved && (
                      <p className="pt-2 border-t border-white/[0.07] text-xs text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Ops Note: {linkedRequest.reviewerNote}</span>
                      </p>
                    )}

                    {/* Card Action Row: Ghost-Write to Manager + Download Pass (PDF) */}
                    {(showGhostAndPass || linkedTicket) && (
                      <div className="pt-2.5 border-t border-white/[0.07] flex flex-wrap items-center justify-end gap-2">
                        {showGhostAndPass && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenGhostWrite({
                                recordCode: card.code,
                                kind: isPassHardware ? 'hardware' : 'leave_wfh',
                                title: card.title,
                                dateRange: card.dateRange || linkedRequest?.dateRange,
                                reason: card.details,
                                status: liveStatus,
                                employeeName: activeEmployeeName,
                                department: activeDepartment,
                                calendarConflictSummary: conflict?.hasConflict ? conflict.summary : undefined,
                                weatherTriggerSummary: weather?.autoApproved ? weather.triggerReason : undefined,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-100 bg-[#6366F1]/22 hover:bg-[#6366F1]/35 border border-[#6366F1]/40 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <Mail className="w-3.5 h-3.5 text-indigo-300" />
                            <span>Ghost-Write to Manager</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            exportCorporateApprovalPassPdf({
                              passKind: isPassHardware || Boolean(linkedTicket) ? 'IT_ASSET' : 'LEAVE_WFH',
                              recordCode: card.code,
                              title: card.title,
                              employeeName: linkedTicket?.employeeName || linkedRequest?.employeeName || activeEmployeeName,
                              department: linkedTicket?.department || linkedRequest?.department || activeDepartment,
                              status: weather?.autoApproved ? 'AUTO-APPROVED (§2.2)' : liveStatus,
                              timestamp: card.timestamp,
                              dateRange: card.dateRange || linkedRequest?.dateRange || card.subtitle,
                              details: card.details,
                              handbookCitation: card.handbookCitation,
                              environmentalTrigger: weather?.autoApproved ? weather.triggerReason : undefined,
                              calendarConflictNote: conflict?.hasConflict ? conflict.summary : undefined,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#070B14] bg-[#00F0FF] hover:bg-[#3DF4FF] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Pass (PDF)</span>
                        </button>
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          )}

          {panelFilter === 'tickets' && (
            <div className="space-y-2.5">
              {tickets.map((t) => {
                const isHw = t.category === 'Hardware';
                return (
                  <article
                    key={t.id}
                    className={`rounded-xl p-4 border space-y-2.5 ${
                      t.priority === 'P0'
                        ? 'bg-rose-500/[0.07] border-rose-500/35'
                        : 'bg-white/[0.03] border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                          <span className="text-[#00F0FF]">{t.ticketCode}</span>
                          <span aria-hidden="true">·</span>
                          <span className={t.priority === 'P0' ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                            {t.displayPriority || (t.priority === 'P0' ? 'P0-CRITICAL' : t.priority)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{t.category}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              t.status === 'resolved'
                                ? 'text-emerald-400'
                                : t.status === 'escalated'
                                ? 'text-rose-400'
                                : 'text-amber-300'
                            }
                          >
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-white">{t.title}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{t.summary}</p>
                    <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {t.employeeName} · {t.department} · {new Date(t.createdAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {isHw && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenGhostWrite({
                                recordCode: t.ticketCode,
                                kind: 'hardware',
                                title: t.title,
                                reason: t.summary,
                                status: t.status,
                                employeeName: t.employeeName,
                                department: t.department,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg text-xs text-indigo-100 bg-[#6366F1]/22 hover:bg-[#6366F1]/35 border border-[#6366F1]/40 flex items-center gap-1.5"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Ghost-Write</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => exportTicketPdf(t)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#070B14] bg-[#00F0FF] hover:bg-[#3DF4FF] flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Pass (PDF)</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {panelFilter === 'requests' && (
            <div className="space-y-2.5">
              {requests.map((r) => (
                <article
                  key={r.id}
                  className={`rounded-xl p-4 border space-y-2.5 ${
                    r.weatherTrigger?.autoApproved
                      ? 'bg-emerald-500/[0.05] border-emerald-400/30'
                      : 'bg-white/[0.03] border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-indigo-300">{r.requestCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.dateRange}</span>
                    </div>
                    <span
                      className={
                        r.status === 'approved'
                          ? 'text-emerald-400 font-medium'
                          : r.status === 'declined'
                          ? 'text-rose-400 font-medium'
                          : 'text-amber-300 font-medium'
                      }
                    >
                      {r.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{r.reason}</p>

                  {r.weatherTrigger?.autoApproved && (
                    <p className="text-xs font-mono text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Auto-Approved via Environmental Trigger · AQI {r.weatherTrigger.aqi} · Rain {r.weatherTrigger.rainMmPerHr} mm/hr
                      </span>
                    </p>
                  )}

                  {r.calendarConflict?.hasConflict && (
                    <p className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Calendar Conflict Warning · {r.calendarConflict.summary}</span>
                    </p>
                  )}

                  <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenGhostWrite({
                          recordCode: r.requestCode,
                          kind: r.type === 'Equipment' ? 'hardware' : 'leave_wfh',
                          title: r.title,
                          dateRange: r.dateRange,
                          reason: r.reason,
                          status: r.status,
                          employeeName: r.employeeName,
                          department: r.department,
                          calendarConflictSummary: r.calendarConflict?.hasConflict
                            ? r.calendarConflict.summary
                            : undefined,
                          weatherTriggerSummary: r.weatherTrigger?.autoApproved
                            ? r.weatherTrigger.triggerReason
                            : undefined,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-100 bg-[#6366F1]/22 hover:bg-[#6366F1]/35 border border-[#6366F1]/40 flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Ghost-Write to Manager</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportCorporateApprovalPassPdf({
                          passKind: r.type === 'Equipment' ? 'IT_ASSET' : 'LEAVE_WFH',
                          recordCode: r.requestCode,
                          title: r.title,
                          employeeName: r.employeeName,
                          department: r.department,
                          status: r.weatherTrigger?.autoApproved ? 'AUTO-APPROVED (§2.2)' : r.status,
                          timestamp: r.createdAt,
                          dateRange: r.dateRange,
                          details: r.reason,
                          handbookCitation: r.weatherTrigger ? 'Handbook §2.2' : 'Handbook §2.1',
                          environmentalTrigger: r.weatherTrigger?.autoApproved
                            ? r.weatherTrigger.triggerReason
                            : undefined,
                          calendarConflictNote: r.calendarConflict?.hasConflict
                            ? r.calendarConflict.summary
                            : undefined,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#070B14] bg-[#00F0FF] hover:bg-[#3DF4FF] flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Pass (PDF)</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
