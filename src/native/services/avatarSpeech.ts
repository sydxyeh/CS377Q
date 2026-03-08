/**
 * Avatar speech is disabled (was text-to-speech for avatar messages).
 * Message text still appears on screen; no voice is played.
 */

/**
 * No-op: avatar voice is disabled. Message text still shows in the UI.
 */
export function speakAvatarMessageIfSet(_displayedMessage: string): void {
  // Voice disabled — avatar messages are visual only.
}

/**
 * No-op: nothing to stop when voice is disabled.
 */
export function stopAvatarSpeech(): void {
  // Voice disabled.
}
