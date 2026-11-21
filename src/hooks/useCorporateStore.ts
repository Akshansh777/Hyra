import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { INITIAL_HANDBOOK } from '../data/corporateSeed';
import {
  createRequestRecord,
  createTicketRecord,
  deleteTicketRecord,
  isFirebaseConfigured,
  isUserAdmin,
  seedFirestoreRecords,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuthState,
  subscribeRequests,
  subscribeTickets,
  updateRequestDecision,
  updateTicketStatus,
  type CreateRequestInput,
  type CreateTicketInput,
} from '../services/firebase';
import type {
  CorporateTicket,
  HandbookPolicy,
  RequestStatus,
  StorageMeta,
  TicketStatus,
  WorkplaceRequest,
} from '../types/hyra';

const HANDBOOK_STORAGE_KEY = 'hyra_os_handbook_v2';

function loadInitialHandbook(): HandbookPolicy[] {
  try {
    const raw = localStorage.getItem(HANDBOOK_STORAGE_KEY);
    if (!raw) return INITIAL_HANDBOOK;
    const parsed = JSON.parse(raw) as HandbookPolicy[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_HANDBOOK;
  } catch {
    return INITIAL_HANDBOOK;
  }
}

export function useCorporateStore() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tickets, setTickets] = useState<CorporateTicket[]>([]);
  const [requests, setRequests] = useState<WorkplaceRequest[]>([]);
  const [handbook, setHandbook] = useState<HandbookPolicy[]>(loadInitialHandbook);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuthState((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setStoreError(null);

    const unsubTickets = subscribeTickets(
      user,
      (list) => setTickets(list),
      (err) => setStoreError(err.message)
    );
    const unsubRequests = subscribeRequests(
      user,
      (list) => setRequests(list),
      (err) => setStoreError(err.message)
    );

    return () => {
      unsubTickets();
      unsubRequests();
    };
  }, [authReady, user]);

  const storageMeta: StorageMeta = useMemo(
    () => ({
      mode: isFirebaseConfigured() && user && user.emailVerified ? 'firestore' : 'local',
      userEmail: user?.email ?? null,
      userName: user?.displayName ?? null,
      userUid: user?.uid ?? null,
      isAdmin: isUserAdmin(user),
      firestoreReady: isFirebaseConfigured(),
    }),
    [user]
  );

  const connectGoogleCloud = useCallback(async () => {
    setAuthBusy(true);
    setStoreError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : 'Google sign-in cancelled.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const disconnectGoogleCloud = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOutGoogle();
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const addTicket = useCallback(
    async (input: CreateTicketInput) => {
      return createTicketRecord(user, input);
    },
    [user]
  );

  const setTicketStatus = useCallback(
    async (ticketId: string, status: TicketStatus) => {
      await updateTicketStatus(user, ticketId, status);
    },
    [user]
  );

  const removeTicket = useCallback(
    async (ticketId: string) => {
      await deleteTicketRecord(user, ticketId);
    },
    [user]
  );

  const addRequest = useCallback(
    async (input: CreateRequestInput) => {
      return createRequestRecord(user, input);
    },
    [user]
  );

  const decideRequest = useCallback(
    async (requestId: string, status: RequestStatus, reviewerNote?: string) => {
      await updateRequestDecision(user, requestId, status, reviewerNote);
    },
    [user]
  );

  const seedCloud = useCallback(async () => {
    if (!user) return;
    await seedFirestoreRecords(user);
  }, [user]);

  const addHandbookPolicy = useCallback((policy: Omit<HandbookPolicy, 'id' | 'updatedAt'>) => {
    setHandbook((prev) => {
      const customCount = prev.filter((p) => p.section?.startsWith('§7.')).length;
      const next: HandbookPolicy = {
        ...policy,
        id: `hb_custom_${Date.now()}`,
        section: policy.section || `§7.${customCount + 1}`,
        updatedAt: 'Just now',
      };
      const updated = [next, ...prev];
      try {
        localStorage.setItem(HANDBOOK_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return {
    tickets,
    requests,
    handbook,
    storageMeta,
    storeError,
    authBusy,
    connectGoogleCloud,
    disconnectGoogleCloud,
    addTicket,
    setTicketStatus,
    removeTicket,
    addRequest,
    decideRequest,
    seedCloud,
    addHandbookPolicy,
  };
}
