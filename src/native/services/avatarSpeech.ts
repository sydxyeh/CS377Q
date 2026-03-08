/**
 * Simple text-to-speech for avatar messages so the avatar feels more interactive.
 * Speaks a few set phrases when they appear in the UI (braindump + buddy).
 */

import * as Speech from 'expo-speech';

const PHRASE_MAP: { match: string | RegExp; speak: string }[] = [
  { match: "Tell me what's on your mind!", speak: "Tell me what's on your mind." },
  { match: "Let me organize that for you!", speak: "Let me organize that for you." },
  { match: "Got it! Ready to create tasks when you are!", speak: "Okay, I got it! Let me list out these tasks for you." },
  { match: "I'm listening... keep going!", speak: "I'm listening. Keep going." },
  { match: /Hey there!.*Tell me what you're working on!/, speak: "Hey there! I'm here to help you stay on track. Tell me what you're working on." },
];

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|💭|🎯|💜|✨|👋|🌟/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * If the displayed message is one of our set phrases, speak it (without emojis).
 * For Buddy "Start with X — reason" replies, speak the cleaned text.
 * Call when the avatar message changes so we don't repeat on every render.
 */
export function speakAvatarMessageIfSet(displayedMessage: string): void {
  const trimmed = displayedMessage.trim();
  for (const { match, speak } of PHRASE_MAP) {
    const matches = typeof match === 'string' ? trimmed.includes(match) : match.test(trimmed);
    if (matches) {
      Speech.speak(speak, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
      return;
    }
  }
  if (trimmed.includes('Start with') && trimmed.includes('—')) {
    Speech.speak(stripEmoji(trimmed.replace(/\*\*(.*?)\*\*/g, '$1')), {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  }
}

/**
 * Stop any current avatar speech (e.g. when leaving the screen).
 */
export function stopAvatarSpeech(): void {
  Speech.stop();
}
