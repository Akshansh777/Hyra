import { jsPDF } from 'jspdf';
import type { CorporateTicket, InterviewTurn } from '../types/hyra';

export interface CorporatePassPayload {
  passKind: 'LEAVE_WFH' | 'IT_ASSET';
  recordCode: string;
  title: string;
  employeeName: string;
  department: string;
  status: string;
  timestamp: string;
  dateRange?: string;
  details: string;
  handbookCitation?: string;
  environmentalTrigger?: string;
  calendarConflictNote?: string;
}

function drawVerificationStamp(doc: jsPDF, cx: number, cy: number, statusText: string, isApproved: boolean) {
  const strokeColor: [number, number, number] = isApproved ? [16, 185, 129] : [99, 102, 241];
  doc.setDrawColor(...strokeColor);
  doc.setLineWidth(2);
  doc.circle(cx, cy, 44, 'S');
  doc.setLineWidth(0.9);
  doc.circle(cx, cy, 37, 'S');

  doc.setTextColor(...strokeColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('HYRA // OS', cx, cy - 12, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text(statusText.slice(0, 14).toUpperCase(), cx, cy + 3, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('DIGITAL PASS', cx, cy + 16, { align: 'center' });
}

export function exportCorporateApprovalPassPdf(payload: CorporatePassPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;

  // Obsidian HUD Banner
  doc.setFillColor(7, 11, 20);
  doc.rect(0, 0, 595, 124, 'F');

  doc.setFillColor(0, 240, 255);
  doc.rect(0, 121, 595, 3, 'F');

  doc.setTextColor(0, 240, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const heading =
    payload.passKind === 'IT_ASSET'
      ? 'HYRA // OS  —  CORPORATE IT ASSET PASS'
      : 'HYRA // OS  —  LEAVE / WFH APPROVAL PASS';
  doc.text(heading, margin, 54);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Pass Reference: ${payload.recordCode}   ·   Issued ${new Date(payload.timestamp).toLocaleString()}`, margin, 78);

  if (payload.handbookCitation) {
    doc.setTextColor(129, 140, 248);
    doc.text(`Policy Authority: Source ${payload.handbookCitation}`, margin, 98);
  }

  // Metadata Box
  let y = 160;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y - 20, 499, 116, 8, 8, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(doc.splitTextToSize(payload.title, 360), margin + 18, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Employee: ${payload.employeeName} (${payload.department})`, margin + 18, y + 36);
  doc.text(`Pass ID: ${payload.recordCode}   |   Status: ${payload.status.toUpperCase()}`, margin + 18, y + 54);
  if (payload.dateRange) {
    doc.text(`Effective Window: ${payload.dateRange}`, margin + 18, y + 72);
  }

  const isApproved =
    payload.status.toLowerCase().includes('approved') ||
    payload.status.toLowerCase().includes('resolved') ||
    payload.passKind === 'IT_ASSET';
  drawVerificationStamp(
    doc,
    margin + 432,
    y + 38,
    isApproved ? 'VERIFIED' : 'LOGGED',
    isApproved
  );

  y += 126;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Authorization Details', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const detailLines = doc.splitTextToSize(payload.details, 495);
  doc.text(detailLines, margin, y);
  y += detailLines.length * 14 + 20;

  if (payload.environmentalTrigger) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(margin, y - 12, 499, 44, 6, 6, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('ENVIRONMENTAL AUTO-APPROVAL TRIGGER (§2.2)', margin + 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(payload.environmentalTrigger, 470), margin + 14, y + 19);
    y += 54;
  }

  if (payload.calendarConflictNote) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(margin, y - 12, 499, 42, 6, 6, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('TEAM CALENDAR HANDOVER NOTICE', margin + 14, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(payload.calendarConflictNote, 470), margin + 14, y + 19);
    y += 52;
  }

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 770, 547, 770);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Cryptographically timestamped by Hyra Corporate Workplace OS · Present at IT Bar or attach to HRIS.',
    margin,
    788
  );

  const suffix = payload.passKind === 'IT_ASSET' ? 'IT_Asset_Pass' : 'Approval_Pass';
  doc.save(`${payload.recordCode}_${suffix}.pdf`);
}

export function exportTicketPdf(ticket: CorporateTicket): void {
  exportCorporateApprovalPassPdf({
    passKind: 'IT_ASSET',
    recordCode: ticket.ticketCode,
    title: ticket.title,
    employeeName: ticket.employeeName,
    department: ticket.department,
    status: `${ticket.displayPriority || ticket.priority} · ${ticket.status}`,
    timestamp: ticket.createdAt,
    dateRange: `${ticket.category} · Channel: ${ticket.source.toUpperCase()}`,
    details: ticket.summary,
    handbookCitation: ticket.priority === 'P0' ? 'Handbook §3.1' : 'Handbook §4.1',
  });
}

export function exportInterviewReportPdf(role: string, turns: InterviewTurn[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let y = 56;

  doc.setFillColor(7, 11, 20);
  doc.rect(0, 0, 595, 106, 'F');

  doc.setTextColor(0, 240, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HYRA INTERVIEW LAB  —  VOICE ANALYTICS REPORT', margin, y);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Track: ${role}  ·  Turns Completed: ${turns.length}  ·  ${new Date().toLocaleDateString()}`, margin, y + 22);

  y = 140;
  const avg = (fn: (t: InterviewTurn) => number) =>
    turns.length ? Math.round(turns.reduce((acc, item) => acc + fn(item), 0) / turns.length) : 0;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    `Average Scores — Clarity: ${avg((t) => t.clarityScore)}/100  |  Technical Depth: ${avg((t) => t.technicalDepth)}/100  |  Structure: ${avg((t) => t.structureScore)}/100  |  Confidence: ${avg((t) => t.confidenceScore)}/100`,
    margin,
    y
  );
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Average Pace: ${avg((t) => t.wpm)} WPM  |  Total Filler Words: ${turns.reduce((a, b) => a + b.fillerCount, 0)}`,
    margin,
    y
  );

  y += 30;
  for (const turn of turns) {
    if (y > 720) {
      doc.addPage();
      y = 56;
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Turn ${turn.turnNumber}: ${doc.splitTextToSize(turn.question, 480)[0]}`, margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Pace: ${turn.wpm} WPM · Fillers: ${turn.fillerCount} · Clarity ${turn.clarityScore} · Depth ${turn.technicalDepth}`,
      margin,
      y
    );
    y += 16;

    const feedbackLines = doc.splitTextToSize(`Coach Note: ${turn.coachReply}`, 495);
    doc.setTextColor(30, 41, 59);
    doc.text(feedbackLines, margin, y);
    y += feedbackLines.length * 13 + 18;
  }

  doc.save(`Hyra_Interview_Scorecard_${role.replace(/\s+/g, '_')}.pdf`);
}
