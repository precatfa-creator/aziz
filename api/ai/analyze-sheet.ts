import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
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

  const { text = '', language = 'ar' } = req.body || {};
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: language === 'ar'
          ? 'مفتاح واجهة برمجة التطبيقات لـ Gemini غير متاح في السيرفر حالياً.'
          : 'Gemini API key is not configured on the container server.',
      });
      return;
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({
        error: language === 'ar'
          ? 'محتوى لم يتم العثور عليه. الرجاء لصق البيانات أولاً.'
          : 'No spreadsheet content found. Please paste or upload your content first.',
      });
      return;
    }

    const ai = getGenAI();

    const systemInstruction = language === 'ar'
      ? 'أنت معالج مالي ذكي متخصص في تنظيم وتنظيف جداول البيانات المجهولة أو القديمة لغرض تسجيل الأرشيف. قم بدراسة وتحليل محتويات الجدول المنسوق أو ملف الـ CSV المرسل؛ ميز الأعمدة بحنكة (التاريخ، الوصف/العنوان، المبلغ، العملة، التصنيف، والنوع إن وجد). رتبها وسجلها كبيانات ممهورة بصيغة الـ JSON المحددة.'
      : 'You are an intelligent financial data preprocessing wizard. Analyze the pasted table text or raw CSV rows from a spreadsheet containing historical records. Auto-detect columns indexes corresponding to Dates, Titles, Amounts, Currencies, Categories, and Types. Correct structures, formats, and map rows into the requested neat JSON blueprint.';

    const prompt = `
        Analyze the following pasted spreadsheet table / CSV rows. Do not validate categories against any predefined lists; preserve whatever custom category label is present in the sheet of the user.
        Format all dates as ISO YYYY-MM-DD. If year is missing of or ambiguous, assume year 2026.
        Currency should be designated strictly as "LYD" or "USD". If not found or contains 'د.ل' or 'دينار' use "LYD", if contains '$' or 'دولار' or 'USD' use "USD". Default to LYD.
        Ensure transaction types are either 'income' (for wages, entry, profit, revenue, deposit, etc) or 'expense' (for bills, purchases, spent, exit, shopping, etc).

        Here is the spreadsheet content to parse:
        """
        ${text}
        """
      `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        explanation: {
          type: Type.STRING,
          description: 'A friendly, high-level user explanation in the requested language describing how you mapped the spreadsheet headers and matched the columns.',
        },
        entries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: {
                type: Type.STRING,
                description: 'Transaction Date formatted strictly as YYYY-MM-DD.',
              },
              title: {
                type: Type.STRING,
                description: 'Brief identifier or description of the transaction item.',
              },
              amount: {
                type: Type.NUMBER,
                description: 'The positive absolute decimal/float amount value of the transaction.',
              },
              currency: {
                type: Type.STRING,
                description: "Must be exactly 'LYD' or 'USD'.",
              },
              categoryName: {
                type: Type.STRING,
                description: 'The literal original classification name/family from the cell exactly as is, without translation or validation.',
              },
              type: {
                type: Type.STRING,
                description: "Must be exactly 'income' or 'expense'.",
              },
              notes: {
                type: Type.STRING,
                description: 'Any remaining cell details, comments, references or info associated with this row.',
              },
            },
            required: ['date', 'title', 'amount', 'currency', 'type'],
          },
        },
      },
      required: ['explanation', 'entries'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const parsedJSON = JSON.parse(response.text || '{}');
    res.json(parsedJSON);
  } catch (err: any) {
    console.error('AI Sheet Analysis failure:', err);
    res.status(500).json({
      error: language === 'ar'
        ? `فشل تحليل الذكاء الاصطناعي للملف: ${err.message}`
        : `AI Sheet analysis execution failed: ${err.message}`,
    });
  }
}
