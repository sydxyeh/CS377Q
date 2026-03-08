/**
 * Prioritization: rule-based sort, optional AI order, and "recommended task" for the agent.
 */

import type { Task, TaskPriority } from "../../../App.native";
import {
  parseISO,
  startOfDay,
  isBefore,
  isToday,
  differenceInDays,
} from "date-fns";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function priorityRank(t: Task): number {
  return t.priority ? PRIORITY_ORDER[t.priority] : 0;
}

function dueDateKey(t: Task): string {
  if (!t.dueDate) return "9999-12-31";
  return t.dueDate;
}

function isOverdue(dueDateStr: string): boolean {
  try {
    return isBefore(
      startOfDay(parseISO(dueDateStr)),
      startOfDay(new Date()),
    );
  } catch {
    return false;
  }
}

/**
 * Rule-based sort: overdue first, then by due date ascending, then by priority (high → low), then by createdAt.
 * Does not mutate the input array.
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    const aOverdue = a.dueDate ? isOverdue(a.dueDate) : false;
    const bOverdue = b.dueDate ? isOverdue(b.dueDate) : false;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.dueDate && b.dueDate) {
      const aKey = dueDateKey(a);
      const bKey = dueDateKey(b);
      if (aKey !== bKey) return aKey.localeCompare(bKey);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const priDiff = priorityRank(b) - priorityRank(a);
    if (priDiff !== 0) return priDiff;
    const aCreated =
      a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as unknown as string).getTime();
    const bCreated =
      b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as unknown as string).getTime();
    return aCreated - bCreated;
  });
  return copy;
}

function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
  if (!key) return null;
  const cleaned = key.replace(/\r\n|\r|\n/g, "").trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    return cleaned.slice(1, -1).trim();
  }
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Optional AI-suggested order. Returns tasks in suggested order; falls back to rule-based sort on error or no key.
 */
export async function suggestOrderWithAI(tasks: Task[]): Promise<Task[]> {
  if (tasks.length <= 1) return sortTasksByPriority(tasks);
  const apiKey = getApiKey();
  if (!apiKey) return sortTasksByPriority(tasks);

  const taskSummaries = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate ?? null,
    priority: t.priority ?? null,
    subtaskCount: t.subtasks?.length ?? 0,
  }));

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 500,
        system: `You order tasks for someone with ADHD: consider due dates, urgency, and small first steps. Reply with only a JSON array of task IDs in the order the user should do them first. Example: ["id1","id2","id3"]. No explanation.`,
        messages: [
          {
            role: "user",
            content: `Order these tasks (return JSON array of ids only):\n${JSON.stringify(taskSummaries)}`,
          },
        ],
      }),
    });
  } catch {
    return sortTasksByPriority(tasks);
  }

  const body = await response.text();
  if (!response.ok) return sortTasksByPriority(tasks);

  let raw: string | undefined;
  try {
    const data = JSON.parse(body) as { content?: Array<{ type: string; text?: string }> };
    raw = data.content?.find((c) => c.type === "text")?.text?.trim();
  } catch {
    return sortTasksByPriority(tasks);
  }
  if (!raw) return sortTasksByPriority(tasks);

  let json = raw;
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) json = codeMatch[1].trim();

  try {
    const ids = JSON.parse(json) as unknown;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string"))
      return sortTasksByPriority(tasks);
    const idSet = new Set(ids as string[]);
    const ordered: Task[] = [];
    for (const id of ids as string[]) {
      const task = tasks.find((t) => t.id === id);
      if (task) ordered.push(task);
    }
    for (const t of tasks) {
      if (!idSet.has(t.id)) ordered.push(t);
    }
    return ordered.length > 0 ? ordered : sortTasksByPriority(tasks);
  } catch {
    return sortTasksByPriority(tasks);
  }
}

/**
 * Returns the recommended task to start with and a short reason. Uses rule-based order.
 */
export function getRecommendedTask(
  tasks: Task[],
): { task: Task; reason: string } | null {
  if (tasks.length === 0) return null;
  const sorted = sortTasksByPriority(tasks);
  const task = sorted[0];
  let reason: string;
  if (task.dueDate) {
    if (isOverdue(task.dueDate)) reason = "Overdue";
    else if (isToday(parseISO(task.dueDate))) reason = "Due today";
    else {
      const days = differenceInDays(
        startOfDay(parseISO(task.dueDate)),
        startOfDay(new Date()),
      );
      reason = days === 1 ? "Due tomorrow" : `Due in ${days} days`;
    }
  } else if (task.priority === "high") {
    reason = "High priority";
  } else if (task.subtasks?.length > 0) {
    reason = "Small first step";
  } else {
    reason = "Next on your list";
  }
  return { task, reason };
}
