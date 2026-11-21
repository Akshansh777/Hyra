import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';
import { SEED_REQUESTS, SEED_TICKETS } from '../data/corporateSeed';
import type {
  CorporateTicket,
  RequestStatus,
  RequestType,
  TicketCategory,
  TicketPriority,
  TicketSource,
  TicketStatus,
  WorkplaceRequest,
} from '../types/hyra';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const BOOTSTRAP_ADMIN_EMAIL = 'akshanshmishra5@gmail.com';
const LOCAL_TICKETS_KEY = 'hyra_os_tickets_v1';
const LOCAL_REQUESTS_KEY = 'hyra_os_requests_v1';

interface ResolvedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

function resolveFirebaseConfig(): ResolvedFirebaseConfig | null {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || undefined,
    };
  }

  if (
    appletFirebaseConfig &&
    appletFirebaseConfig.apiKey &&
    appletFirebaseConfig.projectId &&
    appletFirebaseConfig.projectId !== 'remixed-project-id'
  ) {
    return {
      apiKey: appletFirebaseConfig.apiKey,
      authDomain: appletFirebaseConfig.authDomain,
      projectId: appletFirebaseConfig.projectId,
      storageBucket: appletFirebaseConfig.storageBucket,
      messagingSenderId: appletFirebaseConfig.messagingSenderId,
      appId: appletFirebaseConfig.appId,
      firestoreDatabaseId: appletFirebaseConfig.firestoreDatabaseId || undefined,
    };
  }

  return null;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let firestoreConfigured = false;

const config = resolveFirebaseConfig();
if (config) {
  try {
    app = initializeApp(config);
    db = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    auth = getAuth(app);
    firestoreConfigured = true;
  } catch (err) {
    console.warn('Firebase init fell back to local storage mode:', err);
  }
}

export function isFirebaseConfigured(): boolean {
  return firestoreConfigured && db !== null && auth !== null;
}

export function isUserAdmin(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === BOOTSTRAP_ADMIN_EMAIL);
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User | null> {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

// Local storage fallback reactive bus
type LocalListener = () => void;
const localListeners = new Set<LocalListener>();

function emitLocalChange() {
  localListeners.forEach((fn) => fn());
}

function readLocalTickets(): CorporateTicket[] {
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(SEED_TICKETS));
      return SEED_TICKETS;
    }
    const parsed = JSON.parse(raw) as CorporateTicket[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_TICKETS;
  } catch {
    return SEED_TICKETS;
  }
}

function writeLocalTickets(tickets: CorporateTicket[]) {
  try {
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(tickets));
  } catch {
    // ignore quota errors
  }
  emitLocalChange();
}

function readLocalRequests(): WorkplaceRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_REQUESTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(SEED_REQUESTS));
      return SEED_REQUESTS;
    }
    const parsed = JSON.parse(raw) as WorkplaceRequest[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_REQUESTS;
  } catch {
    return SEED_REQUESTS;
  }
}

function writeLocalRequests(requests: WorkplaceRequest[]) {
  try {
    localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(requests));
  } catch {
    // ignore quota errors
  }
  emitLocalChange();
}

function normalizeTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function clampString(value: string, min: number, max: number, fallback: string): string {
  const cleaned = value.trim();
  if (cleaned.length < min) return fallback.slice(0, max);
  return cleaned.slice(0, max);
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function makeCode(prefix: 'HYR' | 'REQ'): string {
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${prefix}-${num}`;
}

export function subscribeTickets(
  user: User | null,
  onData: (tickets: CorporateTicket[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !user || !user.emailVerified) {
    const pushLocal = () => onData(readLocalTickets());
    pushLocal();
    localListeners.add(pushLocal);
    return () => {
      localListeners.delete(pushLocal);
    };
  }

  const path = 'tickets';
  const baseRef = collection(db, path);
  const q = isUserAdmin(user)
    ? query(baseRef, orderBy('createdAt', 'desc'))
    : query(baseRef, where('ownerUid', '==', user.uid), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CorporateTicket[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ticketCode: String(data.ticketCode || 'HYR-0000'),
          title: String(data.title || ''),
          summary: String(data.summary || ''),
          category: (data.category as TicketCategory) || 'IT Access',
          priority: (data.priority as TicketPriority) || 'P2',
          status: (data.status as TicketStatus) || 'open',
          employeeName: String(data.employeeName || 'Employee'),
          department: String(data.department || 'Operations'),
          source: (data.source as TicketSource) || 'chat',
          ownerUid: String(data.ownerUid || user.uid),
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeRequests(
  user: User | null,
  onData: (requests: WorkplaceRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !user || !user.emailVerified) {
    const pushLocal = () => onData(readLocalRequests());
    pushLocal();
    localListeners.add(pushLocal);
    return () => {
      localListeners.delete(pushLocal);
    };
  }

  const path = 'requests';
  const baseRef = collection(db, path);
  const q = isUserAdmin(user)
    ? query(baseRef, orderBy('createdAt', 'desc'))
    : query(baseRef, where('ownerUid', '==', user.uid), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkplaceRequest[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          requestCode: String(data.requestCode || 'REQ-0000'),
          type: (data.type as RequestType) || 'WFH',
          title: String(data.title || ''),
          reason: String(data.reason || ''),
          dateRange: String(data.dateRange || 'Upcoming'),
          status: (data.status as RequestStatus) || 'pending',
          employeeName: String(data.employeeName || 'Employee'),
          department: String(data.department || 'Operations'),
          reviewerNote: data.reviewerNote ? String(data.reviewerNote) : undefined,
          ownerUid: String(data.ownerUid || user.uid),
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export interface CreateTicketInput {
  title: string;
  summary: string;
  category: TicketCategory;
  priority: TicketPriority;
  displayPriority?: string;
  sentiment?: 'calm' | 'frustrated' | 'urgent' | 'distressed';
  employeeName: string;
  department: string;
  source: TicketSource;
}

export async function createTicketRecord(
  user: User | null,
  input: CreateTicketInput
): Promise<CorporateTicket> {
  const id = makeDocId('tkt');
  const ticketCode = makeCode('HYR');
  const status: TicketStatus = input.priority === 'P0' ? 'escalated' : 'open';
  const displayPriority = input.displayPriority || (input.priority === 'P0' ? 'P0-CRITICAL' : input.priority);
  const nowIso = new Date().toISOString();

  const cleanTitle = clampString(input.title, 3, 140, 'Corporate Support Ticket');
  const cleanSummary = clampString(input.summary, 5, 1200, 'Logged via Hyra workplace assistant.');
  const cleanEmployee = clampString(input.employeeName, 2, 80, 'Aarav Mehta');
  const cleanDept = clampString(input.department, 2, 60, 'Engineering');

  if (!db || !user || !user.emailVerified) {
    const record: CorporateTicket = {
      id,
      ticketCode,
      title: cleanTitle,
      summary: cleanSummary,
      category: input.category,
      priority: input.priority,
      displayPriority,
      sentiment: input.sentiment,
      status,
      employeeName: cleanEmployee,
      department: cleanDept,
      source: input.source,
      ownerUid: 'seed-local',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const existing = readLocalTickets();
    writeLocalTickets([record, ...existing]);
    return record;
  }

  const path = `tickets/${id}`;
  try {
    await setDoc(doc(db, 'tickets', id), {
      ticketCode,
      title: cleanTitle,
      summary: cleanSummary,
      category: input.category,
      priority: input.priority,
      status,
      employeeName: cleanEmployee,
      department: cleanDept,
      source: input.source,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id,
      ticketCode,
      title: cleanTitle,
      summary: cleanSummary,
      category: input.category,
      priority: input.priority,
      displayPriority,
      sentiment: input.sentiment,
      status,
      employeeName: cleanEmployee,
      department: cleanDept,
      source: input.source,
      ownerUid: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTicketStatus(
  user: User | null,
  ticketId: string,
  status: TicketStatus
): Promise<void> {
  if (!db || !user || !user.emailVerified) {
    const list = readLocalTickets().map((t) =>
      t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t
    );
    writeLocalTickets(list);
    return;
  }

  const path = `tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'tickets', ticketId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTicketRecord(user: User | null, ticketId: string): Promise<void> {
  if (!db || !user || !user.emailVerified) {
    writeLocalTickets(readLocalTickets().filter((t) => t.id !== ticketId));
    return;
  }
  const path = `tickets/${ticketId}`;
  try {
    await deleteDoc(doc(db, 'tickets', ticketId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CreateRequestInput {
  type: RequestType;
  title: string;
  reason: string;
  dateRange: string;
  employeeName: string;
  department: string;
  autoApproved?: boolean;
  reviewerNote?: string;
  calendarConflict?: WorkplaceRequest['calendarConflict'];
  weatherTrigger?: WorkplaceRequest['weatherTrigger'];
}

export async function createRequestRecord(
  user: User | null,
  input: CreateRequestInput
): Promise<WorkplaceRequest> {
  const id = makeDocId('req');
  const requestCode = makeCode('REQ');
  const nowIso = new Date().toISOString();

  const cleanTitle = clampString(input.title, 3, 140, `${input.type} Approval Request`);
  const cleanReason = clampString(input.reason, 5, 1000, 'Submitted via Hyra workplace assistant.');
  const cleanDates = clampString(input.dateRange, 2, 80, 'Upcoming sprint');
  const cleanEmployee = clampString(input.employeeName, 2, 80, 'Aarav Mehta');
  const cleanDept = clampString(input.department, 2, 60, 'Engineering');
  const initialStatus: RequestStatus = input.autoApproved ? 'approved' : 'pending';
  const note = input.autoApproved
    ? input.reviewerNote || 'Auto-Approved via Environmental Trigger (Handbook §2.2)'
    : input.reviewerNote;

  if (!db || !user || !user.emailVerified) {
    const record: WorkplaceRequest = {
      id,
      requestCode,
      type: input.type,
      title: cleanTitle,
      reason: cleanReason,
      dateRange: cleanDates,
      status: initialStatus,
      employeeName: cleanEmployee,
      department: cleanDept,
      reviewerNote: note,
      calendarConflict: input.calendarConflict,
      weatherTrigger: input.weatherTrigger,
      ownerUid: 'seed-local',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    writeLocalRequests([record, ...readLocalRequests()]);
    return record;
  }

  const path = `requests/${id}`;
  try {
    await setDoc(doc(db, 'requests', id), {
      requestCode,
      type: input.type,
      title: cleanTitle,
      reason: cleanReason,
      dateRange: cleanDates,
      status: 'pending',
      employeeName: cleanEmployee,
      department: cleanDept,
      ...(note ? { reviewerNote: note.slice(0, 500) } : {}),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // If auto-approved and user is admin, immediately promote to approved in Firestore
    let resolvedStatus: RequestStatus = 'pending';
    if (input.autoApproved && isUserAdmin(user)) {
      await updateDoc(doc(db, 'requests', id), {
        status: 'approved',
        reviewerNote: (note || 'Auto-Approved via Environmental Trigger (§2.2)').slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      resolvedStatus = 'approved';
    } else if (input.autoApproved) {
      resolvedStatus = 'approved';
    }

    return {
      id,
      requestCode,
      type: input.type,
      title: cleanTitle,
      reason: cleanReason,
      dateRange: cleanDates,
      status: resolvedStatus,
      employeeName: cleanEmployee,
      department: cleanDept,
      reviewerNote: note,
      calendarConflict: input.calendarConflict,
      weatherTrigger: input.weatherTrigger,
      ownerUid: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRequestDecision(
  user: User | null,
  requestId: string,
  status: RequestStatus,
  reviewerNote?: string
): Promise<void> {
  const safeNote = (reviewerNote ?? '').trim().slice(0, 500);
  if (!db || !user || !user.emailVerified) {
    const list = readLocalRequests().map((r) =>
      r.id === requestId
        ? { ...r, status, reviewerNote: safeNote || r.reviewerNote, updatedAt: new Date().toISOString() }
        : r
    );
    writeLocalRequests(list);
    return;
  }

  const path = `requests/${requestId}`;
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      status,
      reviewerNote: safeNote,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedFirestoreRecords(user: User): Promise<void> {
  if (!db || !user.emailVerified) return;
  for (const t of SEED_TICKETS) {
    await createTicketRecord(user, {
      title: t.title,
      summary: t.summary,
      category: t.category,
      priority: t.priority,
      employeeName: t.employeeName,
      department: t.department,
      source: t.source,
    });
  }
  for (const r of SEED_REQUESTS.slice(0, 2)) {
    await createRequestRecord(user, {
      type: r.type,
      title: r.title,
      reason: r.reason,
      dateRange: r.dateRange,
      employeeName: r.employeeName,
      department: r.department,
    });
  }
}
