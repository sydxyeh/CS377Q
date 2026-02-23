import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import type { Task, GameState } from '../../../App.native';
import CuteAvatar from './CuteAvatar';
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
} from '../services/audioRecording';
import { transcribeAudio, isTranscriptionAvailable } from '../services/transcription';

interface BraindumpModeProps {
  onTasksCreated: (tasks: Task[]) => void;
  gameState: GameState;
}

export default function BraindumpMode({ onTasksCreated, gameState }: BraindumpModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean>(true);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const transcriptionQueueRef = useRef<string[]>([]);
  const isTranscribingRef = useRef(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ guard against double “Create Tasks” presses / queued taps
  const processingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const permission = await requestMicrophonePermission();
      setHasPermission(permission);
      if (!permission) setError('Microphone permission is required for voice input.');
    })();

    const apiConfigured = isTranscriptionAvailable();
    setIsApiConfigured(apiConfigured);
    if (!apiConfigured) {
      setError('Google Cloud API key is not configured. Please add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file.');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const processTranscriptionQueue = useCallback(async () => {
    if (isTranscribingRef.current || transcriptionQueueRef.current.length === 0) return;

    isTranscribingRef.current = true;
    setIsTranscribing(true);

    while (transcriptionQueueRef.current.length > 0) {
      const uri = transcriptionQueueRef.current.shift();
      if (!uri) continue;

      try {
        const transcribedText = await transcribeAudio(uri);
        if (transcribedText.trim()) {
          setTranscript(prev => {
            const newText = prev ? `${prev} ${transcribedText}` : transcribedText;
            return newText.trim();
          });
        }
      } catch (err) {
        console.error('Transcription error:', err);
        setError(err instanceof Error ? err.message : 'Failed to transcribe audio. Please try again.');
      }
    }

    isTranscribingRef.current = false;
    setIsTranscribing(false);
  }, []);

  const handleStartRecording = async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is required for voice input. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isApiConfigured) {
      Alert.alert(
        'API Key Required',
        'Google Cloud API key is not configured. Please add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file.',
        [{ text: 'OK' }]
      );
      return;
    }

    setError(null);
    setTranscript('');
    transcriptionQueueRef.current = [];

    try {
      const recording = await startRecording();
      recordingRef.current = recording;
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(async () => {
        if (recordingRef.current && !isTranscribingRef.current) {
          try {
            const uri = await stopRecording(recordingRef.current);

            transcriptionQueueRef.current.push(uri);

            const newRecording = await startRecording();
            recordingRef.current = newRecording;

            if (!isTranscribingRef.current) processTranscriptionQueue();
          } catch (err) {
            console.error('Error in recording interval:', err);
          }
        }
      }, 4000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      const finalUri = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setIsRecording(false);

      if (finalUri) {
        setIsTranscribing(true);
        try {
          const finalTranscript = await transcribeAudio(finalUri);
          if (finalTranscript.trim()) {
            setTranscript(prev => {
              const newText = prev ? `${prev} ${finalTranscript}` : finalTranscript;
              return newText.trim();
            });
          }
        } catch (err) {
          console.error('Final transcription error:', err);
        } finally {
          setIsTranscribing(false);
        }
      }

      await processTranscriptionQueue();
    } catch (err) {
      console.error('Error stopping recording:', err);
      if (err instanceof Error) setError(err.message);
      setIsRecording(false);
    }
  };

  // ✅ LOGIC SAME, but with a guard to prevent double creation
  const parseAndCreateTasks = (text: string) => {
    if (processingRef.current) return; // ✅ prevents “doubles”
    processingRef.current = true;

    setIsProcessing(true);

    setTimeout(() => {
      const tasks: Task[] = [];

      const segments = text.toLowerCase()
        .split(/(?:and also|also|and|oh and|maybe|,|;)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      segments.forEach((segment) => {
        const taskId = Date.now().toString() + Math.random();
        let title = segment.charAt(0).toUpperCase() + segment.slice(1);
        const subtasks: { id: string; text: string; completed: boolean }[] = [];

        if (segment.includes('clean')) {
          title = 'Clean room';
          subtasks.push(
            { id: taskId + '_1', text: 'Pick up clothes', completed: false },
            { id: taskId + '_2', text: 'Make bed', completed: false },
            { id: taskId + '_3', text: 'Vacuum floor', completed: false }
          );
        } else if (segment.includes('project') || segment.includes('work')) {
          title = 'Finish work project';
          subtasks.push(
            { id: taskId + '_1', text: 'Review requirements', completed: false },
            { id: taskId + '_2', text: 'Complete draft', completed: false },
            { id: taskId + '_3', text: 'Send for review', completed: false }
          );
        } else if (segment.includes('call')) {
          title = 'Call mom';
          subtasks.push(
            { id: taskId + '_1', text: 'Find a quiet time', completed: false },
            { id: taskId + '_2', text: 'Make the call', completed: false }
          );
        } else if (segment.includes('organize') || segment.includes('desk')) {
          title = 'Organize desk';
          subtasks.push(
            { id: taskId + '_1', text: 'Clear desk surface', completed: false },
            { id: taskId + '_2', text: 'Sort papers', completed: false },
            { id: taskId + '_3', text: 'Arrange supplies', completed: false }
          );
        } else if (segment.includes('download')) {
          title = 'Download files';
          subtasks.push(
            { id: taskId + '_1', text: 'Find download links', completed: false },
            { id: taskId + '_2', text: 'Download files', completed: false },
            { id: taskId + '_3', text: 'Organize in folders', completed: false }
          );
        } else {
          subtasks.push(
            { id: taskId + '_1', text: `Start: ${title}`, completed: false },
            { id: taskId + '_2', text: `Complete: ${title}`, completed: false }
          );
        }

        tasks.push({
          id: taskId,
          title,
          subtasks,
          createdAt: new Date()
        });
      });

      onTasksCreated(tasks);

      setIsProcessing(false);
      setTranscript('');

      processingRef.current = false; // ✅ release
    }, 1500);
  };

  const getAvatarMood = () => {
    if (isProcessing) return 'excited';
    if (isRecording) return 'happy';
    if (transcript) return 'proud';
    return 'neutral';
  };

  const getAvatarMessage = () => {
    if (isProcessing) return "Let me organize that for you! 🎯";
    if (isRecording) return "I'm listening... keep going! 💜";
    if (transcript) return "Got it! Ready when you are! ✨";
    return "Tell me what's on your mind! 💭";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCard}>
        <CuteAvatar mood={getAvatarMood()} size="md" />
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{getAvatarMessage()}</Text>
        </View>
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <View style={styles.errorTextContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text style={styles.errorDismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {hasPermission === false && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={20} color="#f59e0b" />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningText}>Microphone permission is required for voice input.</Text>
            <Text style={styles.warningSubtext}>Please enable it in your device settings.</Text>
          </View>
        </View>
      )}

      {!isApiConfigured && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={20} color="#f59e0b" />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningText}>Google Cloud API key is not configured.</Text>
            <Text style={styles.warningSubtext}>Please add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file.</Text>
          </View>
        </View>
      )}

      {isTranscribing && (
        <View style={styles.infoCard}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.infoText}>Transcribing audio...</Text>
        </View>
      )}

      {/* Mic Card (boxed + centered) */}
      <View style={styles.voiceCard}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isProcessing || hasPermission === false || !isApiConfigured}
          activeOpacity={0.9}
        >
          <Ionicons name={isRecording ? "mic-off" : "mic"} size={40} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.recordLabel}>
          {isRecording ? 'Listening...' : 'Tap to start braindump'}
        </Text>
        <Text style={styles.recordHint}>
          Say whatever's on your mind. No structure needed.
        </Text>

        {transcript && isRecording && (
          <View style={styles.liveTranscript}>
            <Text style={styles.liveTranscriptText}>{transcript}</Text>
            {isTranscribing && <Text style={styles.liveTranscriptInterim}>Transcribing...</Text>}
          </View>
        )}
      </View>

      {transcript && !isProcessing && !isRecording && (
        <View style={styles.transcriptCard}>
          <View style={styles.transcriptContent}>
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          </View>

          <View style={styles.transcriptActions}>
            <TouchableOpacity
              style={[styles.createButton, styles.createButtonPrimary, isProcessing && styles.buttonDisabled]}
              onPress={() => parseAndCreateTasks(transcript)}
              disabled={isProcessing}
              activeOpacity={0.9}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, styles.createButtonSecondary]}
              onPress={() => setTranscript('')}
              disabled={isProcessing}
              activeOpacity={0.9}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, gap: 16 },

  avatarCard: {
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageBox: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12 },
  messageText: { fontSize: 14, color: '#1f2937' },

  voiceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: { backgroundColor: '#ef4444' },
  recordLabel: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  recordHint: { fontSize: 14, color: '#6b7280', textAlign: 'center' },

  transcriptCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  transcriptContent: { marginBottom: 12 },
  transcriptText: { fontSize: 16, color: '#374151', fontStyle: 'italic' },

  transcriptActions: { flexDirection: 'row', gap: 8 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
  },
  createButtonPrimary: { backgroundColor: '#9333ea' },
  createButtonSecondary: { backgroundColor: '#f3f4f6' },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  clearButtonText: { color: '#6b7280', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 12,
  },
  errorContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  errorTextContainer: { flex: 1 },
  errorText: { fontSize: 14, color: '#991b1b', fontWeight: '500' },
  errorDismiss: { fontSize: 12, color: '#dc2626', marginTop: 4, textDecorationLine: 'underline' },

  warningCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningTextContainer: { flex: 1 },
  warningText: { fontSize: 14, color: '#92400e', fontWeight: '500' },
  warningSubtext: { fontSize: 12, color: '#a16207', marginTop: 4 },

  infoCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: { fontSize: 14, color: '#1e40af' },

  liveTranscript: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    maxHeight: 120,
    width: '100%',
  },
  liveTranscriptText: { fontSize: 14, color: '#374151', fontStyle: 'italic' },
  liveTranscriptInterim: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 },
});