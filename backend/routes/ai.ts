// /api/ai routes — a thin, authenticated proxy to Google Gemini so the
// API key never reaches the browser. The frontend must send its JWT.

import { Router } from 'express';
import { authenticateRest } from '../auth/restAuth';
import { generateText, generateChat } from '../services/gemini';

export const aiRouter = Router();

aiRouter.use(authenticateRest);

// POST /api/ai/generate  body: { prompt, model? }
aiRouter.post('/generate', async (req, res, next) => {
  try {
    const { prompt, model } = req.body ?? {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    const text = await generateText(prompt, { model });
    res.json({ text });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/chat  body: { messages: [{ role, text }], model? }
aiRouter.post('/chat', async (req, res, next) => {
  try {
    const { messages, model } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages must be a non-empty array' });
      return;
    }
    const sanitized: Array<{ role: 'user' | 'model'; text: string }> = messages.map((m: any) => ({
      role: m.role === 'model' ? ('model' as const) : ('user' as const),
      text: typeof m.text === 'string' ? m.text : String(m.text ?? ''),
    }));
    const text = await generateChat(sanitized, { model });
    res.json({ text });
  } catch (err) {
    next(err);
  }
});
