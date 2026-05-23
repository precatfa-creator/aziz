/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

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

  app.use(express.json());

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
