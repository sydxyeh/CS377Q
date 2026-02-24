/**
 * AI service to split a task into 2-5 concrete subtasks.
 * Uses Anthropic API. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.
 */

function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
  if (!key) return null;
  // Trim and remove newlines/carriage returns (common when pasting into .env)
  let cleaned = key.replace(/\r\n|\r|\n/g, '').trim();
  // Remove surrounding quotes if present (e.g. from .env)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.length > 0 ? cleaned : null;
}

export function isSplitTaskAvailable(): boolean {
  return !!getApiKey();
}

/**
 * Generate 2-5 subtask labels as micro steps to help someone with ADHD get started and avoid getting stuck.
 */
export async function generateSubtasks(taskTitle: string): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use Split task.'
    );
  }

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        system:
          'You break down tasks into 2-5 micro steps for someone with ADHD. Each step should be tiny and concrete so they can get started without overwhelm and not get stuck. The first step should be the smallest possible (e.g. "Open the doc" or "Get out one ingredient") to lower the barrier to start. Avoid vague or big steps. Reply with only a JSON array of strings, one per micro step. No numbering, no explanation. Example: ["Open the file", "Write one sentence", "Save"].',
        messages: [
          {
            role: 'user',
            content: `Break "${taskTitle}" into 2-5 micro steps that help someone get started and keep momentum (ADHD-friendly, tiny first step):`,
          },
        ],
      }),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    throw new Error(`Network error: ${msg}. Check your connection.`);
  }

  const body = await response.text();

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const j = JSON.parse(body) as { error?: { message?: string; type?: string } };
      if (j.error?.message) message = j.error.message;
      else if (j.error?.type) message = `${j.error.type}: ${message}`;
    } catch (_) {
      if (body.length < 200) message = body || message;
    }
    throw new Error(message);
  }

  let data: { content?: Array<{ type: string; text?: string }> };
  try {
    data = JSON.parse(body) as { content?: Array<{ type: string; text?: string }> };
  } catch (_) {
    throw new Error('Invalid response from API');
  }
  const raw = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';

  // Parse JSON array (allow markdown code block)
  let json = raw;
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) json = codeMatch[1].trim();

  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) throw new Error('Response is not an array');
    const strings = arr
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (strings.length < 2) return strings;
    return strings.slice(0, 5);
  } catch (_) {
    // Fallback: split by newline and clean
    const lines = raw
      .split(/\n/)
      .map((s) => s.replace(/^[\d\-*.]+\s*/, '').trim())
      .filter((s) => s.length > 0);
    return lines.slice(0, 5).length >= 2 ? lines.slice(0, 5) : [raw.trim()];
  }
}

/**
 * Clean a voice transcript and extract simple task titles using the LLM.
 * Strips filler ("I need to", "I want to", "um", etc.) and returns short task titles only.
 * Returns a JSON array of strings. Throws if API key missing or request fails.
 */
export async function transcriptToTaskTitles(transcript: string): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file.'
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) return [];

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        system:
          'You extract a list of simple task titles from a voice transcript. Remove filler (e.g. "I need to", "I want to", "um", "like", "so"). Output only a JSON array of strings—short task titles, one per task. No numbering or explanation. Example: ["Buy groceries", "Call mom", "Finish report"].',
        messages: [
          {
            role: 'user',
            content: `Extract simple task titles from this transcript:\n\n${trimmed}`,
          },
        ],
      }),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    throw new Error(`Network error: ${msg}. Check your connection.`);
  }

  const body = await response.text();

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const j = JSON.parse(body) as { error?: { message?: string; type?: string } };
      if (j.error?.message) message = j.error.message;
      else if (j.error?.type) message = `${j.error.type}: ${message}`;
    } catch (_) {
      if (body.length < 200) message = body || message;
    }
    throw new Error(message);
  }

  let data: { content?: Array<{ type: string; text?: string }> };
  try {
    data = JSON.parse(body) as { content?: Array<{ type: string; text?: string }> };
  } catch (_) {
    throw new Error('Invalid response from API');
  }
  const raw = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';

  let json = raw;
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) json = codeMatch[1].trim();

  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    const titles = arr
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return titles;
  } catch (_) {
    const lines = raw
      .split(/\n/)
      .map((s) => s.replace(/^[\d\-*.]+\s*/, '').trim())
      .filter((s) => s.length > 0);
    return lines;
  }
}
