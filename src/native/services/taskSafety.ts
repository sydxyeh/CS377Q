const UNSAFE_TASK_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|injure|attack|stab|poison|shoot|murder)\s+(myself|me)\b/i,
  /\b(end|take)\s+my\s+life\b/i,
  /\bcommit\s+suicide\b/i,
  /\bsuicide\b/i,
  /\bself[-\s]?harm\b/i,
  /\boverdose\b/i,
  /\b(kill|hurt|harm|injure|attack|stab|poison|shoot|murder)\s+(someone|somebody|others?|him|her|them|person|people)\b/i,
  /\b(plan|ways?)\s+to\s+(kill|hurt|harm|attack|injure)\b/i,
];

export const isTaskUnsafe = (taskTitle: string): boolean => {
  const normalized = taskTitle.trim();
  if (!normalized) return false;
  return UNSAFE_TASK_PATTERNS.some((pattern) => pattern.test(normalized));
};
