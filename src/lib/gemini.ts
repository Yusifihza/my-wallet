export interface GeminiPart {
  text?: string;
  thought?: boolean;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

export interface GeminiCallSuccess {
  ok: true;
  text: string;
  model: string;
}

export interface GeminiCallFailure {
  ok: false;
  status: number;
  rateLimited: boolean;
  authError: boolean;
  errorSummary: string;
}

export type GeminiCallResult = GeminiCallSuccess | GeminiCallFailure;

/**
 * Active free-tier multimodal Gemini models as of late 2026.
 * New Google AI Studio projects cannot access legacy 2.0 / 2.5-flash models (HTTP 404),
 * so current 3.x / 4-hydrogen models are tried first, with legacy 2.5 kept as fallback.
 */
export const PRIMARY_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

const EXCLUDED_MODEL_PATTERN =
  /tts|image|live|transcribe|embedding|aqa|imagen|veo|lyria|robotics|computer-use|vision-001|audio/i;

function scoreDiscoveredModel(id: string): number {
  let score = 0;
  if (/flash-lite/i.test(id)) score += 40;
  else if (/flash/i.test(id)) score += 35;
  else if (/hydrogen/i.test(id)) score += 32;
  else if (/gemma/i.test(id)) score += 10;
  if (/gemini-4/i.test(id)) score += 20;
  else if (/gemini-3\.8/i.test(id)) score += 18;
  else if (/gemini-3\.6/i.test(id)) score += 16;
  else if (/gemini-3\.5/i.test(id)) score += 15;
  else if (/gemini-3/i.test(id)) score += 12;
  if (/preview|exp/i.test(id)) score -= 5;
  return score;
}

async function discoverAvailableModels(
  apiKey: string,
  alreadyTried: Set<string>
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const candidates = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, '').trim())
      .filter(
        (id) =>
          Boolean(id) &&
          !alreadyTried.has(id) &&
          /gemini/i.test(id) &&
          !EXCLUDED_MODEL_PATTERN.test(id)
      )
      .sort((a, b) => scoreDiscoveredModel(b) - scoreDiscoveredModel(a));
    return candidates.slice(0, 4);
  } catch {
    return [];
  }
}

function extractResponseText(payload: {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  // Prefer non-thought text parts (Gemini 3.x / 2.5 thinking models may emit thought parts first)
  const answerText = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (answerText) return answerText;
  return parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}

export async function callGeminiGenerateContent(options: {
  apiKey: string;
  parts: GeminiPart[];
  jsonMode?: boolean;
  maxOutputTokens?: number;
}): Promise<GeminiCallResult> {
  const { apiKey, parts, jsonMode = false, maxOutputTokens = 4096 } = options;

  // Avoid deprecated sampling parameters (temperature, topP, topK, candidateCount)
  // so requests stay 100% compatible with Gemini 3.5+, 3.8, 4 Hydrogen, and 2.5.
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const bodyJson = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig,
  });

  const tried = new Set<string>();
  const errors: string[] = [];
  let rateLimited = false;
  let authError = false;

  const tryModels = async (modelList: readonly string[]): Promise<GeminiCallSuccess | null> => {
    for (const model of modelList) {
      if (tried.has(model)) continue;
      tried.add(model);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyJson,
        });

        if (res.status === 401 || res.status === 403) {
          authError = true;
          let detail = `HTTP ${res.status}`;
          try {
            const errJson = (await res.json()) as { error?: { message?: string } };
            if (errJson.error?.message) detail = errJson.error.message.slice(0, 120);
          } catch {
            // ignore
          }
          errors.push(`${model}: ${detail}`);
          // Auth error applies to the API key itself; no need to keep looping
          return null;
        }

        if (res.status === 429) {
          rateLimited = true;
          errors.push(`${model}: HTTP 429`);
          continue;
        }

        if (!res.ok) {
          errors.push(`${model}: HTTP ${res.status}`);
          continue;
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
        };
        const text = extractResponseText(data);
        if (text) {
          return { ok: true, text, model };
        }
        errors.push(`${model}: respons kosong`);
      } catch (err) {
        errors.push(
          `${model}: ${err instanceof Error ? err.message.slice(0, 60) : 'network error'}`
        );
      }
    }
    return null;
  };

  const primaryHit = await tryModels(PRIMARY_GEMINI_MODELS);
  if (primaryHit) return primaryHit;

  if (!authError) {
    const discovered = await discoverAvailableModels(apiKey, tried);
    if (discovered.length > 0) {
      const discoveredHit = await tryModels(discovered);
      if (discoveredHit) return discoveredHit;
    }
  }

  return {
    ok: false,
    status: authError ? 403 : rateLimited ? 429 : 502,
    rateLimited,
    authError,
    errorSummary: errors.slice(0, 3).join(' | ') || 'Tidak ada model Gemini yang merespons',
  };
}
