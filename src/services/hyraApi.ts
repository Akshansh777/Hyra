import { retrieveHandbookChunks } from '../data/handbook.js';
import type {
  CalendarConflictInfo,
  GhostWriteContext,
  GhostWriteDraft,
  HandbookPolicy,
  HyraActionType,
  LanguageMode,
  RequestType,
  TicketCategory,
  TicketPriority,
  WeatherTelemetry,
} from '../types/hyra';

export interface HyraRespondRequest {
  message: string;
  history: { role: 'user' | 'hyra'; text: string }[];
  languageMode: LanguageMode;
  handbook: HandbookPolicy[];
  employeeName: string;
  department: string;
  simulateSevereAlert: boolean;
}

export interface HyraRespondResult {
  reply: string;
  actionType: HyraActionType;
  handbookCitation?: string;
  policyCitation?: string;
  securityEscalation?: boolean;
  ticketPayload?: {
    title: string;
    summary: string;
    category: TicketCategory;
    priority: TicketPriority;
    displayPriority?: string;
    sentiment?: 'calm' | 'frustrated' | 'urgent' | 'distressed';
  };
  requestPayload?: {
    type: RequestType;
    title: string;
    reason: string;
    dateRange: string;
    autoApproved?: boolean;
  };
  calendarConflict?: CalendarConflictInfo;
  weatherTelemetry?: WeatherTelemetry;
}

export async function requestHyraResponse(payload: HyraRespondRequest): Promise<HyraRespondResult> {
  // Fast client-side semantic/keyword chunk retrieval from the 15-section Company Handbook
  const normalizedHandbook = payload.handbook.map((entry) => ({
    ...entry,
    section: entry.section || '§7.0',
    keywords: entry.keywords || [],
  }));
  const retrievedChunks = retrieveHandbookChunks(payload.message, normalizedHandbook, 3);

  const res = await fetch('/api/hyra/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: payload.message,
      history: payload.history,
      languageMode: payload.languageMode,
      retrievedChunks,
      employeeName: payload.employeeName,
      department: payload.department,
      simulateSevereAlert: payload.simulateSevereAlert,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Hyra assistant request failed.');
  }
  return data as HyraRespondResult;
}

export interface VisionDiagnoseResult {
  detectedError: string;
  category: TicketCategory;
  priority: TicketPriority;
  twoStepFix: [string, string];
  spokenDiagnosis: string;
  recommendedTicketTitle: string;
  handbookSection: string;
}

export async function diagnoseHardwareImage(params: {
  imageBase64: string;
  mimeType: string;
  note?: string;
  languageMode: LanguageMode;
}): Promise<VisionDiagnoseResult> {
  const res = await fetch('/api/hyra/diagnose-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Snap & Fix image diagnosis failed.');
  }
  const steps = Array.isArray(data.twoStepFix) ? data.twoStepFix : [];
  return {
    detectedError: String(data.detectedError || 'Unrecognized Workstation Error'),
    category: (data.category as TicketCategory) || 'Hardware',
    priority: (data.priority as TicketPriority) || 'P1',
    twoStepFix: [
      String(steps[0] || 'Restart device and verify network/power cable seating.'),
      String(steps[1] || 'Auto-log IT ticket with this screenshot for Genius Bar swap.'),
    ],
    spokenDiagnosis: String(data.spokenDiagnosis || 'I diagnosed the screenshot and prepared a 2-step fix.'),
    recommendedTicketTitle: String(data.recommendedTicketTitle || 'Snap & Fix Hardware/IT Diagnosis'),
    handbookSection: String(data.handbookSection || 'Handbook §4.1'),
  };
}

export async function generateGhostWriteDraft(
  ctx: GhostWriteContext,
  languageMode: LanguageMode
): Promise<GhostWriteDraft> {
  const res = await fetch('/api/hyra/ghost-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ctx, languageMode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Ghost-Write draft generation failed.');
  }
  return data as GhostWriteDraft;
}

export interface InterviewEvaluateRequest {
  role: string;
  question: string;
  transcript: string;
  durationSec: number;
  fillerCount: number;
  wpm: number;
  languageMode: LanguageMode;
}

export interface InterviewEvaluateResult {
  clarityScore: number;
  technicalDepth: number;
  structureScore: number;
  confidenceScore: number;
  strengths: string[];
  improvements: string[];
  coachReply: string;
  followUpQuestion: string;
}

export async function evaluateInterviewTurn(
  payload: InterviewEvaluateRequest
): Promise<InterviewEvaluateResult> {
  const res = await fetch('/api/interview/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Interview evaluation failed.');
  }
  return data as InterviewEvaluateResult;
}
