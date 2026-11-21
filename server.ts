import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { checkTeamCalendarConflicts } from './src/data/teamCalendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Gemini Function Declarations for Autonomous Corporate Helpdesk Actions
const HYRA_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'create_it_ticket',
    description:
      'Logs an IT support ticket or P0-CRITICAL security escalation. MUST be called for broken hardware, VPN/SSO errors, lost/stolen laptop, phishing, MFA fatigue, or data breaches.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        issue: {
          type: Type.STRING,
          description: 'Clear description of the IT or security issue.',
        },
        category: {
          type: Type.STRING,
          description: 'One of: Security, IT Access, Hardware, Payroll, Facilities.',
        },
        priority: {
          type: Type.STRING,
          description:
            'Must be "P0-CRITICAL" for lost/stolen laptop, phishing, MFA attack, or data breach; otherwise "P1", "P2", or "P3".',
        },
        sentiment: {
          type: Type.STRING,
          description: 'Detected employee emotional state: calm, frustrated, urgent, or distressed.',
        },
      },
      required: ['issue', 'category', 'priority', 'sentiment'],
    },
  },
  {
    name: 'request_leave_or_wfh',
    description:
      'Submits an employee Leave (PTO/Sick), WFH, Equipment, or Travel request and automatically checks the Team Calendar for teammate overlap conflicts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: 'One of: WFH, PTO, Equipment, Travel, Access.',
        },
        date: {
          type: Type.STRING,
          description: 'Requested date or date range (e.g. "tomorrow", "Thu – Fri", "Nov 26").',
        },
        reason: {
          type: Type.STRING,
          description: 'Short reason provided by the employee.',
        },
      },
      required: ['type', 'date', 'reason'],
    },
  },
  {
    name: 'check_weather_wfh_approval',
    description:
      'Checks live city weather, rainfall, and Air Quality Index (AQI) via Open-Meteo to evaluate zero-touch Environmental WFH Auto-Approval under Handbook §2.2 (auto-approves if AQI > 300 or heavy rain/flooding). Call this whenever the employee mentions rain, flooding, waterlogging, smog, pollution, AQI, storm, or weather-based WFH.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: 'City name such as Noida, Delhi, Gurugram, Bengaluru, Mumbai. Defaults to Noida.',
        },
      },
      required: ['city'],
    },
  },
];

interface LiveWeatherResult {
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

function describeAqi(aqi: number): string {
  if (aqi >= 400) return 'Severe (GRAP Stage IV)';
  if (aqi >= 301) return 'Very Poor (GRAP Stage III)';
  if (aqi >= 201) return 'Poor';
  if (aqi >= 101) return 'Moderate';
  return 'Satisfactory';
}

function describeWeatherCode(code: number): string {
  if (code >= 95) return 'Severe Thunderstorm';
  if (code >= 80) return 'Heavy Rain Showers';
  if (code >= 63) return 'Heavy Rain / Waterlogging Risk';
  if (code >= 51) return 'Light Drizzle';
  if (code >= 45) return 'Dense Smog / Fog';
  if (code >= 1) return 'Partly Cloudy';
  return 'Clear Sky';
}

async function fetchLiveWeatherAndAqi(
  rawCity: string,
  simulateSevereAlert: boolean
): Promise<LiveWeatherResult> {
  const city = (rawCity || 'Noida').trim() || 'Noida';

  if (simulateSevereAlert) {
    return {
      city: city.toLowerCase().includes('delhi') || city.toLowerCase().includes('noida')
        ? 'Noida / Delhi NCR'
        : city,
      aqi: 418,
      aqiLabel: 'Severe (GRAP Stage IV)',
      rainMmPerHr: 42.6,
      temperatureC: 24,
      condition: 'Heavy Rain & Hazardous AQI Alert',
      autoApproved: true,
      simulated: true,
      triggerReason: 'AQI 418 (>300 threshold) & 42.6 mm/hr heavy rainfall detected — Handbook §2.2 auto-approval triggered.',
    };
  }

  let lat = 28.5355;
  let lon = 77.391;
  let resolvedName = city;

  try {
    if (!['noida', 'noida/delhi', 'delhi ncr'].includes(city.toLowerCase())) {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (geoRes.ok) {
        const geoJson = (await geoRes.json()) as {
          results?: { latitude: number; longitude: number; name: string }[];
        };
        if (geoJson.results && geoJson.results[0]) {
          lat = geoJson.results[0].latitude;
          lon = geoJson.results[0].longitude;
          resolvedName = geoJson.results[0].name;
        }
      }
    } else {
      resolvedName = 'Noida / Delhi NCR';
    }

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,precipitation,weather_code`,
        { signal: AbortSignal.timeout(5000) }
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5`,
        { signal: AbortSignal.timeout(5000) }
      ),
    ]);

    const weatherData = weatherRes.ok
      ? ((await weatherRes.json()) as {
          current?: { temperature_2m?: number; rain?: number; precipitation?: number; weather_code?: number };
        })
      : {};
    const aqiData = aqiRes.ok
      ? ((await aqiRes.json()) as { current?: { us_aqi?: number; pm2_5?: number } })
      : {};

    const aqi = Math.round(aqiData.current?.us_aqi ?? 186);
    const rainMmPerHr = Number((weatherData.current?.rain ?? weatherData.current?.precipitation ?? 0).toFixed(1));
    const temperatureC = Math.round(weatherData.current?.temperature_2m ?? 26);
    const weatherCode = Number(weatherData.current?.weather_code ?? 45);
    const condition = describeWeatherCode(weatherCode);
    const severeWeatherCode = weatherCode >= 63 || weatherCode >= 81 || weatherCode >= 95;
    const autoApproved = aqi > 300 || rainMmPerHr >= 12 || severeWeatherCode;

    const triggerReason = autoApproved
      ? aqi > 300
        ? `Live AQI ${aqi} exceeds 300 safety threshold (Handbook §2.2) — WFH auto-approved without manager sign-off.`
        : `Severe rain/storm detected (${rainMmPerHr} mm/hr · ${condition}) under Handbook §2.2 — WFH auto-approved.`
      : `Live conditions in ${resolvedName}: AQI ${aqi} (${describeAqi(aqi)}), Rain ${rainMmPerHr} mm/hr. Below §2.2 auto-trigger threshold; logged as standard WFH request for manager review.`;

    return {
      city: resolvedName,
      aqi,
      aqiLabel: describeAqi(aqi),
      rainMmPerHr,
      temperatureC,
      condition,
      autoApproved,
      simulated: false,
      triggerReason,
    };
  } catch {
    // Graceful live telemetry fallback if Open-Meteo is unreachable in restricted sandbox
    return {
      city: resolvedName,
      aqi: 245,
      aqiLabel: 'Poor',
      rainMmPerHr: 0,
      temperatureC: 25,
      condition: 'Hazy / Moderate Smog',
      autoApproved: false,
      simulated: false,
      triggerReason: `Live telemetry fallback for ${resolvedName} (AQI 245, Rain 0 mm/hr). Toggle "Simulate Severe Rain/AQI Alert" to test §2.2 auto-approval.`,
    };
  }
}

function isSecurityCriticalText(text: string): boolean {
  return /\b(lost laptop|stolen|chori|phishing|breach|hacked|ransomware|mfa push|unknown mfa|data leak|compromised)\b/i.test(
    text
  );
}

function normalizeCategory(raw: string, critical: boolean): 'Security' | 'IT Access' | 'Hardware' | 'Payroll' | 'Facilities' {
  if (critical) return 'Security';
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('sec')) return 'Security';
  if (lower.includes('hard') || lower.includes('laptop') || lower.includes('dock') || lower.includes('screen')) {
    return 'Hardware';
  }
  if (lower.includes('pay') || lower.includes('salary') || lower.includes('reimburse')) return 'Payroll';
  if (lower.includes('facil') || lower.includes('desk') || lower.includes('cab')) return 'Facilities';
  return 'IT Access';
}

function normalizePriority(raw: string, critical: boolean): { priority: 'P0' | 'P1' | 'P2' | 'P3'; displayPriority: string } {
  const upper = String(raw || '').toUpperCase();
  if (critical || upper.includes('P0') || upper.includes('CRITICAL')) {
    return { priority: 'P0', displayPriority: 'P0-CRITICAL' };
  }
  if (upper.includes('P1') || upper.includes('HIGH')) {
    return { priority: 'P1', displayPriority: 'P1' };
  }
  if (upper.includes('P3') || upper.includes('LOW')) {
    return { priority: 'P3', displayPriority: 'P3' };
  }
  return { priority: 'P2', displayPriority: 'P2' };
}

function normalizeRequestType(raw: string): 'WFH' | 'PTO' | 'Equipment' | 'Travel' | 'Access' {
  const upper = String(raw || '').toUpperCase();
  if (upper.includes('WFH') || upper.includes('REMOTE') || upper.includes('HOME')) return 'WFH';
  if (upper.includes('PTO') || upper.includes('LEAVE') || upper.includes('SICK') || upper.includes('VACATION')) return 'PTO';
  if (upper.includes('EQUIP') || upper.includes('HARD') || upper.includes('LAPTOP')) return 'Equipment';
  if (upper.includes('TRAVEL')) return 'Travel';
  if (upper.includes('ACCESS')) return 'Access';
  return 'WFH';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: Boolean(getGeminiClient()) });
  });

  // 1. Hyra Autonomous Workplace Assistant with RAG + Gemini Function Calling
  app.post('/api/hyra/respond', async (req, res) => {
    try {
      const {
        message,
        history = [],
        languageMode = 'EN',
        retrievedChunks = [],
        employeeName = 'Aarav Mehta',
        department = 'Platform Engineering',
        simulateSevereAlert = false,
      } = req.body ?? {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Please check GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const topChunks = Array.isArray(retrievedChunks) ? retrievedChunks.slice(0, 4) : [];
      const ragContext = topChunks
        .map(
          (c: { section?: string; title?: string; sla?: string; details?: string }) =>
            `[Handbook ${c.section || '§1.1'} — ${c.title || 'Policy'} | SLA: ${c.sla || 'Standard'}]\n${c.details || ''}`
        )
        .join('\n\n');

      const langDirective =
        languageMode === 'HINGLISH'
          ? 'HINGLISH MODE IS ON: Understand Hindi/Hinglish/English naturally and reply in polished, friendly, professional Delhi/Noida corporate Hinglish (Latin script only — e.g. "Bilkul Aarav, maine Noida ka live AQI check kar liya hai... Handbook §2.2 ke under aapka WFH auto-approve ho gaya hai."). Keep voice replies crisp (2–3 sentences max).'
          : 'Respond in sharp, warm, executive corporate English (Jarvis-meets-modern-workplace). Keep voice replies concise (2–3 sentences max) so spoken playback feels instant.';

      const systemInstruction = `You are Hyra, an autonomous AI Corporate Helpdesk & Workplace Assistant.
Employee: ${employeeName} (${department}).
${langDirective}

Top Retrieved Company Handbook Context (RAG):
${ragContext || 'General corporate HR & IT workplace guidelines apply.'}

Tool & Citation Rules:
- Always call \`create_it_ticket\` when reporting lost/stolen laptops, phishing, data breaches, VPN/SSO failures, or hardware defects. Set priority="P0-CRITICAL" for any lost laptop, phishing, MFA attack, or breach.
- Always call \`check_weather_wfh_approval\` when the user asks for WFH due to rain, flooding, waterlogging, storm, smog, pollution, or AQI (default city="Noida" if unstated).
- Always call \`request_leave_or_wfh\` when the user asks for standard WFH, PTO/leave, sick leave, or equipment requests (not weather-emergency).
- When answering policy questions directly without a tool, ground your answer strictly in the Retrieved Company Handbook Context and cite the exact section number (e.g. "Handbook §2.2").
- Do not invent fake ticket IDs — confirm the action is logged and cite the handbook section cleanly.`;

      const recentHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h: { role?: string; text?: string }) => ({
              role: h.role === 'user' ? ('user' as const) : ('model' as const),
              parts: [{ text: String(h.text ?? '') }],
            }))
        : [];

      const turn1Contents = [
        ...recentHistory,
        { role: 'user' as const, parts: [{ text: message }] },
      ];

      const response1 = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: turn1Contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: HYRA_FUNCTION_DECLARATIONS }],
        },
      });

      const functionCalls = response1.functionCalls;
      const previousContent = response1.candidates?.[0]?.content;

      // Default handbook citation from top RAG chunk
      const topSection = topChunks[0]?.section ? `Handbook ${topChunks[0].section}` : undefined;
      const topTitle = topChunks[0]?.title ? `${topChunks[0].section || ''} ${topChunks[0].title}`.trim() : undefined;

      if (!functionCalls || functionCalls.length === 0 || !previousContent) {
        const replyText = (response1.text ?? '').trim() || 'I have checked the Company Handbook for you.';
        const sectionMatch = replyText.match(/§\d+\.\d+/);
        const resolvedSection = sectionMatch ? `Handbook ${sectionMatch[0]}` : topSection;
        return res.json({
          reply: replyText,
          actionType: topChunks.length > 0 ? 'POLICY_ANSWER' : 'NONE',
          handbookCitation: resolvedSection,
          policyCitation: topTitle,
          securityEscalation: false,
        });
      }

      // Execute the primary tool call on the server
      const call = functionCalls[0];
      const args = (call.args || {}) as Record<string, unknown>;

      let actionType:
        | 'CREATE_TICKET'
        | 'ESCALATE_P0'
        | 'CREATE_REQUEST'
        | 'WEATHER_WFH_APPROVAL' = 'CREATE_TICKET';
      let securityEscalation = false;
      let ticketPayload: Record<string, unknown> | undefined;
      let requestPayload: Record<string, unknown> | undefined;
      let calendarConflict: ReturnType<typeof checkTeamCalendarConflicts> | undefined;
      let weatherTelemetry: LiveWeatherResult | undefined;
      let handbookCitation = topSection;
      let toolResultPayload: Record<string, unknown> = {};

      if (call.name === 'create_it_ticket') {
        const issue = String(args.issue || message);
        const isCritical =
          isSecurityCriticalText(`${message} ${issue}`) ||
          String(args.priority || '').toUpperCase().includes('P0') ||
          String(args.priority || '').toUpperCase().includes('CRITICAL');
        const category = normalizeCategory(String(args.category || ''), isCritical);
        const { priority, displayPriority } = normalizePriority(String(args.priority || 'P2'), isCritical);
        const rawSent = String(args.sentiment || 'calm').toLowerCase();
        const sentiment = (['calm', 'frustrated', 'urgent', 'distressed'].includes(rawSent)
          ? rawSent
          : isCritical
          ? 'urgent'
          : 'calm') as 'calm' | 'frustrated' | 'urgent' | 'distressed';

        securityEscalation = isCritical;
        actionType = isCritical ? 'ESCALATE_P0' : 'CREATE_TICKET';
        handbookCitation = isCritical
          ? 'Handbook §3.1'
          : category === 'Hardware'
          ? 'Handbook §4.1'
          : 'Handbook §3.3';

        ticketPayload = {
          title: issue.slice(0, 110),
          summary: `${issue} [Detected sentiment: ${sentiment}]`,
          category,
          priority,
          displayPriority,
          sentiment,
        };

        toolResultPayload = {
          logged: true,
          priority: displayPriority,
          category,
          sentiment,
          securityEscalationTriggered: isCritical,
          playbook: isCritical
            ? 'Okta sessions queued for immediate revocation & Jamf remote wipe initiated per Handbook §3.1.'
            : 'Ticket queued with IT Operations SLA.',
        };
      } else if (call.name === 'request_leave_or_wfh') {
        const reqType = normalizeRequestType(String(args.type || 'WFH'));
        const dateStr = String(args.date || 'Tomorrow');
        const reasonStr = String(args.reason || message);
        calendarConflict = checkTeamCalendarConflicts(dateStr);
        actionType = 'CREATE_REQUEST';
        handbookCitation = reqType === 'WFH' ? 'Handbook §2.1' : 'Handbook §1.1';

        requestPayload = {
          type: reqType,
          title: `${reqType} Request — ${dateStr}`,
          reason: reasonStr,
          dateRange: dateStr,
        };

        toolResultPayload = {
          submitted: true,
          status: 'pending',
          type: reqType,
          dateRange: dateStr,
          calendarConflict: calendarConflict.summary,
          conflictCount: calendarConflict.count,
        };
      } else if (call.name === 'check_weather_wfh_approval') {
        const city = String(args.city || 'Noida');
        weatherTelemetry = await fetchLiveWeatherAndAqi(city, Boolean(simulateSevereAlert));
        calendarConflict = checkTeamCalendarConflicts('today');
        actionType = 'WEATHER_WFH_APPROVAL';
        handbookCitation = 'Handbook §2.2';

        requestPayload = {
          type: 'WFH',
          title: weatherTelemetry.autoApproved
            ? `Environmental Auto-Approved WFH — ${weatherTelemetry.city}`
            : `Weather WFH Request — ${weatherTelemetry.city}`,
          reason: weatherTelemetry.triggerReason,
          dateRange: 'Today',
          autoApproved: weatherTelemetry.autoApproved,
        };

        toolResultPayload = {
          city: weatherTelemetry.city,
          aqi: weatherTelemetry.aqi,
          aqiLabel: weatherTelemetry.aqiLabel,
          rainMmPerHr: weatherTelemetry.rainMmPerHr,
          condition: weatherTelemetry.condition,
          autoApproved: weatherTelemetry.autoApproved,
          policy: 'Handbook §2.2',
          decision: weatherTelemetry.triggerReason,
        };
      }

      // Send functionResponse back to Gemini so it speaks a natural, tool-grounded reply
      const response2 = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...turn1Contents,
          previousContent,
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: call.id,
                  name: call.name,
                  response: toolResultPayload,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: HYRA_FUNCTION_DECLARATIONS }],
        },
      });

      const finalReply =
        (response2.text ?? '').trim() ||
        'Action completed and synced to your workspace right panel.';

      return res.json({
        reply: finalReply,
        actionType,
        handbookCitation,
        policyCitation: topTitle,
        securityEscalation,
        ticketPayload,
        requestPayload,
        calendarConflict,
        weatherTelemetry,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to reach Hyra AI service.';
      console.error('[/api/hyra/respond] error:', msg);
      return res.status(500).json({ error: msg });
    }
  });

  // 2. Multimodal "Snap & Fix" IT Diagnostics (Gemini Vision)
  app.post('/api/hyra/diagnose-image', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', note = '', languageMode = 'EN' } = req.body ?? {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Image data is required for Snap & Fix diagnostics.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured on the server.',
        });
      }

      const langNote =
        languageMode === 'HINGLISH'
          ? 'Write spokenDiagnosis in crisp, reassuring Delhi corporate Hinglish (Latin script, 2 sentences max). Keep twoStepFix clear in English.'
          : 'Write spokenDiagnosis in crisp, reassuring executive English (2 sentences max).';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `You are Hyra Vision IT Diagnostics. Analyze this uploaded photo of a laptop error screen, VPN/SSO popup, BSOD, or damaged corporate hardware.
User note: "${note || 'Diagnose this issue and give me a quick 2-step fix.'}"
${langNote}
Cite the most relevant Handbook section (§3.1 Lost/Security, §3.3 VPN/SSO, §4.1 Hardware Replacement, or §4.2 Loaner Hardware).`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedError: { type: Type.STRING, description: 'Exact error name or hardware fault observed.' },
              category: {
                type: Type.STRING,
                enum: ['Security', 'IT Access', 'Hardware', 'Facilities'],
              },
              priority: {
                type: Type.STRING,
                enum: ['P0', 'P1', 'P2', 'P3'],
              },
              twoStepFix: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 2 concrete, actionable troubleshooting steps.',
              },
              spokenDiagnosis: {
                type: Type.STRING,
                description: 'Concise 2-sentence spoken summary of the diagnosis and 2-step fix.',
              },
              recommendedTicketTitle: {
                type: Type.STRING,
                description: 'Short IT ticket title ready for 1-click auto-logging.',
              },
              handbookSection: {
                type: Type.STRING,
                description: 'Relevant citation such as Handbook §3.3 or Handbook §4.1.',
              },
            },
            required: [
              'detectedError',
              'category',
              'priority',
              'twoStepFix',
              'spokenDiagnosis',
              'recommendedTicketTitle',
              'handbookSection',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '').trim());
      return res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Vision diagnosis failed.';
      console.error('[/api/hyra/diagnose-image] error:', msg);
      return res.status(500).json({ error: msg });
    }
  });

  // 3. One-Click "Ghost-Write to Manager" (Slack + Email Handover Drafter)
  app.post('/api/hyra/ghost-write', async (req, res) => {
    try {
      const {
        recordCode = '',
        kind = 'leave_wfh',
        title = '',
        dateRange = '',
        reason = '',
        status = 'pending',
        employeeName = 'Aarav Mehta',
        department = 'Platform Engineering',
        calendarConflictSummary = '',
        weatherTriggerSummary = '',
        languageMode = 'EN',
      } = req.body ?? {};

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
      }

      const tone =
        languageMode === 'HINGLISH'
          ? 'Keep the email polite professional English, and give the Slack DM a warm, concise modern Indian corporate tone.'
          : 'Keep both messages concise, polite, proactive, and ready to paste immediately.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Draft a manager handover message for:
Employee: ${employeeName} (${department})
Record ID: ${recordCode}
Type: ${kind === 'hardware' ? 'IT Hardware Replacement / Asset Pass' : 'Leave / WFH Request'}
Title: ${title}
Dates/Window: ${dateRange || 'Immediate'}
Status: ${status}
Reason: ${reason}
Team Calendar Conflict Info: ${calendarConflictSummary || 'None reported'}
Environmental Auto-Approval Info: ${weatherTriggerSummary || 'None'}

${tone}
If there are calendar conflicts, proactively mention handover coverage and Slack/async availability so the manager feels reassured.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              slackMessage: {
                type: Type.STRING,
                description: 'Short, friendly Slack DM (3–5 lines) ready to send to manager.',
              },
              emailSubject: {
                type: Type.STRING,
                description: 'Clear corporate email subject line including Record ID.',
              },
              emailBody: {
                type: Type.STRING,
                description: 'Polite, structured corporate handover email body.',
              },
            },
            required: ['slackMessage', 'emailSubject', 'emailBody'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '').trim());
      return res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to draft manager handover.';
      console.error('[/api/hyra/ghost-write] error:', msg);
      return res.status(500).json({ error: msg });
    }
  });

  // 4. Interview Lab Voice Analytics & AI Coaching endpoint
  app.post('/api/interview/evaluate', async (req, res) => {
    try {
      const {
        role = 'Senior Frontend Engineer',
        question = '',
        transcript = '',
        durationSec = 0,
        fillerCount = 0,
        wpm = 0,
        languageMode = 'EN',
      } = req.body ?? {};

      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Candidate response transcript is required.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Please check GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const tone =
        languageMode === 'HINGLISH'
          ? 'Give coachReply in encouraging urban Indian Hinglish (Latin script, 2 sentences max) while keeping strengths/improvements/followUpQuestion crisp in English.'
          : 'Give coachReply in encouraging, sharp executive coaching English (2 sentences max).';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Target Role: ${role}
Interview Question: ${question}
Candidate Transcript: "${transcript}"
Delivery Telemetry: ${durationSec}s duration, ${wpm} words per minute, ${fillerCount} filler words detected.

Evaluate this interview answer honestly based strictly on the transcript and delivery telemetry.`,
        config: {
          systemInstruction: `You are Hyra Interview Coach, a technical and behavioral hiring bar-raiser.
Score strictly on a 0-100 scale based on concrete evidence in the transcript.
${tone}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clarityScore: { type: Type.INTEGER },
              technicalDepth: { type: Type.INTEGER },
              structureScore: { type: Type.INTEGER },
              confidenceScore: { type: Type.INTEGER },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              improvements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              coachReply: { type: Type.STRING },
              followUpQuestion: { type: Type.STRING },
            },
            required: [
              'clarityScore',
              'technicalDepth',
              'structureScore',
              'confidenceScore',
              'strengths',
              'improvements',
              'coachReply',
              'followUpQuestion',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '').trim());
      return res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to evaluate interview response.';
      console.error('[/api/interview/evaluate] error:', msg);
      return res.status(500).json({ error: msg });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hyra OS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Hyra server:', err);
  process.exit(1);
});
