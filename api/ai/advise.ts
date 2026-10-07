import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyUser } from '../_lib/verifyUser.js';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const MAX_TURNS = 20;
const MAX_CHARS = 2000;
const MAX_LEDGER_ROWS = 250;
const INVALID = Symbol('invalid');

/** Returns the validated turns, `null` for "no chat requested", or INVALID. */
function validateMessages(raw: unknown): ChatTurn[] | null | typeof INVALID {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) return INVALID;
  const turns: ChatTurn[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return INVALID;
    const { role, text } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'model') return INVALID;
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_CHARS) return INVALID;
    turns.push({ role, text });
  }
  // Gemini requires history to open on a user turn and expects the request to
  // end on one.
  if (turns[0].role !== 'user') return INVALID;
  if (turns[turns.length - 1].role !== 'user') return INVALID;
  return turns;
}

/** Renders the trimmed ledger the client sent into a compact prompt table. */
function renderLedger(ledger: any, language: string): string {
  const rows = Array.isArray(ledger?.rows) ? ledger.rows.slice(0, MAX_LEDGER_ROWS) : [];
  if (rows.length === 0) {
    return language === 'ar' ? 'لا توجد سجلات مالية بعد.' : 'The user has no records yet.';
  }
  const total = Number(ledger?.total) || rows.length;
  const header =
    rows.length < total
      ? `Showing the ${rows.length} most recent of ${total} total records. Older records are NOT included — if a question needs them, say so instead of guessing.`
      : `All ${total} records the user has:`;
  const table = rows
    .map(
      (r: any) =>
        `${r.date} | ${r.type} | ${r.category || '-'} | ${r.amount} ${r.currency} | ${r.title}${r.notes ? ` | ${r.notes}` : ''}`,
    )
    .join('\n');
  return `${header}\ndate | type | category | amount | title | notes\n${table}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = await verifyUser(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    incomes = [],
    expenses = [],
    jamiyaCount = 0,
    wishlistCount = 0,
    language = 'ar',
    defaultCurrency = 'LYD',
    messages,
    ledger,
  } = req.body || {};

  // Chat history is untrusted input heading for a metered API — bound it here,
  // same reason verifyUser exists.
  const chat = validateMessages(messages);
  if (chat === INVALID) {
    res.status(400).json({
      error: language === 'ar' ? 'محادثة غير صالحة.' : 'Invalid chat history.',
    });
    return;
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: language === 'ar'
          ? 'مفتاح واجهة برمجة التطبيقات لـ Gemini غير متاح في السيرفر حالياً.'
          : 'Gemini API key is not configured on the container server.',
      });
      return;
    }

    const totalIncome = incomes.reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const totalExpenses = expenses.reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const balance = totalIncome - totalExpenses;

    const ai = getGenAI();

    const systemInstruction = language === 'ar'
      ? `أنت خبير مالي ومنظم شخصي يدعى "عزيز". قم بتقديم نصيحة مالية موجزة وعالية الجودة في 3-4 نقاط مخصصة باللغة العربية بناءً على البيانات المالية المقدمة للمستخدم. تجنب الهياكل النصية المعقدة واكتب ردوداً تلائم الثقافة الليبية والاحتياجات المالية العادية للشباب والأفراد الماليين بمحبة. استخدم عملة ${defaultCurrency === 'LYD' ? 'دينار ليبي د.ل' : 'دولار امريكي $'} كمرجع دائم.`
      : `You are "Aziz", an elite financial expert and personal budget architect. Render precise, high-fidelity budget tips in 3-4 bullet points based on the user's data context, tailored for custom culture preferences. Always reference ${defaultCurrency} as the currency context. Make suggestions friendly, motivating, and focus on practical steps. Keep output structured in simple reader-friendly markdown.`;

    // Chat mode: same persona, but the user drives and the ledger goes in the
    // system instruction so the growing history doesn't re-send it every turn.
    if (chat) {
      const chatInstruction = `${
        language === 'ar'
          ? `أنت "عزيز"، مستشار مالي شخصي. أجب على أسئلة المستخدم حول سجله المالي بدقة وباللغة العربية. اعتمد فقط على البيانات أدناه — إذا لم تكن الإجابة موجودة فيها قل ذلك بوضوح ولا تخمّن. العملة المرجعية ${defaultCurrency === 'LYD' ? 'دينار ليبي د.ل' : 'دولار امريكي $'}. كن موجزاً واستخدم markdown بسيط.`
          : `You are "Aziz", a personal finance advisor. Answer the user's questions about their own ledger precisely. Use ONLY the data below — if the answer is not in it, say so plainly instead of guessing. Reference currency is ${defaultCurrency}. Be concise and use simple markdown.`
      }

Financial summary:
- Total income: ${totalIncome}
- Total expenses: ${totalExpenses}
- Current balance: ${balance}
- Active Jamiya rotating groups: ${jamiyaCount}
- Planned wishlist purchases: ${wishlistCount}

Ledger:
${renderLedger(ledger, language)}`;

      const chatResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: chat.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        config: { systemInstruction: chatInstruction, temperature: 0.4 },
      });

      res.json({
        advice:
          chatResponse.text ||
          (language === 'ar' ? 'لم أتمكن من صياغة رد.' : 'No reply could be generated.'),
      });
      return;
    }

    const prompt = `
        User current financial metrics:
        - Total Inward Flow (Income): ${totalIncome}
        - Total Outward Flow (Expenses): ${totalExpenses}
        - Current Balance: ${balance}
        - Active Jamiya Rotating Groups count: ${jamiyaCount}
        - Upcoming Planned wishlist purchases: ${wishlistCount}

        Provide high-level, practical planning and saving feedback. Mention how they can adjust their wishlist budget if they are in deficit, or congratulate them on their smart cycle tracking in their rotating groups.
      `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    const adviceText = response.text || (language === 'ar' ? 'عذراً لا تتوفر استشارة حالية.' : 'No active advice retrieved.');
    res.json({ advice: adviceText });
  } catch (err: any) {
    console.error('Gemini advisory proxy error:', err);
    res.status(500).json({
      error: language === 'ar'
        ? `فشل استدعاء الذكاء الاصطناعي: ${err.message}`
        : `AI system processing failed: ${err.message}`,
    });
  }
}
