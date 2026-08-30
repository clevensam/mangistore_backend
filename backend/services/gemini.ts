// Server-side wrapper around the Google Gemini API.
// The API key lives only on the backend — never exposed to the browser.

import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

// Returns just the text of the first candidate.
export async function generateText(prompt: string, options?: { model?: string }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const client = new GoogleGenAI({ apiKey });
  const model = options?.model || GEMINI_MODEL;

  const response = await client.models.generateContent({
    model,
    contents: prompt,
  });

  return response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

// Chat-style completion from a list of messages.
export async function generateChat(
  messages: GeminiMessage[],
  options?: { model?: string },
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const client = new GoogleGenAI({ apiKey });
  const model = options?.model || GEMINI_MODEL;

  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const response = await client.models.generateContent({
    model,
    contents: contents as any,
  });

  return response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}
