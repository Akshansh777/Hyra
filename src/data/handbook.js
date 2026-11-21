// 15-section structured Company Handbook with fast semantic/keyword chunk retrieval

export const COMPANY_HANDBOOK = [
  {
    id: 'hb-1-1',
    section: '§1.1',
    title: 'Annual & Earned Leave Policy',
    category: 'Leave & Benefits',
    sla: 'Same-day HR ack',
    updatedAt: 'Nov 2026',
    keywords: [
      'leave', 'pto', 'vacation', 'annual', 'earned', 'holiday', 'chutti', 'off', 'carry forward', 'days',
    ],
    summary: '24 paid annual leaves per calendar year with up to 10 days carry-forward.',
    details:
      'Full-time employees accrue 24 days of Paid Earned Leave annually (2 days/month), with up to 10 unused days automatically carried forward into the next year. Planned leaves of 3+ consecutive days should be logged via Hyra at least 5 business days prior after checking squad calendar overlap.',
  },
  {
    id: 'hb-1-2',
    section: '§1.2',
    title: 'Sick, Wellness & Mental Health Leave',
    category: 'Leave & Benefits',
    sla: 'Instant auto-log',
    updatedAt: 'Nov 2026',
    keywords: [
      'sick', 'medical', 'fever', 'doctor', 'wellness', 'mental', 'health', 'tabiyat', 'bimar', 'rest',
    ],
    summary: '12 no-questions-asked wellness/sick days; medical certificate only required beyond 3 consecutive days.',
    details:
      'Every employee receives 12 paid Sick & Wellness days per year usable for physical illness, medical appointments, or mental health recharge. No medical note is required for absences of 1–3 consecutive days. Notify your squad via Hyra Ghost-Write before 10:30 AM IST.',
  },
  {
    id: 'hb-1-3',
    section: '§1.3',
    title: 'Parental, Bereavement & Caregiver Leave',
    category: 'Leave & Benefits',
    sla: '24h People Ops',
    updatedAt: 'Oct 2026',
    keywords: [
      'maternity', 'paternity', 'parental', 'baby', 'adoption', 'bereavement', 'family', 'caregiver',
    ],
    summary: '26 weeks maternity, 6 weeks paternity/secondary caregiver, and 10 days bereavement leave.',
    details:
      'Primary caregivers receive 26 weeks of 100% paid parental leave (including adoption/surrogacy) plus a 4-week flexible ramp-back period. Secondary caregivers receive 6 weeks of paid leave usable within 12 months. Paid bereavement leave covers 10 business days.',
  },
  {
    id: 'hb-2-1',
    section: '§2.1',
    title: 'Standard Hybrid Work & WFH Eligibility',
    category: 'Remote Work',
    sla: '24h manager approval',
    updatedAt: 'Nov 2026',
    keywords: [
      'wfh', 'work from home', 'remote', 'hybrid', 'ghar', 'office', 'flex', 'days',
    ],
    summary: 'Up to 2 WFH days per week standard; Tuesday–Thursday are core in-office collaboration days.',
    details:
      'All full-time employees may work remotely up to 2 days per week. If 2 or more squad members are already scheduled off or remote on the requested date, Hyra flags a Team Calendar Conflict Warning and drafts a handover note for manager visibility.',
  },
  {
    id: 'hb-2-2',
    section: '§2.2',
    title: 'Severe Weather, Flooding & Hazardous AQI Auto-WFH Policy',
    category: 'Remote Work',
    sla: 'Instant Zero-Touch Auto-Approval',
    updatedAt: 'Nov 2026',
    keywords: [
      'weather', 'rain', 'flood', 'waterlogging', 'barish', 'aqi', 'pollution', 'smog', 'grap', 'noida', 'delhi', 'storm', 'disaster', 'auto-approve', 'hawa',
    ],
    summary: 'Automatic WFH approval without manager sign-off whenever city AQI exceeds 300 or heavy rain/flooding alerts trigger.',
    details:
      'Under Hyra Environmental Safety Protocol (§2.2), if live city Air Quality Index (AQI) exceeds 300 (Very Poor / Severe / GRAP Stage III–IV) or heavy rainfall (>15 mm/hr), thunderstorm, or urban waterlogging is detected in Noida, Delhi NCR, or any hub city, WFH is auto-approved instantaneously without waiting for manager sign-off.',
  },
  {
    id: 'hb-2-3',
    section: '§2.3',
    title: 'Work-From-Anywhere (WFA) Annual Allowance',
    category: 'Remote Work',
    sla: '48h HR review',
    updatedAt: 'Oct 2026',
    keywords: [
      'wfa', 'anywhere', 'travel', 'hometown', 'workation', 'abroad', 'consecutive',
    ],
    summary: 'Up to 20 business days per calendar year of domestic or approved international remote work.',
    details:
      'Employees who have completed 6 months of tenure may use up to 20 business days/year as Work-From-Anywhere days across India or approved tax-compliant jurisdictions while maintaining at least 4 hours of IST core overlap.',
  },
  {
    id: 'hb-3-1',
    section: '§3.1',
    title: 'Lost or Stolen Corporate Device Protocol (P0-CRITICAL)',
    category: 'Security',
    sla: '15 min SecOps SLA',
    updatedAt: 'Nov 2026',
    keywords: [
      'lost', 'stolen', 'chori', 'laptop', 'macbook', 'phone', 'airport', 'cab', 'wipe', 'jamf', 'p0', 'security',
    ],
    summary: 'Mandatory immediate P0-CRITICAL escalation triggering Okta revocation and Jamf remote wipe within 15 minutes.',
    details:
      'Any misplaced or stolen corporate laptop, phone, or YubiKey must be logged immediately as P0-CRITICAL. Hyra triggers instant Okta session termination, queues Jamf MDM remote lock/wipe, revokes GitHub/AWS PATs, and dispatches an emergency loaner authorization within 15 minutes.',
  },
  {
    id: 'hb-3-2',
    section: '§3.2',
    title: 'Phishing, MFA Fatigue & Suspected Data Breach Response',
    category: 'Security',
    sla: '15 min SecOps SLA',
    updatedAt: 'Nov 2026',
    keywords: [
      'phishing', 'breach', 'hack', 'mfa', 'otp', 'suspicious', 'link', 'password', 'credential', 'leak', 'ransomware', 'p0',
    ],
    summary: 'Never approve unexpected MFA pushes; report phishing clicks or leaks as P0-CRITICAL immediately.',
    details:
      'If an employee receives unrecognized Okta MFA pushes, accidentally enters credentials on a spoofed site, or suspects unauthorized data exfiltration, Hyra raises a P0-CRITICAL Security Escalation, rotates SSO tokens, and isolates the endpoint without disciplinary penalty for rapid reporting.',
  },
  {
    id: 'hb-3-3',
    section: '§3.3',
    title: 'Zero-Trust WireGuard VPN & Okta SSO Troubleshooting',
    category: 'IT & Access',
    sla: '2h P1 IT SLA',
    updatedAt: 'Nov 2026',
    keywords: [
      'vpn', 'wireguard', '403', 'forbidden', 'okta', 'sso', 'dns', 'certificate', 'access', 'login', 'network', 'wifi',
    ],
    summary: 'WireGuard certificates rotate every 30 days; refresh Device Trust in Okta Verify for 403/DNS errors.',
    details:
      'After macOS or Windows security patches, WireGuard 403 Forbidden or split-DNS drops are usually resolved by renewing the Device Posture Certificate via Okta Verify > Device Trust > Re-verify and toggling the tunnel. Persistent failures auto-route as a P1 IT Access ticket.',
  },
  {
    id: 'hb-4-1',
    section: '§4.1',
    title: 'Laptop & Peripheral Hardware Replacement Lifecycle',
    category: 'Hardware',
    sla: '48h IT fulfillment',
    updatedAt: 'Oct 2026',
    keywords: [
      'hardware', 'laptop', 'replace', 'replacement', 'screen', 'battery', 'keyboard', 'charger', 'dock', 'monitor', 'broken', 'cracked', 'bsod', 'blue screen',
    ],
    summary: '36-month laptop refresh cycle; accidental damage or defective displays qualify for 48-hour replacement.',
    details:
      'Primary developer machines (MacBook Pro / ThinkPad) follow a 36-month refresh cycle. Cracked displays, swollen batteries, logic board faults, or faulty Thunderbolt docks qualify for expedited replacement within 48 hours via an IT Asset Pass generated in Hyra.',
  },
  {
    id: 'hb-4-2',
    section: '§4.2',
    title: 'Emergency Loaner Hardware & IT Asset Pass Issuance',
    category: 'Hardware',
    sla: '4h Hub Pickup',
    updatedAt: 'Oct 2026',
    keywords: [
      'loaner', 'spare', 'asset', 'pass', 'pickup', 'it desk', 'yubikey', 'headset', 'temporary',
    ],
    summary: 'Same-day loaner MacBook pickup at Noida/Bengaluru IT Bar using a Hyra PDF IT Asset Pass.',
    details:
      'When a primary workstation fails or is lost, employees can collect a pre-imaged loaner laptop or spare YubiKey 5C NFC within 4 hours from the IT Genius Bar by presenting their stamped Hyra Corporate IT Asset Pass (PDF).',
  },
  {
    id: 'hb-5-1',
    section: '§5.1',
    title: 'Travel, Client Meals & Conveyance Reimbursement',
    category: 'Expenses',
    sla: '5 business days',
    updatedAt: 'Oct 2026',
    keywords: [
      'expense', 'reimbursement', 'travel', 'flight', 'hotel', 'cab', 'uber', 'meal', 'receipt', 'bill', 'paise', 'claim',
    ],
    summary: 'Receipts submitted within 14 days are reimbursed directly to payroll within 5 business days.',
    details:
      'Approved domestic travel meals are capped at ₹3,500/day ($75 US) and international meals at $110/day. Late-night office cabs (after 8:30 PM IST) are 100% reimbursable without pre-approval. Upload GST invoices within 14 calendar days for 5-business-day settlement.',
  },
  {
    id: 'hb-5-2',
    section: '§5.2',
    title: 'Annual L&D & Home Office Ergonomics Stipend',
    category: 'Expenses',
    sla: '5 business days',
    updatedAt: 'Oct 2026',
    keywords: [
      'learning', 'l&d', 'course', 'conference', 'certification', 'books', 'stipend', 'chair', 'desk', 'ergonomic', 'budget', 'allowance',
    ],
    summary: '₹75,000/yr ($900) L&D budget plus a one-time ₹45,000 ($550) home-office ergonomics grant.',
    details:
      'Every employee receives ₹75,000 ($900) annually for technical courses, books, cloud certifications, and conferences. New hires also receive a ₹45,000 ($550) home-office stipend for ergonomic chairs, standing desks, monitors, or UPS backups.',
  },
  {
    id: 'hb-6-1',
    section: '§6.1',
    title: 'Core Office Timings, Flex Hours & Late-Night Cab Safety',
    category: 'Office Timings',
    sla: 'Immediate',
    updatedAt: 'Nov 2026',
    keywords: [
      'timing', 'timings', 'hours', 'shift', 'start', 'end', 'office', 'attendance', 'cab', 'shuttle', 'late', 'core hours', 'samay',
    ],
    summary: 'Flexible 8-hour workday with mandatory 11:00 AM – 4:00 PM IST core collaboration window.',
    details:
      'Employees may start between 8:30 AM and 11:00 AM IST as long as they overlap during the 11:00 AM – 4:00 PM IST core collaboration window. Noida Sector 62 & Bengaluru Bellandur hubs provide escorted safety cabs for anyone departing after 8:30 PM IST.',
  },
  {
    id: 'hb-6-2',
    section: '§6.2',
    title: 'On-Call Incident Rotation & Comp-Off Guidelines',
    category: 'Office Timings',
    sla: '24h Manager ack',
    updatedAt: 'Nov 2026',
    keywords: [
      'on-call', 'oncall', 'weekend', 'pagerduty', 'comp-off', 'compoff', 'overtime', 'night', 'incident',
    ],
    summary: 'Weekend or overnight P0/P1 on-call interventions automatically earn 1:1 Comp-Off credits.',
    details:
      'Engineers responding to P0/P1 production incidents for more than 2 hours on weekends or public holidays accrue 1 full Comp-Off day valid for 60 days, plus an on-call readiness allowance of ₹8,000/week.',
  },
];

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'my',
  'me', 'i', 'we', 'our', 'can', 'you', 'please', 'what', 'how', 'do', 'does', 'hai', 'ka',
  'ki', 'ke', 'ko', 'kya', 'mera', 'meri', 'karo', 'kar', 'do', 'mujhe',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9§&\-\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Fast client-side semantic + keyword chunk retriever for Company Handbook RAG.
 * Returns the top-K most relevant handbook sections ranked by keyword & prose overlap.
 */
export function retrieveHandbookChunks(query, handbookList = COMPANY_HANDBOOK, topK = 3) {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return handbookList.slice(0, topK).map((entry) => ({ ...entry, score: 1 }));
  }

  const queryLower = String(query || '').toLowerCase();

  const scored = handbookList.map((entry) => {
    let score = 0;
    const titleLower = (entry.title || '').toLowerCase();
    const summaryLower = (entry.summary || '').toLowerCase();
    const detailsLower = (entry.details || '').toLowerCase();
    const categoryLower = (entry.category || '').toLowerCase();
    const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];

    // Direct section citation boost (e.g. "2.2" or "§3.1")
    if (entry.section && queryLower.includes(entry.section.replace('§', ''))) {
      score += 14;
    }

    // Phrase match in keywords
    for (const kw of keywords) {
      if (queryLower.includes(kw)) {
        score += 6;
      }
    }

    for (const tok of tokens) {
      if (keywords.some((kw) => kw.includes(tok) || tok.includes(kw))) score += 4;
      if (titleLower.includes(tok)) score += 3.5;
      if (categoryLower.includes(tok)) score += 2.5;
      if (summaryLower.includes(tok)) score += 2;
      if (detailsLower.includes(tok)) score += 1.2;
    }

    return { ...entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((item) => item.score > 0).slice(0, topK);
  if (matched.length > 0) return matched;
  return handbookList.slice(0, topK).map((entry) => ({ ...entry, score: 0.5 }));
}
