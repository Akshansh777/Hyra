// Mock Corporate Squad Calendar for Leave/WFH conflict detection

function isoOffset(daysFromToday) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function dayNameOffset(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export const TEAM_CALENDAR_ENTRIES = [
  {
    id: 'cal-1',
    dateOffset: 0,
    date: isoOffset(0),
    dayName: dayNameOffset(0),
    employee: 'Priya Verma',
    role: 'Staff Backend',
    status: 'WFH',
    note: 'API migration focus',
  },
  {
    id: 'cal-2',
    dateOffset: 1,
    date: isoOffset(1),
    dayName: dayNameOffset(1),
    employee: 'Priya Verma',
    role: 'Staff Backend',
    status: 'PTO',
    note: 'Planned family leave',
  },
  {
    id: 'cal-3',
    dateOffset: 1,
    date: isoOffset(1),
    dayName: dayNameOffset(1),
    employee: 'Rohan Kapoor',
    role: 'Senior Frontend',
    status: 'PTO',
    note: 'Out of office (Jaipur)',
  },
  {
    id: 'cal-4',
    dateOffset: 2,
    date: isoOffset(2),
    dayName: dayNameOffset(2),
    employee: 'Devika Sharma',
    role: 'SRE On-Call',
    status: 'PTO',
    note: 'Comp-off credit',
  },
  {
    id: 'cal-5',
    dateOffset: 2,
    date: isoOffset(2),
    dayName: dayNameOffset(2),
    employee: 'Siddharth Rao',
    role: 'Product Manager',
    status: 'WFH',
    note: 'Customer research interviews',
  },
  {
    id: 'cal-6',
    dateOffset: 3,
    date: isoOffset(3),
    dayName: dayNameOffset(3),
    employee: 'Kabir Nair',
    role: 'Platform Eng',
    status: 'PTO',
    note: 'Annual leave',
  },
  {
    id: 'cal-7',
    dateOffset: 3,
    date: isoOffset(3),
    dayName: dayNameOffset(3),
    employee: 'Ananya Sen',
    role: 'Product Design',
    status: 'WFH',
    note: 'Design system sprint',
  },
  {
    id: 'cal-8',
    dateOffset: 4,
    date: isoOffset(4),
    dayName: dayNameOffset(4),
    employee: 'Rohan Kapoor',
    role: 'Senior Frontend',
    status: 'PTO',
    note: 'Extended weekend',
  },
];

const WEEKDAY_MAP = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Checks team calendar conflicts for a requested date string (handles relative terms, Hinglish, weekdays, or ISO dates).
 */
export function checkTeamCalendarConflicts(dateInput) {
  const raw = String(dateInput || 'tomorrow').toLowerCase().trim();
  const matchedOffsets = new Set();

  if (raw.includes('today') || raw.includes('aaj')) {
    matchedOffsets.add(0);
  }
  if (raw.includes('tomorrow') || raw.includes('kal')) {
    matchedOffsets.add(1);
  }
  if (raw.includes('day after') || raw.includes('parso')) {
    matchedOffsets.add(2);
  }

  // Match explicit weekdays
  const todayDow = new Date().getDay();
  for (const [label, targetDow] of Object.entries(WEEKDAY_MAP)) {
    const regex = new RegExp(`\\b${label}\\b`, 'i');
    if (regex.test(raw)) {
      let diff = (targetDow - todayDow + 7) % 7;
      if (diff === 0) diff = 0;
      matchedOffsets.add(Math.min(4, diff));
    }
  }

  // Match explicit ISO dates
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const found = TEAM_CALENDAR_ENTRIES.filter((e) => e.date === isoMatch[0]);
    if (found.length > 0) {
      found.forEach((e) => matchedOffsets.add(e.dateOffset));
    }
  }

  // Default to tomorrow (offset 1) when date is vague so demo conflict detection stays informative
  if (matchedOffsets.size === 0) {
    matchedOffsets.add(1);
  }

  const conflicts = TEAM_CALENDAR_ENTRIES.filter((entry) => matchedOffsets.has(entry.dateOffset));

  // Deduplicate by employee name
  const uniqueMap = new Map();
  for (const c of conflicts) {
    if (!uniqueMap.has(c.employee)) {
      uniqueMap.set(c.employee, c);
    }
  }
  const uniqueConflicts = Array.from(uniqueMap.values());

  const dateLabel = raw.includes('today') || raw.includes('aaj')
    ? 'today'
    : raw.includes('tomorrow') || raw.includes('kal')
    ? 'tomorrow'
    : dateInput || 'requested dates';

  if (uniqueConflicts.length === 0) {
    return {
      hasConflict: false,
      count: 0,
      dateLabel,
      summary: `No squad calendar conflicts detected for ${dateLabel}.`,
      teammates: [],
    };
  }

  const namesList = uniqueConflicts.map((c) => `${c.employee} (${c.status})`).join(', ');
  return {
    hasConflict: true,
    count: uniqueConflicts.length,
    dateLabel,
    summary: `${uniqueConflicts.length} ${uniqueConflicts.length === 1 ? 'teammate is' : 'teammates are'} already off/remote on ${dateLabel}: ${namesList}`,
    teammates: uniqueConflicts.map((c) => ({
      name: c.employee,
      role: c.role,
      status: c.status,
      note: c.note,
    })),
  };
}
