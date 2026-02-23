/**
 * Audio recording utilities using expo-av for React Native
 */

import { Audio } from 'expo-av';

export interface RecordingState {
  recording: Audio.Recording | null;
  uri: string | null;
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
}

/**
 * Check if audio recording is supported
 */
export function isAudioRecordingSupported(): boolean {
  return true; // expo-av is always available in React Native
}

/**
 * Start recording audio
 */
export async function startRecording(): Promise<Audio.Recording> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    return recording;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        throw new Error('Microphone permission denied. Please allow microphone access in your device settings.');
      }
    }
    throw new Error('Failed to start recording. Please check your microphone permissions.');
  }
}

/**
 * Stop recording and get audio file URI
 */
export async function stopRecording(recording: Audio.Recording): Promise<string> {
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    if (!uri) {
      throw new Error('Failed to get audio file URI');
    }

    return uri;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already been unloaded')) {
        // Recording was already stopped, try to get URI if available
        const uri = recording.getURI();
        if (uri) return uri;
      }
      throw error;
    }
    throw new Error('Failed to stop recording.');
  }
}

/**
 * Convert audio URI to Blob for API upload
 */
export async function uriToBlob(uri: string): Promise<Blob> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  } catch (error) {
    throw new Error('Failed to convert audio file to blob.');
  }
}

