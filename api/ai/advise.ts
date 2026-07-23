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

  const { incomes = [], expenses = [], jamiyaCount = 0, wishlistCount = 0, language = 'ar', defaultCurrency = 'LYD' } = req.body || {};
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
