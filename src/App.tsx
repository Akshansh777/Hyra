import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Download, ShieldAlert, X } from 'lucide-react';
import { EmployeeDesk } from './components/EmployeeDesk';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GhostWriteModal } from './components/GhostWriteModal';
import { countFillerWords, InterviewLab } from './components/InterviewLab';
import { OpsDashboard } from './components/OpsDashboard';
import { TopBar } from './components/TopBar';
import { INTERVIEW_TRACKS, SEED_REQUESTS, SEED_TICKETS } from './data/corporateSeed';
import { checkTeamCalendarConflicts } from './data/teamCalendar.js';
import { useCorporateStore } from './hooks/useCorporateStore';
import { useVoicePipeline } from './hooks/useVoicePipeline';
import {
  diagnoseHardwareImage,
  evaluateInterviewTurn,
  requestHyraResponse,
} from './services/hyraApi';
import { exportTicketPdf } from './services/pdfExport';
import type {
  CorporateTicket,
  DeskActionCard,
  DeskMessage,
  GhostWriteContext,
  InterviewTurn,
  LanguageMode,
  RequestType,
  RoleTab,
  TicketCategory,
  TicketPriority,
  VisionDiagnosis,
  VoiceEngine,
} from './types/hyra';

const INITIAL_MESSAGES: DeskMessage[] = [
  {
    id: 'msg_welcome_01',
    role: 'hyra',
    text: 'Hyra online with 15-section Handbook RAG, live Noida/Delhi AQI auto-WFH, Snap & Fix Vision diagnostics, and real-time voice barge-in. Click the orb, press Spacebar, or drop an error screenshot to begin.',
    timestamp: new Date().toISOString(),
    actionType: 'NONE',
    handbookSection: 'Handbook §1.1 – §6.2',
  },
];

const INITIAL_ACTION_CARDS: DeskActionCard[] = [
  {
    id: 'card_seed_wfh',
    kind: 'request',
    code: SEED_REQUESTS[0].requestCode,
    title: SEED_REQUESTS[0].title,
    subtitle: `WFH · ${SEED_REQUESTS[0].dateRange}`,
    status: SEED_REQUESTS[0].status,
    requestType: 'WFH',
    dateRange: SEED_REQUESTS[0].dateRange,
    handbookCitation: 'Handbook §2.1',
    calendarConflict: SEED_REQUESTS[0].calendarConflict,
    timestamp: SEED_REQUESTS[0].createdAt,
    details: SEED_REQUESTS[0].reason,
  },
  {
    id: 'card_seed_hw',
    kind: 'ticket',
    code: SEED_TICKETS[2].ticketCode,
    title: SEED_TICKETS[2].title,
    subtitle: 'P2 · Hardware Replacement',
    status: SEED_TICKETS[2].status,
    priority: 'P2',
    category: 'Hardware',
    handbookCitation: 'Handbook §4.1',
    timestamp: SEED_TICKETS[2].createdAt,
    details: SEED_TICKETS[2].summary,
  },
];

function fileToBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({ base64, dataUrl });
    };
    reader.onerror = () => reject(new Error('Could not read uploaded image file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<RoleTab>('employee');
  const [languageMode, setLanguageMode] = useState<LanguageMode>('EN');
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('elevenlabs');
  const [simulateSevereAlert, setSimulateSevereAlert] = useState(false);

  // Employee Desk state
  const [messages, setMessages] = useState<DeskMessage[]>(INITIAL_MESSAGES);
  const [actionCards, setActionCards] = useState<DeskActionCard[]>(INITIAL_ACTION_CARDS);
  const [diagnosingImage, setDiagnosingImage] = useState(false);
  const [ghostWriteContext, setGhostWriteContext] = useState<GhostWriteContext | null>(null);
  const [activeSecurityAlert, setActiveSecurityAlert] = useState<CorporateTicket | null>(null);

  // Interview Lab state
  const [selectedTrackId, setSelectedTrackId] = useState(INTERVIEW_TRACKS[0].id);
  const [currentQuestion, setCurrentQuestion] = useState(INTERVIEW_TRACKS[0].questions[0]);
  const [interviewTurns, setInterviewTurns] = useState<InterviewTurn[]>([]);
  const [evaluatingInterview, setEvaluatingInterview] = useState(false);

  const store = useCorporateStore();

  const activeEmployeeName = store.storageMeta.userName || 'Aarav Mehta';
  const activeDepartment = 'Platform Engineering';

  const handleDeskInteraction = useCallback(
    async (text: string, source: 'voice' | 'chat', speakReply: (reply: string) => Promise<void>) => {
      const userMsg: DeskMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const aiResult = await requestHyraResponse({
          message: text,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          languageMode,
          handbook: store.handbook,
          employeeName: activeEmployeeName,
          department: activeDepartment,
          simulateSevereAlert,
        });

        let linkedCode: string | undefined;

        if (aiResult.actionType === 'ESCALATE_P0' || aiResult.actionType === 'CREATE_TICKET') {
          const isP0 = aiResult.actionType === 'ESCALATE_P0' || Boolean(aiResult.securityEscalation);
          const payload = aiResult.ticketPayload;
          const created = await store.addTicket({
            title: payload?.title || text.slice(0, 95),
            summary: payload?.summary || text,
            category: isP0 ? 'Security' : payload?.category || 'IT Access',
            priority: isP0 ? 'P0' : payload?.priority || 'P1',
            displayPriority: isP0 ? 'P0-CRITICAL' : payload?.displayPriority || payload?.priority || 'P1',
            sentiment: payload?.sentiment,
            employeeName: activeEmployeeName,
            department: activeDepartment,
            source,
          });
          linkedCode = created.ticketCode;
          if (isP0) {
            setActiveSecurityAlert(created);
          }

          setActionCards((prev) => [
            {
              id: `card_${created.id}`,
              kind: isP0 ? 'escalation' : 'ticket',
              code: created.ticketCode,
              title: created.title,
              subtitle: `${created.displayPriority || created.priority} · ${created.category}`,
              status: created.status,
              priority: created.priority,
              displayPriority: created.displayPriority,
              sentiment: created.sentiment,
              category: created.category,
              handbookCitation: aiResult.handbookCitation || (isP0 ? 'Handbook §3.1' : 'Handbook §3.3'),
              timestamp: created.createdAt,
              details: created.summary,
            },
            ...prev,
          ]);
        } else if (aiResult.actionType === 'WEATHER_WFH_APPROVAL') {
          const weather = aiResult.weatherTelemetry;
          const payload = aiResult.requestPayload;
          const autoApproved = Boolean(weather?.autoApproved || payload?.autoApproved);
          const created = await store.addRequest({
            type: 'WFH',
            title:
              payload?.title ||
              (autoApproved
                ? `Auto-Approved WFH — ${weather?.city || 'Noida'}`
                : `Weather WFH Request — ${weather?.city || 'Noida'}`),
            reason: payload?.reason || weather?.triggerReason || text,
            dateRange: payload?.dateRange || 'Today',
            employeeName: activeEmployeeName,
            department: activeDepartment,
            autoApproved,
            reviewerNote: autoApproved
              ? `Auto-Approved via Environmental Trigger (Handbook §2.2 · AQI ${weather?.aqi ?? 'N/A'})`
              : undefined,
            calendarConflict: aiResult.calendarConflict,
            weatherTrigger: weather,
          });
          linkedCode = created.requestCode;

          setActionCards((prev) => [
            {
              id: `card_${created.id}`,
              kind: 'weather_wfh',
              code: created.requestCode,
              title: created.title,
              subtitle: `WFH · ${weather?.city || 'Noida'}`,
              status: created.status,
              requestType: 'WFH',
              dateRange: created.dateRange,
              handbookCitation: aiResult.handbookCitation || 'Handbook §2.2',
              weatherTrigger: weather,
              calendarConflict: aiResult.calendarConflict,
              timestamp: created.createdAt,
              details: created.reason,
            },
            ...prev,
          ]);
        } else if (aiResult.actionType === 'CREATE_REQUEST') {
          const payload = aiResult.requestPayload;
          const reqType = payload?.type || 'WFH';
          const dateRange = payload?.dateRange || 'Tomorrow';
          const conflict = aiResult.calendarConflict || checkTeamCalendarConflicts(dateRange);

          const created = await store.addRequest({
            type: reqType,
            title: payload?.title || `${reqType} Request — ${dateRange}`,
            reason: payload?.reason || text,
            dateRange,
            employeeName: activeEmployeeName,
            department: activeDepartment,
            calendarConflict: conflict,
          });
          linkedCode = created.requestCode;

          setActionCards((prev) => [
            {
              id: `card_${created.id}`,
              kind: 'request',
              code: created.requestCode,
              title: created.title,
              subtitle: `${created.type} · ${created.dateRange}`,
              status: created.status,
              requestType: created.type,
              dateRange: created.dateRange,
              handbookCitation: aiResult.handbookCitation || 'Handbook §2.1',
              calendarConflict: conflict,
              timestamp: created.createdAt,
              details: created.reason,
            },
            ...prev,
          ]);
        } else if (aiResult.actionType === 'POLICY_ANSWER' && (aiResult.handbookCitation || aiResult.policyCitation)) {
          const matchedPolicy = store.handbook.find(
            (p) =>
              (aiResult.handbookCitation &&
                p.section &&
                aiResult.handbookCitation.includes(p.section)) ||
              (aiResult.policyCitation &&
                p.title.toLowerCase().includes(aiResult.policyCitation.toLowerCase()))
          );
          setActionCards((prev) => [
            {
              id: `card_policy_${Date.now()}`,
              kind: 'policy',
              code: matchedPolicy?.section || 'HANDBOOK',
              title: matchedPolicy?.title || aiResult.policyCitation || 'Company Handbook Policy',
              subtitle: matchedPolicy
                ? `${matchedPolicy.category} · ${matchedPolicy.sla}`
                : 'Verified Corporate SOP',
              status: 'verified',
              handbookCitation:
                aiResult.handbookCitation ||
                (matchedPolicy?.section ? `Handbook ${matchedPolicy.section}` : 'Handbook §1.1'),
              timestamp: new Date().toISOString(),
              details: matchedPolicy?.details || aiResult.reply,
            },
            ...prev,
          ]);
        }

        const hyraMsg: DeskMessage = {
          id: `hyra_${Date.now()}`,
          role: 'hyra',
          text: aiResult.reply,
          timestamp: new Date().toISOString(),
          actionType: aiResult.actionType,
          linkedRecordCode: linkedCode,
          handbookSection: aiResult.handbookCitation,
          policyCitation: aiResult.policyCitation || undefined,
        };
        setMessages((prev) => [...prev, hyraMsg]);

        await speakReply(aiResult.reply);
      } catch (err) {
        const errText = err instanceof Error ? err.message : 'Unable to reach Hyra AI service.';
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'hyra',
            text: errText,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [activeDepartment, activeEmployeeName, languageMode, messages, simulateSevereAlert, store]
  );

  const handleInterviewSubmission = useCallback(
    async (
      transcript: string,
      durationSec: number,
      speakReply: (reply: string) => Promise<void>
    ) => {
      const track = INTERVIEW_TRACKS.find((t) => t.id === selectedTrackId) || INTERVIEW_TRACKS[0];
      const words = transcript.trim().split(/\s+/).filter(Boolean).length;
      const wpm = Math.max(40, Math.round((words / Math.max(1, durationSec)) * 60));
      const fillerCount = countFillerWords(transcript);

      setEvaluatingInterview(true);
      try {
        const evaluation = await evaluateInterviewTurn({
          role: track.role,
          question: currentQuestion,
          transcript,
          durationSec,
          fillerCount,
          wpm,
          languageMode,
        });

        const nextTurn: InterviewTurn = {
          id: `turn_${Date.now()}`,
          turnNumber: interviewTurns.length + 1,
          question: currentQuestion,
          transcript,
          durationSec,
          wpm,
          fillerCount,
          clarityScore: evaluation.clarityScore,
          technicalDepth: evaluation.technicalDepth,
          structureScore: evaluation.structureScore,
          confidenceScore: evaluation.confidenceScore,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          coachReply: evaluation.coachReply,
          followUpQuestion: evaluation.followUpQuestion,
          timestamp: new Date().toISOString(),
        };

        setInterviewTurns((prev) => [...prev, nextTurn]);
        await speakReply(evaluation.coachReply);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Evaluation failed.';
        await speakReply(msg);
      } finally {
        setEvaluatingInterview(false);
      }
    },
    [currentQuestion, interviewTurns.length, languageMode, selectedTrackId]
  );

  const voice = useVoicePipeline({
    languageMode,
    voiceEngine,
    enableSpacebarShortcut: activeTab !== 'ops' && !ghostWriteContext,
    onFinalTranscript: (transcript, meta) => {
      if (activeTab === 'interview') {
        void handleInterviewSubmission(transcript, meta.durationSec, voice.speakText).finally(() => {
          if (voice.voiceState === 'thinking') voice.setVoiceState('idle');
        });
      } else {
        void handleDeskInteraction(transcript, 'voice', voice.speakText).finally(() => {
          if (voice.voiceState === 'thinking') voice.setVoiceState('idle');
        });
      }
    },
    onBargeIn: () => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role !== 'hyra') return prev;
        return [...prev.slice(0, -1), { ...last, interrupted: true }];
      });
    },
  });

  const handleManualChatSend = async (text: string, source: 'voice' | 'chat') => {
    voice.setVoiceState('thinking');
    await handleDeskInteraction(text, source, voice.speakText);
    if (voice.voiceState === 'thinking') {
      voice.setVoiceState('idle');
    }
  };

  // Multimodal Snap & Fix IT Diagnostics handler
  const handleDiagnoseImage = async (file: File, note?: string) => {
    setDiagnosingImage(true);
    try {
      const { base64, dataUrl } = await fileToBase64(file);
      setMessages((prev) => [
        ...prev,
        {
          id: `usr_img_${Date.now()}`,
          role: 'user',
          text: note || `Uploaded "${file.name}" for Snap & Fix IT Diagnostics.`,
          imagePreviewUrl: dataUrl,
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await diagnoseHardwareImage({
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
        note,
        languageMode,
      });

      const diagnosis: VisionDiagnosis = {
        id: `vis_${Date.now()}`,
        imagePreviewUrl: dataUrl,
        detectedError: result.detectedError,
        category: result.category,
        priority: result.priority,
        twoStepFix: result.twoStepFix,
        spokenDiagnosis: result.spokenDiagnosis,
        recommendedTicketTitle: result.recommendedTicketTitle,
        handbookCitation: result.handbookSection,
      };

      setActionCards((prev) => [
        {
          id: `card_${diagnosis.id}`,
          kind: 'vision',
          code: 'SNAP-FIX',
          title: diagnosis.recommendedTicketTitle,
          subtitle: `Gemini Vision · ${diagnosis.category}`,
          status: 'diagnosed',
          priority: diagnosis.priority,
          category: diagnosis.category,
          handbookCitation: diagnosis.handbookCitation,
          visionDiagnosis: diagnosis,
          timestamp: new Date().toISOString(),
          details: diagnosis.spokenDiagnosis,
        },
        ...prev,
      ]);

      setMessages((prev) => [
        ...prev,
        {
          id: `hyra_vis_${Date.now()}`,
          role: 'hyra',
          text: `${diagnosis.spokenDiagnosis} Step 1: ${diagnosis.twoStepFix[0]} Step 2: ${diagnosis.twoStepFix[1]}`,
          actionType: 'VISION_DIAGNOSIS',
          handbookSection: diagnosis.handbookCitation,
          timestamp: new Date().toISOString(),
        },
      ]);

      await voice.speakText(diagnosis.spokenDiagnosis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vision diagnosis failed.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err_vis_${Date.now()}`,
          role: 'hyra',
          text: msg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setDiagnosingImage(false);
    }
  };

  const handleAutoLogVisionTicket = async (diagnosis: VisionDiagnosis) => {
    const created = await store.addTicket({
      title: diagnosis.recommendedTicketTitle,
      summary: `Snap & Fix Diagnosis: ${diagnosis.detectedError}. Suggested fixes tried: 1) ${diagnosis.twoStepFix[0]} 2) ${diagnosis.twoStepFix[1]}`,
      category: diagnosis.category,
      priority: diagnosis.priority,
      displayPriority: diagnosis.priority === 'P0' ? 'P0-CRITICAL' : diagnosis.priority,
      sentiment: 'urgent',
      employeeName: activeEmployeeName,
      department: activeDepartment,
      source: 'chat',
    });

    if (created.priority === 'P0') {
      setActiveSecurityAlert(created);
    }

    // Mark the vision card as logged and prepend the live ticket card
    setActionCards((prev) => [
      {
        id: `card_${created.id}`,
        kind: created.priority === 'P0' ? 'escalation' : 'ticket',
        code: created.ticketCode,
        title: created.title,
        subtitle: `${created.displayPriority || created.priority} · ${created.category}`,
        status: created.status,
        priority: created.priority,
        category: created.category,
        handbookCitation: diagnosis.handbookCitation || 'Handbook §4.1',
        timestamp: created.createdAt,
        details: created.summary,
      },
      ...prev.map((c) =>
        c.visionDiagnosis?.id === diagnosis.id
          ? {
              ...c,
              status: 'ticket_logged',
              visionDiagnosis: { ...c.visionDiagnosis, loggedTicketCode: created.ticketCode },
            }
          : c
      ),
    ]);
  };

  const handleManualTicket = async (payload: {
    title: string;
    summary: string;
    category: TicketCategory;
    priority: TicketPriority;
  }) => {
    const created = await store.addTicket({
      ...payload,
      displayPriority: payload.priority === 'P0' ? 'P0-CRITICAL' : payload.priority,
      employeeName: activeEmployeeName,
      department: activeDepartment,
      source: 'manual',
    });
    if (created.priority === 'P0') {
      setActiveSecurityAlert(created);
    }
    setActionCards((prev) => [
      {
        id: `card_${created.id}`,
        kind: created.priority === 'P0' ? 'escalation' : 'ticket',
        code: created.ticketCode,
        title: created.title,
        subtitle: `${created.displayPriority || created.priority} · ${created.category}`,
        status: created.status,
        priority: created.priority,
        category: created.category,
        handbookCitation: created.category === 'Hardware' ? 'Handbook §4.1' : 'Handbook §3.3',
        timestamp: created.createdAt,
        details: created.summary,
      },
      ...prev,
    ]);
  };

  const handleManualRequest = async (payload: {
    type: RequestType;
    title: string;
    reason: string;
    dateRange: string;
  }) => {
    const conflict = checkTeamCalendarConflicts(payload.dateRange);
    const created = await store.addRequest({
      ...payload,
      employeeName: activeEmployeeName,
      department: activeDepartment,
      calendarConflict: conflict,
    });
    setActionCards((prev) => [
      {
        id: `card_${created.id}`,
        kind: 'request',
        code: created.requestCode,
        title: created.title,
        subtitle: `${created.type} · ${created.dateRange}`,
        status: created.status,
        requestType: created.type,
        dateRange: created.dateRange,
        handbookCitation: created.type === 'WFH' ? 'Handbook §2.1' : 'Handbook §1.1',
        calendarConflict: conflict,
        timestamp: created.createdAt,
        details: created.reason,
      },
      ...prev,
    ]);
  };

  const handleSelectTrack = (trackId: string) => {
    const found = INTERVIEW_TRACKS.find((t) => t.id === trackId);
    if (!found) return;
    setSelectedTrackId(trackId);
    setCurrentQuestion(found.questions[0]);
  };

  const p0Count = store.tickets.filter((t) => t.priority === 'P0' && t.status !== 'resolved').length;
  const pendingRequestCount = store.requests.filter((r) => r.status === 'pending').length;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#070B14] text-slate-100 relative overflow-x-hidden">
        {/* Subtle ambient atmospheric backdrop */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-[#00F0FF]/[0.035] blur-[120px]" />
          <div className="absolute top-1/3 -right-24 w-[480px] h-[480px] rounded-full bg-[#6366F1]/[0.05] blur-[130px]" />
        </div>

        <TopBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            voice.stopSpeaking();
            setActiveTab(tab);
          }}
          languageMode={languageMode}
          onLanguageChange={setLanguageMode}
          voiceEngine={voiceEngine}
          onVoiceEngineChange={setVoiceEngine}
          voiceState={evaluatingInterview || diagnosingImage ? 'thinking' : voice.voiceState}
          storageMeta={store.storageMeta}
          p0Count={p0Count}
          pendingRequestCount={pendingRequestCount}
        />

        {/* Global Red P0-CRITICAL Security Escalation Banner */}
        <AnimatePresence>
          {activeSecurityAlert && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="relative z-30 bg-rose-600/20 border-b border-rose-500/50 backdrop-blur-xl"
            >
              <div className="max-w-[1520px] mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="text-xs sm:text-sm">
                    <span className="font-mono font-semibold text-rose-300 mr-2">
                      SECURITY ESCALATION · P0-CRITICAL · {activeSecurityAlert.ticketCode}
                    </span>
                    <span className="text-white">{activeSecurityAlert.title}</span>
                    <span className="hidden md:inline text-rose-200/80 ml-2">
                      — Okta session revocation & Jamf remote wipe queued (§3.1)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportTicketPdf(activeSecurityAlert)}
                    className="px-2.5 py-1 rounded-lg text-xs text-rose-100 bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Incident PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ops')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-400 flex items-center gap-1"
                  >
                    <span>Open SecOps Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSecurityAlert(null)}
                    aria-label="Dismiss alert banner"
                    className="p-1 text-rose-200/80 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative z-10">
          <AnimatePresence mode="wait">
            {activeTab === 'employee' && (
              <motion.div
                key="employee"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <EmployeeDesk
                  languageMode={languageMode}
                  voiceState={voice.voiceState}
                  audioLevel={voice.audioLevel}
                  interimTranscript={voice.interimTranscript}
                  bargeInNotice={voice.bargeInNotice}
                  engineNote={voice.engineNote}
                  micError={voice.micError}
                  messages={messages}
                  actionCards={actionCards}
                  tickets={store.tickets}
                  requests={store.requests}
                  activeEmployeeName={activeEmployeeName}
                  activeDepartment={activeDepartment}
                  simulateSevereAlert={simulateSevereAlert}
                  diagnosingImage={diagnosingImage}
                  onToggleSimulateAlert={() => setSimulateSevereAlert((v) => !v)}
                  onToggleOrb={voice.toggleOrb}
                  onStopSpeaking={voice.stopSpeaking}
                  onSendMessage={handleManualChatSend}
                  onDiagnoseImage={handleDiagnoseImage}
                  onAutoLogVisionTicket={handleAutoLogVisionTicket}
                  onOpenGhostWrite={setGhostWriteContext}
                  onCreateManualTicket={handleManualTicket}
                  onCreateManualRequest={handleManualRequest}
                />
              </motion.div>
            )}

            {activeTab === 'ops' && (
              <motion.div
                key="ops"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <OpsDashboard
                  tickets={store.tickets}
                  requests={store.requests}
                  handbook={store.handbook}
                  storageMeta={store.storageMeta}
                  storeError={store.storeError}
                  authBusy={store.authBusy}
                  onConnectCloud={store.connectGoogleCloud}
                  onDisconnectCloud={store.disconnectGoogleCloud}
                  onSeedCloud={store.seedCloud}
                  onUpdateTicketStatus={store.setTicketStatus}
                  onDeleteTicket={store.removeTicket}
                  onDecideRequest={store.decideRequest}
                  onAddPolicy={store.addHandbookPolicy}
                />
              </motion.div>
            )}

            {activeTab === 'interview' && (
              <motion.div
                key="interview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <InterviewLab
                  voiceState={voice.voiceState}
                  audioLevel={voice.audioLevel}
                  interimTranscript={voice.interimTranscript}
                  bargeInNotice={voice.bargeInNotice}
                  micError={voice.micError}
                  selectedTrackId={selectedTrackId}
                  currentQuestion={currentQuestion}
                  turns={interviewTurns}
                  evaluating={evaluatingInterview}
                  onSelectTrack={handleSelectTrack}
                  onSelectQuestion={setCurrentQuestion}
                  onSpeakQuestion={(q) => void voice.speakText(q)}
                  onToggleOrb={voice.toggleOrb}
                  onSubmitAnswer={(transcript, durationSec) =>
                    handleInterviewSubmission(transcript, durationSec, voice.speakText)
                  }
                  onResetSession={() => setInterviewTurns([])}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Ghost-Write to Manager Modal */}
        <GhostWriteModal
          context={ghostWriteContext}
          languageMode={languageMode}
          onClose={() => setGhostWriteContext(null)}
        />
      </div>
    </ErrorBoundary>
  );
}
