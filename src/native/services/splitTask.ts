/**
 * AI service to split a task into 3-5 clear, useful subtasks (meaningful phases).
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
 * Generate 3-5 subtask labels as clear, useful phases (not overly granular).
 * Each step can group related actions so the list is actionable without being overwhelming.
 * @param taskTitle - The main task title
 * @param exclude - Optional list of suggestion texts to avoid; the model will be asked to suggest different ones
 */
export async function generateSubtasks(taskTitle: string, exclude?: string[]): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use Split task.'
    );
  }

  const excludeInstruction =
    exclude && exclude.length > 0
      ? ` Do NOT suggest any of these (the user already saw them): ${JSON.stringify(exclude)}. Suggest completely different alternatives instead.`
      : '';

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
          'You break down a task into 3-5 clear, useful subtasks. Each subtask should be a meaningful phase—concrete enough to act on, but not overly granular. It is fine to combine related actions into one step (e.g. "Grab clothes from dryer, fold clothes and put back into the closet"). Avoid both tiny micro-steps and vague or huge steps. The result should help someone see the main stages of the task and get it done without overwhelm. Reply with only a JSON array of strings, one per subtask. No numbering, no explanation. Good example for "Do the laundry": ["Load dirty clothes into washer", "Move clothes into dryer", "Grab clothes from dryer, fold clothes and put back into the closet"].' +
          excludeInstruction,
        messages: [
          {
            role: 'user',
            content: `Break "${taskTitle}" into 3-5 clear, useful subtasks (meaningful phases, not micro-steps). Each step can group related actions. Output only a JSON array of strings:`,
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

export interface TaskTitleWithDue {
  title: string;
  dueDate?: string; // YYYY-MM-DD
}

/**
 * Extract task titles and optional due dates from a voice transcript.
 * E.g. "Buy groceries due tomorrow" -> { title: "Buy groceries", dueDate: "2025-03-08" }.
 * Returns array of { title, dueDate? }. dueDate is ISO date string YYYY-MM-DD when mentioned.
 */
export async function transcriptToTaskTitlesWithDueDates(
  transcript: string
): Promise<TaskTitleWithDue[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file.'
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

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
        system: `You extract a list of tasks from a voice transcript. For each task, output a short title and an optional due date if the user said one (e.g. "due tomorrow", "by Friday", "next week").
Rules:
- Remove filler ("I need to", "um", "like"). Output only a JSON array of objects.
- Each object: { "title": "Short task title" } or { "title": "Short task title", "dueDate": "YYYY-MM-DD" }.
- dueDate must be YYYY-MM-DD only. If the user said "tomorrow" use ${tomorrowStr}. If they said "today" use ${todayStr}. For "next week" use 7 days from today. For weekday names, use the next occurrence of that day.
- No numbering or explanation. Example: [{"title": "Buy groceries", "dueDate": "2025-03-08"}, {"title": "Call mom"}]`,
        messages: [
          {
            role: 'user',
            content: `Extract task titles and any due dates from this transcript:\n\n${trimmed}`,
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
    const items = arr
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
      .map((o) => {
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        const dueDate =
          typeof o.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate)
            ? o.dueDate
            : undefined;
        return { title, dueDate };
      })
      .filter((item) => item.title.length > 0);
    return items;
  } catch (_) {
    const titles = transcriptToTaskTitles(transcript);
    return titles.then((t) => t.map((title) => ({ title })));
  }
}

/**
 * Use the voice transcript to edit or add subtasks for a task.
 * Given the task title, current subtasks, and what the user said, returns the new list of subtask texts.
 * Can add, remove, reorder, or edit. Returns a JSON array of strings.
 */
export async function transcriptToSubtaskEdits(
  taskTitle: string,
  currentSubtaskTexts: string[],
  transcript: string
): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file.'
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) return currentSubtaskTexts;

  const currentList =
    currentSubtaskTexts.length > 0
      ? JSON.stringify(currentSubtaskTexts)
      : 'No subtasks yet';

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
        system: `You help the user edit subtasks for a single task using their voice instructions.
Task title: "${taskTitle}"
Current subtasks (in order): ${currentList}

The user will speak instructions to add, remove, reorder, or edit these subtasks. Interpret their intent and output the final list of subtask texts only.
- Reply with a JSON array of strings, one per subtask, in the order they should appear.
- No numbering, no explanation. Example: ["Open the file", "Write one sentence", "Save"].
- If they say to add something, append it. If they say to remove one, omit it. If they reorder or rephrase, reflect that.`,
        messages: [
          {
            role: 'user',
            content: `User said: "${trimmed}"\n\nOutput the new subtasks list as a JSON array of strings:`,
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
    if (!Array.isArray(arr)) return currentSubtaskTexts;
    const strings = arr
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return strings;
  } catch (_) {
    const lines = raw
      .split(/\n/)
      .map((s) => s.replace(/^[\d\-*.]+\s*/, '').trim())
      .filter((s) => s.length > 0);
    return lines.length > 0 ? lines : currentSubtaskTexts;
  }
}
