/**
 * Phase 0 Payload-First Security TDD specification for Hyra Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads against tickets, requests, and admins.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  collection: 'tickets' | 'requests' | 'admins';
  operation: 'create' | 'update' | 'list' | 'get';
  expected: 'PERMISSION_DENIED';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: null,
    docId: 'ticket_unauth_1',
    payload: { title: 'Unauthorized ticket' },
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: 'tickets',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'spoof1', email: 'akshanshmishra5@gmail.com', email_verified: false },
    docId: 'ticket_1',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Ticket Create',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_spoof_3',
    payload: { ownerUid: 'userB', status: 'open' },
  },
  {
    id: 4,
    name: 'Shadow Field Injection',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_ghost_4',
    payload: { ownerUid: 'userA', isVerified: true, status: 'open' },
  },
  {
    id: 5,
    name: 'Path ID Poisoning',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'bad$id/../overflow_' + 'x'.repeat(150),
    payload: { ownerUid: 'userA', status: 'open' },
  },
  {
    id: 6,
    name: 'Resource Exhaustion Oversized Summary',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_large_6',
    payload: { ownerUid: 'userA', summary: 'A'.repeat(50000), status: 'open' },
  },
  {
    id: 7,
    name: 'Client Backdated Timestamp Forgery',
    collection: 'tickets',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_time_7',
    payload: { ownerUid: 'userA', createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 8,
    name: 'Immutable OwnerUid Mutation',
    collection: 'tickets',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_existing_8',
    payload: { ownerUid: 'userC' },
  },
  {
    id: 9,
    name: 'Employee Self-Approval Escalation',
    collection: 'requests',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'req_existing_9',
    payload: { status: 'approved' },
  },
  {
    id: 10,
    name: 'Terminal State Bypass on Resolved Ticket',
    collection: 'tickets',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'ticket_resolved_10',
    payload: { summary: 'Reopening after terminal state' },
  },
  {
    id: 11,
    name: 'Value Poisoning on Status Enum',
    collection: 'tickets',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'admin1', email: 'akshanshmishra5@gmail.com', email_verified: true },
    docId: 'ticket_poison_11',
    payload: { status: 'hacked' },
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Privilege Escalation',
    collection: 'admins',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email: 'a@corp.io', email_verified: true },
    docId: 'userA',
    payload: { grantedAt: new Date().toISOString() },
  },
];
