import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  Cloud,
  CloudOff,
  Database,
  Download,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { exportTicketPdf } from '../services/pdfExport';
import type {
  CorporateTicket,
  HandbookPolicy,
  RequestStatus,
  StorageMeta,
  TicketPriority,
  TicketStatus,
  WorkplaceRequest,
} from '../types/hyra';

interface OpsDashboardProps {
  tickets: CorporateTicket[];
  requests: WorkplaceRequest[];
  handbook: HandbookPolicy[];
  storageMeta: StorageMeta;
  storeError: string | null;
  authBusy: boolean;
  onConnectCloud: () => Promise<void>;
  onDisconnectCloud: () => Promise<void>;
  onSeedCloud: () => Promise<void>;
  onUpdateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  onDecideRequest: (requestId: string, status: RequestStatus, note?: string) => Promise<void>;
  onAddPolicy: (policy: Omit<HandbookPolicy, 'id' | 'updatedAt'>) => void;
}

type OpsSubTab = 'tickets' | 'approvals' | 'handbook';

export function OpsDashboard({
  tickets,
  requests,
  handbook,
  storageMeta,
  storeError,
  authBusy,
  onConnectCloud,
  onDisconnectCloud,
  onSeedCloud,
  onUpdateTicketStatus,
  onDeleteTicket,
  onDecideRequest,
  onAddPolicy,
}: OpsDashboardProps) {
  const [subTab, setSubTab] = useState<OpsSubTab>('tickets');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
  const [seeding, setSeeding] = useState(false);

  // Add policy inline form
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyCategory, setPolicyCategory] = useState<HandbookPolicy['category']>('Remote Work');
  const [policySummary, setPolicySummary] = useState('');
  const [policyDetails, setPolicyDetails] = useState('');
  const [policySla, setPolicySla] = useState('24h SLA');

  const p0Escalations = useMemo(
    () => tickets.filter((t) => t.priority === 'P0' && t.status !== 'resolved'),
    [tickets]
  );

  const openTicketCount = useMemo(
    () => tickets.filter((t) => t.status !== 'resolved').length,
    [tickets]
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        t.ticketCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.employeeName.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tickets, searchQuery, priorityFilter]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (!q) return true;
      return (
        r.requestCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.employeeName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [requests, searchQuery]);

  const filteredHandbook = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return handbook.filter((h) => {
      if (!q) return true;
      return (
        h.title.toLowerCase().includes(q) ||
        h.category.toLowerCase().includes(q) ||
        h.details.toLowerCase().includes(q)
      );
    });
  }, [handbook, searchQuery]);

  const handleSeedCloud = async () => {
    setSeeding(true);
    try {
      await onSeedCloud();
    } finally {
      setSeeding(false);
    }
  };

  const handleAddPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyTitle.trim() || !policyDetails.trim()) return;
    onAddPolicy({
      title: policyTitle.trim(),
      category: policyCategory,
      summary: policySummary.trim() || policyDetails.trim().slice(0, 95),
      details: policyDetails.trim(),
      sla: policySla.trim() || '24h SLA',
    });
    setPolicyTitle('');
    setPolicySummary('');
    setPolicyDetails('');
    setShowAddPolicy(false);
  };

  return (
    <div className="max-w-[1520px] mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Ops Header & Cloud Sync Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Operations & Security Command
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time queue across IT tickets, P0 escalations, WFH approvals, and company handbook rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/[0.08] text-xs font-mono text-slate-300">
            {storageMeta.mode === 'firestore' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Firestore Live · {storageMeta.userEmail}</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-cyan-400" />
                <span>Local Fallback Active (Pre-seeded)</span>
              </>
            )}
          </div>

          {storageMeta.firestoreReady && storageMeta.mode === 'local' && (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onConnectCloud()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#3DF3FF] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {authBusy ? 'Connecting...' : 'Sign In for Cloud Firestore'}
            </button>
          )}

          {storageMeta.mode === 'firestore' && (
            <>
              {tickets.length === 0 && requests.length === 0 && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => void handleSeedCloud()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6366F1]/25 text-indigo-200 border border-[#6366F1]/40 hover:bg-[#6366F1]/35 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{seeding ? 'Seeding...' : 'Seed 3 Corporate Records'}</span>
                </button>
              )}
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onDisconnectCloud()}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-white/[0.05] border border-white/10 whitespace-nowrap"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {storeError && (
        <div className="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/35 text-xs text-rose-200 font-mono break-words">
          Firestore Notice: {storeError}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Tickets',
            value: openTicketCount,
            sub: `${tickets.length} total logged`,
            accent: 'text-[#00F0FF]',
          },
          {
            label: 'P0 Security Escalations',
            value: p0Escalations.length,
            sub: p0Escalations.length > 0 ? 'Immediate triage required' : 'Zero critical threats',
            accent: p0Escalations.length > 0 ? 'text-rose-400' : 'text-emerald-400',
          },
          {
            label: 'Pending Approvals',
            value: pendingRequests.length,
            sub: `${requests.length} total WFH & PTO`,
            accent: pendingRequests.length > 0 ? 'text-amber-300' : 'text-emerald-400',
          },
          {
            label: 'Handbook Policies',
            value: handbook.length,
            sub: 'Synced to Hyra AI context',
            accent: 'text-indigo-300',
          },
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-xl p-4 space-y-1.5">
            <p className="text-xs text-slate-400">{metric.label}</p>
            <p className={`text-2xl font-semibold font-mono tabular-nums ${metric.accent}`}>
              {metric.value}
            </p>
            <p className="text-xs text-slate-500">{metric.sub}</p>
          </div>
        ))}
      </div>

      {/* P0 Security Escalations Priority Panel */}
      {p0Escalations.length > 0 && (
        <section className="rounded-2xl p-5 bg-rose-500/[0.07] border border-rose-500/35 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Active P0 Security Escalations ({p0Escalations.length})
                </h2>
                <p className="text-xs text-rose-200/80">
                  15-minute SecOps SLA — Okta session revocation & MDM containment queue.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {p0Escalations.map((item) => (
              <motion.article
                key={item.id}
                layout
                className="rounded-xl p-4 bg-[#070B14]/75 border border-rose-500/25 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-rose-300">
                    <span>{item.ticketCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>P0 Critical</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{item.employeeName}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{item.summary}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportTicketPdf(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center gap-1.5"
                    >
                      <Download className="w-3 h-3" />
                      <span>Incident PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onUpdateTicketStatus(item.id, 'resolved')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 hover:bg-emerald-500/30 transition-colors"
                    >
                      Contain & Resolve
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* Main Ops Console Container */}
      <section className="glass-panel rounded-2xl overflow-hidden">
        {/* Sub-navigation & Search Bar */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/[0.08] w-fit">
            {(
              [
                { id: 'tickets', label: `Tickets Queue (${tickets.length})` },
                { id: 'approvals', label: `WFH & Approvals (${requests.length})` },
                { id: 'handbook', label: `Company Handbook (${handbook.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  subTab === tab.id
                    ? 'bg-white/[0.11] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {subTab === 'tickets' && (
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900/80 border border-white/[0.08]">
                {(['ALL', 'P0', 'P1', 'P2', 'P3'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors ${
                      priorityFilter === p
                        ? 'bg-[#00F0FF]/18 text-[#00F0FF]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, person, policy..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#070B14] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]/60 w-56"
              />
            </div>

            {subTab === 'handbook' && (
              <button
                type="button"
                onClick={() => setShowAddPolicy((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00F0FF] text-[#070B14] hover:bg-[#3BF4FF] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Policy</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: REAL-TIME TICKETS TABLE */}
        {subTab === 'tickets' && (
          <div className="overflow-x-auto">
            {filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                No tickets match the current filter. Voice or chat tickets raised in Employee Desk appear here immediately.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.07] text-[11px] font-mono text-slate-400">
                    <th className="py-3 px-5 font-medium">Ticket ID</th>
                    <th className="py-3 px-4 font-medium">Priority</th>
                    <th className="py-3 px-4 font-medium">Issue & Reporter</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs text-[#00F0FF] whitespace-nowrap tabular-nums">
                        {t.ticketCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                        <span
                          className={
                            t.priority === 'P0'
                              ? 'text-rose-400 font-semibold'
                              : t.priority === 'P1'
                              ? 'text-amber-300 font-medium'
                              : 'text-slate-300'
                          }
                        >
                          {t.displayPriority || (t.priority === 'P0' ? 'P0-CRITICAL' : t.priority)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="font-medium text-slate-100 leading-snug">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.summary}</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-1">
                          {t.employeeName} · {t.department} · via {t.source}
                          {t.sentiment ? ` · tone: ${t.sentiment}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300 whitespace-nowrap">
                        {t.category}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono whitespace-nowrap">
                        <span
                          className={
                            t.status === 'resolved'
                              ? 'text-emerald-400'
                              : t.status === 'escalated'
                              ? 'text-rose-400'
                              : t.status === 'in_progress'
                              ? 'text-[#00F0FF]'
                              : 'text-amber-300'
                          }
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {t.status !== 'in_progress' && t.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => void onUpdateTicketStatus(t.id, 'in_progress')}
                              className="px-2.5 py-1 rounded-md text-xs text-cyan-200 bg-[#00F0FF]/12 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/25 transition-colors"
                            >
                              Triage
                            </button>
                          )}
                          {t.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => void onUpdateTicketStatus(t.id, 'resolved')}
                              className="px-2.5 py-1 rounded-md text-xs text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/25 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => exportTicketPdf(t)}
                            title="Export PDF Pass"
                            className="p-1.5 rounded-md text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.09]"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteTicket(t.id)}
                            title="Delete ticket"
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 bg-white/[0.04] hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: WFH & WORKPLACE APPROVALS */}
        {subTab === 'approvals' && (
          <div className="divide-y divide-white/[0.07]">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                No workplace requests found.
              </div>
            ) : (
              filteredRequests.map((req) => (
                <article
                  key={req.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                      <span className="text-indigo-300">{req.requestCode}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-200">{req.type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.dateRange}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          req.status === 'approved'
                            ? 'text-emerald-400 font-medium'
                            : req.status === 'declined'
                            ? 'text-rose-400 font-medium'
                            : 'text-amber-300 font-medium'
                        }
                      >
                        {req.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{req.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{req.reason}</p>
                    {req.weatherTrigger?.autoApproved && (
                      <p className="text-xs font-mono text-emerald-300">
                        Auto-Approved via Environmental Trigger · AQI {req.weatherTrigger.aqi} · Rain {req.weatherTrigger.rainMmPerHr} mm/hr
                      </p>
                    )}
                    {req.calendarConflict?.hasConflict && (
                      <p className="text-xs font-mono text-amber-300">
                        Calendar Conflict Warning · {req.calendarConflict.summary}
                      </p>
                    )}
                    <p className="text-[11px] font-mono text-slate-500">
                      {req.employeeName} · {req.department}
                      {req.reviewerNote ? ` · Note: ${req.reviewerNote}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void onDecideRequest(req.id, 'approved', 'Approved by Ops Admin')
                          }
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onDecideRequest(req.id, 'declined', 'Declined — please reschedule')
                          }
                          className="px-3.5 py-2 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25 transition-colors flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onDecideRequest(req.id, 'pending', 'Reopened for review')}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/[0.04] border border-white/10"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* TAB 3: COMPANY HANDBOOK KNOWLEDGE BASE */}
        {subTab === 'handbook' && (
          <div className="p-5 space-y-4">
            {showAddPolicy && (
              <form
                onSubmit={handleAddPolicy}
                className="rounded-xl p-4 bg-slate-900/80 border border-[#00F0FF]/25 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Add Handbook Policy (Live Hyra RAG)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddPolicy(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    required
                    value={policyTitle}
                    onChange={(e) => setPolicyTitle(e.target.value)}
                    placeholder="Policy title (e.g. AI Tooling Usage Policy)"
                    className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                  />
                  <select
                    value={policyCategory}
                    onChange={(e) => setPolicyCategory(e.target.value as HandbookPolicy['category'])}
                    className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#00F0FF]"
                  >
                    <option value="Security">Security</option>
                    <option value="Remote Work">Remote Work</option>
                    <option value="IT & Access">IT & Access</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Leave & Benefits">Leave & Benefits</option>
                    <option value="Expenses">Expenses</option>
                    <option value="Office Timings">Office Timings</option>
                  </select>
                  <input
                    value={policySummary}
                    onChange={(e) => setPolicySummary(e.target.value)}
                    placeholder="One-line executive summary"
                    className="sm:col-span-2 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                  />
                  <input
                    value={policySla}
                    onChange={(e) => setPolicySla(e.target.value)}
                    placeholder="SLA (e.g. 24h Ops review)"
                    className="bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                  />
                  <textarea
                    required
                    rows={3}
                    value={policyDetails}
                    onChange={(e) => setPolicyDetails(e.target.value)}
                    placeholder="Full policy guidelines Hyra should cite when employees ask..."
                    className="sm:col-span-3 bg-[#070B14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPolicy(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#00F0FF] text-[#070B14] hover:bg-[#40F5FF]"
                  >
                    Publish to Hyra Brain
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHandbook.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl p-4 bg-white/[0.025] border border-white/[0.08] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1.5 text-[#00F0FF]">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>
                        {item.section ? `${item.section} · ` : ''}
                        {item.category}
                      </span>
                    </span>
                    <span>
                      {item.sla} · {item.updatedAt}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="text-xs text-slate-200 font-medium">{item.summary}</p>
                  <p className="text-xs text-slate-400 leading-relaxed pt-1">{item.details}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
