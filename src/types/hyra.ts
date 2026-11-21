export type RoleTab = 'employee' | 'ops' | 'interview';
export type LanguageMode = 'EN' | 'HINGLISH';
export type VoiceEngine = 'elevenlabs' | 'browser';
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type TicketCategory = 'Security' | 'IT Access' | 'Hardware' | 'Payroll' | 'Facilities';
export type TicketPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved';
export type TicketSource = 'voice' | 'chat' | 'manual';

export interface CorporateTicket {
  id: string;
  ticketCode: string;
  title: string;
  summary: string;
  category: TicketCategory;
  priority: TicketPriority;
  displayPriority?: string; // e.g., "P0-CRITICAL"
  sentiment?: 'calm' | 'frustrated' | 'urgent' | 'distressed';
  status: TicketStatus;
  employeeName: string;
  department: string;
  source: TicketSource;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestType = 'WFH' | 'PTO' | 'Equipment' | 'Travel' | 'Access';
export type RequestStatus = 'pending' | 'approved' | 'declined';

export interface CalendarConflictInfo {
  hasConflict: boolean;
  count: number;
  dateLabel: string;
  summary: string;
  teammates: { name: string; role: string; status: string; note: string }[];
}

export interface WeatherTelemetry {
  city: string;
  aqi: number;
  aqiLabel: string;
  rainMmPerHr: number;
  temperatureC: number;
  condition: string;
  autoApproved: boolean;
  simulated: boolean;
  triggerReason: string;
}

export interface WorkplaceRequest {
  id: string;
  requestCode: string;
  type: RequestType;
  title: string;
  reason: string;
  dateRange: string;
  status: RequestStatus;
  employeeName: string;
  department: string;
  reviewerNote?: string;
  calendarConflict?: CalendarConflictInfo;
  weatherTrigger?: WeatherTelemetry;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface HandbookPolicy {
  id: string;
  section?: string;
  title: string;
  category:
    | 'Security'
    | 'Remote Work'
    | 'IT & Access'
    | 'Leave & Benefits'
    | 'Expenses'
    | 'Hardware'
    | 'Office Timings';
  summary: string;
  details: string;
  sla: string;
  updatedAt: string;
  keywords?: string[];
}

export type HyraActionType =
  | 'NONE'
  | 'CREATE_TICKET'
  | 'ESCALATE_P0'
  | 'CREATE_REQUEST'
  | 'WEATHER_WFH_APPROVAL'
  | 'POLICY_ANSWER'
  | 'VISION_DIAGNOSIS';

export interface VisionDiagnosis {
  id: string;
  imagePreviewUrl: string;
  detectedError: string;
  category: TicketCategory;
  priority: TicketPriority;
  twoStepFix: [string, string];
  spokenDiagnosis: string;
  recommendedTicketTitle: string;
  handbookCitation?: string;
  loggedTicketCode?: string;
}

export interface DeskMessage {
  id: string;
  role: 'user' | 'hyra';
  text: string;
  timestamp: string;
  actionType?: HyraActionType;
  linkedRecordCode?: string;
  policyCitation?: string;
  handbookSection?: string;
  interrupted?: boolean;
  imagePreviewUrl?: string;
}

export interface DeskActionCard {
  id: string;
  kind: 'ticket' | 'escalation' | 'request' | 'policy' | 'weather_wfh' | 'vision';
  code: string;
  title: string;
  subtitle: string;
  status: string;
  priority?: TicketPriority;
  displayPriority?: string;
  sentiment?: string;
  category?: string;
  requestType?: RequestType;
  dateRange?: string;
  handbookCitation?: string;
  calendarConflict?: CalendarConflictInfo;
  weatherTrigger?: WeatherTelemetry;
  visionDiagnosis?: VisionDiagnosis;
  timestamp: string;
  details: string;
}

export interface GhostWriteContext {
  recordCode: string;
  kind: 'leave_wfh' | 'hardware';
  title: string;
  dateRange?: string;
  reason: string;
  status: string;
  employeeName: string;
  department: string;
  calendarConflictSummary?: string;
  weatherTriggerSummary?: string;
}

export interface GhostWriteDraft {
  slackMessage: string;
  emailSubject: string;
  emailBody: string;
}

export interface InterviewTurn {
  id: string;
  turnNumber: number;
  question: string;
  transcript: string;
  durationSec: number;
  wpm: number;
  fillerCount: number;
  clarityScore: number;
  technicalDepth: number;
  structureScore: number;
  confidenceScore: number;
  strengths: string[];
  improvements: string[];
  coachReply: string;
  followUpQuestion: string;
  timestamp: string;
}

export interface StorageMeta {
  mode: 'firestore' | 'local';
  userEmail: string | null;
  userName: string | null;
  userUid: string | null;
  isAdmin: boolean;
  firestoreReady: boolean;
}
