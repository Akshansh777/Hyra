import type { CorporateTicket, HandbookPolicy, WorkplaceRequest } from '../types/hyra';
import { COMPANY_HANDBOOK } from './handbook.js';

export const SEED_TICKETS: CorporateTicket[] = [
  {
    id: 'seed_ticket_p0_01',
    ticketCode: 'HYR-9041',
    title: 'Suspicious Okta MFA push & lost MacBook Pro reported at BLR airport',
    summary:
      'Employee reported misplaced corporate MacBook Pro M3 at Kempegowda International Airport lounge followed by 2 unrecognized MFA push prompts. Okta sessions flagged for immediate revocation and Jamf remote wipe queued.',
    category: 'Security',
    priority: 'P0',
    displayPriority: 'P0-CRITICAL',
    sentiment: 'urgent',
    status: 'escalated',
    employeeName: 'Rhea Deshmukh',
    department: 'Cloud Infrastructure',
    source: 'voice',
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'seed_ticket_it_02',
    ticketCode: 'HYR-9038',
    title: 'WireGuard VPN returning 403 Forbidden after macOS 15.3 security patch',
    summary:
      'Unable to connect to staging Kubernetes cluster via WireGuard VPN tunnel after overnight OS patch. Split-DNS resolver drops internal .corp lookups.',
    category: 'IT Access',
    priority: 'P1',
    displayPriority: 'P1',
    sentiment: 'frustrated',
    status: 'in_progress',
    employeeName: 'Kabir Nair',
    department: 'Platform Engineering',
    source: 'voice',
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: 'seed_ticket_hw_03',
    ticketCode: 'HYR-9034',
    title: 'Hardware Replacement — Faulty USB-C Thunderbolt dock & flickering display',
    summary:
      'External 4K monitor flickers every 5 minutes when connected via USB-C hub during product demos. Replacement CalDigit TS4 requested under Handbook §4.1.',
    category: 'Hardware',
    priority: 'P2',
    displayPriority: 'P2',
    sentiment: 'calm',
    status: 'open',
    employeeName: 'Ananya Sen',
    department: 'Product Design',
    source: 'chat',
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
  },
];

export const SEED_REQUESTS: WorkplaceRequest[] = [
  {
    id: 'seed_req_wfh_01',
    requestCode: 'REQ-4412',
    type: 'WFH',
    title: 'Remote work approval — Tomorrow (Deep focus sprint)',
    reason:
      'Completing Q4 API latency benchmarks and architecture RFC without commute disruption; fully available on Slack and Zoom core hours.',
    dateRange: 'Tomorrow',
    status: 'pending',
    employeeName: 'Aarav Mehta',
    department: 'Platform Engineering',
    calendarConflict: {
      hasConflict: true,
      count: 2,
      dateLabel: 'tomorrow',
      summary: '2 teammates are already off/remote on tomorrow: Priya Verma (PTO), Rohan Kapoor (PTO)',
      teammates: [
        { name: 'Priya Verma', role: 'Staff Backend', status: 'PTO', note: 'Planned family leave' },
        { name: 'Rohan Kapoor', role: 'Senior Frontend', status: 'PTO', note: 'Out of office (Jaipur)' },
      ],
    },
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'seed_req_eq_02',
    requestCode: 'REQ-4409',
    type: 'Equipment',
    title: 'Hardware Replacement — Noise-cancelling headset & YubiKey 5C NFC spare',
    reason:
      'Onboarding into on-call incident rotation; requires backup FIDO2 hardware security key and ANC headset for war-room triage.',
    dateRange: 'Standard 48h IT fulfillment',
    status: 'pending',
    employeeName: 'Meera Krishnan',
    department: 'Site Reliability',
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
  {
    id: 'seed_req_pto_03',
    requestCode: 'REQ-4404',
    type: 'PTO',
    title: 'Annual recharge leave (3 days)',
    reason: 'Family travel to Coorg; handoff checklist completed with sprint lead.',
    dateRange: 'Dec 07 – Dec 09, 2026',
    status: 'approved',
    employeeName: 'Vikram Joshi',
    department: 'Data Science',
    reviewerNote: 'Approved — handoff confirmed on Jira board.',
    ownerUid: 'seed-local',
    createdAt: new Date(Date.now() - 1000 * 60 * 620).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
  },
];

export const INITIAL_HANDBOOK: HandbookPolicy[] = COMPANY_HANDBOOK as HandbookPolicy[];

export const QUICK_PROMPTS: Record<'EN' | 'HINGLISH', { label: string; prompt: string }[]> = {
  EN: [
    {
      label: 'Noida AQI / Rain WFH',
      prompt: 'Heavy rain and bad AQI in Noida today — can Hyra check weather WFH auto-approval for me?',
    },
    {
      label: 'Leave Tomorrow (Conflict)',
      prompt: 'Please request a WFH day for me tomorrow to finish the Q4 API RFC.',
    },
    {
      label: 'Lost Laptop (P0)',
      prompt: 'My work MacBook was stolen at the airport and I just got an unknown MFA login prompt!',
    },
    {
      label: 'Reimbursement & Timings',
      prompt: 'What is our L&D stipend, late-night cab reimbursement, and core office timings policy?',
    },
  ],
  HINGLISH: [
    {
      label: 'Noida AQI / Barish WFH',
      prompt: 'Noida mein aaj bahut heavy rain aur severe AQI hai — please weather check karke mera WFH auto-approve kar do.',
    },
    {
      label: 'Kal WFH (Conflict)',
      prompt: 'Hyra, kal ke liye mera WFH request daal do, Q4 sprint RFC wrap up karna hai.',
    },
    {
      label: 'Laptop Chori (P0)',
      prompt: 'Mera office laptop airport par chori ho gaya hai aur unknown MFA alert aa raha hai, jaldi P0 security escalate karo!',
    },
    {
      label: 'Timings & Stipend',
      prompt: 'Humari office core timings, late night cab reimbursement aur L&D budget policy kya hai?',
    },
  ],
};

export interface InterviewTrack {
  id: string;
  role: string;
  focus: string;
  questions: string[];
}

export const INTERVIEW_TRACKS: InterviewTrack[] = [
  {
    id: 'frontend',
    role: 'Senior Frontend Engineer',
    focus: 'React concurrency, performance & design systems',
    questions: [
      'Walk me through a production frontend performance bottleneck you diagnosed and how you measured the improvement.',
      'How would you architect real-time optimistic updates with conflict resolution in a collaborative dashboard?',
      'Tell me about a time you pushed back on a product spec to protect accessibility or long-term maintainability.',
    ],
  },
  {
    id: 'backend',
    role: 'Staff Backend Systems Engineer',
    focus: 'Distributed systems, API resilience & observability',
    questions: [
      'Design an idempotent webhook ingestion pipeline that handles 50,000 events per second with zero data loss.',
      'Describe a P0 production outage you led through triage, mitigation, and post-mortem prevention.',
      'How do you decide between strong consistency and eventual consistency when scaling multi-region microservices?',
    ],
  },
  {
    id: 'pm',
    role: 'Principal Product Manager',
    focus: 'AI product strategy, prioritization & metrics',
    questions: [
      'How would you define success metrics and guardrails for an autonomous AI workplace helpdesk rollout?',
      'Tell me about a high-stakes roadmap tradeoff where engineering capacity forced you to cut a flagship feature.',
      'How do you diagnose whether a drop in user retention is an onboarding UX problem or a core value gap?',
    ],
  },
  {
    id: 'security',
    role: 'Lead Security Engineer',
    focus: 'Zero-trust IAM, incident response & threat modeling',
    questions: [
      'An engineer reports a stolen laptop and suspicious Okta MFA fatigue prompts. Walk through your first 15 minutes.',
      'How do you enforce least-privilege database security rules without slowing down product engineering velocity?',
      'Explain how you would threat-model a voice-driven AI assistant connected to internal HR and IT APIs.',
    ],
  },
];
