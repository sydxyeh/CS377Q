/**
 * Transcription service using Google Cloud Speech-to-Text API for React Native
 */

export interface TranscriptionResponse {
  text: string;
  error?: string;
}

/**
 * Get API key from environment variables
 */
function getApiKey(): string {
  // Expo uses EXPO_PUBLIC_ prefix for environment variables
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'Google Cloud API key is not configured. Please add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file.'
    );
  }
  
  return apiKey;
}

/**
 * Convert audio URI to base64 for Google Cloud Speech-to-Text API
 */
async function audioUriToBase64(audioUri: string): Promise<string> {
  try {
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64String.includes(',') 
          ? base64String.split(',')[1] 
          : base64String;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting audio to base64:', error);
    throw new Error('Failed to convert audio file to base64 format.');
  }
}

/**
 * Transcribe audio using Google Cloud Speech-to-Text API
 * @param audioUri - The file URI from expo-av recording
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    // Validate audio URI
    if (!audioUri) {
      throw new Error('Audio file URI is missing');
    }

    const apiKey = getApiKey();

    // Convert audio to base64
    const audioBase64 = await audioUriToBase64(audioUri);

    // Google Cloud Speech-to-Text API endpoint
    const apiUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    // Prepare the request body
    // Note: expo-av typically records in M4A format (AAC encoding)
    // Google Cloud Speech-to-Text supports: FLAC, LINEAR16, MULAW, AMR, AMR_WB, OGG_OPUS, SPEEX_WITH_HEADER_BYTE, MP3
    // Since M4A isn't directly supported, we'll try MP3 encoding first
    // If this doesn't work, you may need to convert the audio to a supported format
    const requestBody = {
      config: {
        encoding: 'MP3', // Try MP3 first; if issues occur, consider converting audio to FLAC or LINEAR16
        sampleRateHertz: 44100, // Common sample rate for expo-av
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
      },
      audio: {
        content: audioBase64,
      },
    };

    // Make API request
    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error('Error calling Google Speech-to-Text API:', error);
      throw new Error(`Network error during transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your Google Cloud API key.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      
      const errorMessage = errorData.error?.message || `API error: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    let result: any;
    try {
      result = await response.json();
    } catch (error) {
      console.error('Failed to parse transcription response:', error);
      throw new Error('Failed to parse transcription response');
    }

    // Extract transcript from response
    if (result.results && result.results.length > 0) {
      const transcripts = result.results
        .map((r: any) => r.alternatives?.[0]?.transcript || '')
        .filter((t: string) => t.trim().length > 0);
      
      return transcripts.join(' ');
    }

    // No transcription found
    return '';
  } catch (error) {
    // Log the full error for debugging
    console.error('Transcription error details:', error);
    
    if (error instanceof Error) {
      // Re-throw known errors with their original messages
      if (
        error.message.includes('API key') ||
        error.message.includes('Rate limit') ||
        error.message.includes('too large') ||
        error.message.includes('timed out') ||
        error.message.includes('Network error') ||
        error.message.includes('Invalid API key') ||
        error.message.includes('missing') ||
        error.message.includes('Invalid response')
      ) {
        throw error;
      }

      // Preserve network error messages
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Network')) {
        throw error;
      }

      // For other errors, include the original message
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }

    // Fallback for non-Error objects
    throw new Error(`Failed to transcribe audio: ${String(error)}`);
  }
}

/**
 * Check if transcription service is available (API key configured)
 */
export function isTranscriptionAvailable(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
}

