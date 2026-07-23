/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Lazily initialize GenAI only on demand to prevent startup crashes if key is initially absent
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
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAIClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Route A: Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API Route B: Gemini AI Financial Advisory Advisor (Server-side model call)
  app.post('/api/ai/advise', async (req, res) => {
    const { incomes = [], expenses = [], jamiyaCount = 0, wishlistCount = 0, language = 'ar', defaultCurrency = 'LYD' } = req.body || {};
    try {
      // 1. Double check api key existence
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: language === 'ar' 
            ? 'مفتاح واجهة برمجة التطبيقات لـ Gemini غير متاح في السيرفر حالياً.' 
            : 'Gemini API key is not configured on the container server.'
        });
      }

      // 2. Build concise prompt context
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
          temperature: 0.8
        }
      });

      const adviceText = response.text || (language === 'ar' ? 'عذراً لا تتوفر استشارة حالية.' : 'No active advice retrieved.');
      res.json({ advice: adviceText });

    } catch (err: any) {
      console.error('Gemini advisory proxy error:', err);
      res.status(500).json({ 
        error: language === 'ar' 
          ? `فشل استدعاء الذكاء الاصطناعي: ${err.message}` 
          : `AI system processing failed: ${err.message}` 
      });
    }
  });

  // API Route C: AI Excel/CSV Sheet Structure Analyzer
  app.post('/api/ai/analyze-sheet', async (req, res) => {
    const { text = '', language = 'ar' } = req.body || {};
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: language === 'ar' 
            ? 'مفتاح واجهة برمجة التطبيقات لـ Gemini غير متاح في السيرفر حالياً.' 
            : 'Gemini API key is not configured on the container server.'
        });
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: language === 'ar' 
            ? 'محتوى لم يتم العثور عليه. الرجاء لصق البيانات أولاً.' 
            : 'No spreadsheet content found. Please paste or upload your content first.'
        });
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
            description: "A friendly, high-level user explanation in the requested language describing how you mapped the spreadsheet headers and matched the columns."
          },
          entries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: {
                  type: Type.STRING,
                  description: "Transaction Date formatted strictly as YYYY-MM-DD."
                },
                title: {
                  type: Type.STRING,
                  description: "Brief identifier or description of the transaction item."
                },
                amount: {
                  type: Type.NUMBER,
                  description: "The positive absolute decimal/float amount value of the transaction."
                },
                currency: {
                  type: Type.STRING,
                  description: "Must be exactly 'LYD' or 'USD'."
                },
                categoryName: {
                  type: Type.STRING,
                  description: "The literal original classification name/family from the cell exactly as is, without translation or validation."
                },
                type: {
                  type: Type.STRING,
                  description: "Must be exactly 'income' or 'expense'."
                },
                notes: {
                  type: Type.STRING,
                  description: "Any remaining cell details, comments, references or info associated with this row."
                }
              },
              required: ["date", "title", "amount", "currency", "type"]
            }
          }
        },
        required: ["explanation", "entries"]
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1, // low temperature for precise factual extraction
          responseMimeType: 'application/json',
          responseSchema
        }
      });

      const parsedJSON = JSON.parse(response.text || '{}');
      res.json(parsedJSON);

    } catch (err: any) {
      console.error('AI Sheet Analysis failure:', err);
      res.status(500).json({
        error: language === 'ar'
          ? `فشل تحليل الذكاء الاصطناعي للملف: ${err.message}`
          : `AI Sheet analysis execution failed: ${err.message}`
      });
    }
  });

  // Vite integration middleware configuration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aziz Financial Server running on port ${PORT}`);
  });
}

startServer();
