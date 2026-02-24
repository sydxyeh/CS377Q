import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { Task, GameState, Subtask } from '../../../App.native';
import CuteAvatar from './CuteAvatar';

type NavigationProp = BottomTabNavigationProp<{
  Braindump: undefined;
  Tasks: undefined;
  Buddy: undefined;
  Stats: undefined;
}>;
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
} from '../services/audioRecording';
import { transcribeAudio, isTranscriptionAvailable } from '../services/transcription';
import { transcriptToTaskTitles, generateSubtasks, isSplitTaskAvailable } from '../services/splitTask';

interface BraindumpModeProps {
  onTasksCreated: (tasks: Task[]) => void;
  gameState: GameState;
}

function AddSubtaskRow({ taskId, onAdd }: { taskId: string; onAdd: (taskId: string, text: string) => void }) {
  const [text, setText] = useState('');
  const handleAdd = () => {
    onAdd(taskId, text);
    setText('');
  };
  return (
    <View style={reviewStyles.addSubtaskRow}>
      <TextInput
        style={reviewStyles.addSubtaskInput}
        value={text}
        onChangeText={setText}
        placeholder="+ Add subtask"
        placeholderTextColor="#9ca3af"
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <TouchableOpacity style={reviewStyles.addSubtaskButton} onPress={handleAdd} disabled={!text.trim()}>
        <Ionicons name="add-circle" size={24} color={text.trim() ? '#9333ea' : '#d1d5db'} />
      </TouchableOpacity>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addSubtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#374151',
  },
  addSubtaskButton: { padding: 4 },
});

export default function BraindumpMode({ onTasksCreated, gameState }: BraindumpModeProps) {
  const navigation = useNavigation<NavigationProp>();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean>(true);
  const [reviewTasks, setReviewTasks] = useState<Task[] | null>(null);
  const [splittingReviewTaskId, setSplittingReviewTaskId] = useState<string | null>(null);
  const [tasksConfirmed, setTasksConfirmed] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const transcriptionQueueRef = useRef<string[]>([]);
  const isTranscribingRef = useRef(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ guard against double "Create Tasks" presses / queued taps
  const processingRef = useRef(false);

  // Animation values for pulsing mic button
  const micButtonScale = useSharedValue(1);
  
  // Animation values for ripple waves
  const ripple1Scale = useSharedValue(0);
  const ripple1Opacity = useSharedValue(0.4);
  const ripple2Scale = useSharedValue(0);
  const ripple2Opacity = useSharedValue(0.4);
  const ripple3Scale = useSharedValue(0);
  const ripple3Opacity = useSharedValue(0.4);

  // Animation values for listening dots
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);

  // Pulsing animation for mic button
  useEffect(() => {
    if (isRecording) {
      micButtonScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else {
      micButtonScale.value = withTiming(1.0, { duration: 300 });
    }
  }, [isRecording]);

  // Listening dots animation
  useEffect(() => {
    if (isRecording) {
      const animateDots = () => {
        dot1Opacity.value = withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        );
        dot2Opacity.value = withDelay(200, withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ));
        dot3Opacity.value = withDelay(400, withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ));
      };

      // Start animation loop
      const interval = setInterval(animateDots, 1200);
      animateDots(); // Start immediately

      return () => clearInterval(interval);
    } else {
      dot1Opacity.value = withTiming(0.3);
      dot2Opacity.value = withTiming(0.3);
      dot3Opacity.value = withTiming(0.3);
    }
  }, [isRecording]);

  // Ripple wave animations
  useEffect(() => {
    if (isRecording) {
      // Function to start a ripple animation
      const startRipple = (scale: typeof ripple1Scale, opacity: typeof ripple1Opacity) => {
        scale.value = 0;
        opacity.value = 0.4;
        scale.value = withTiming(2.5, {
          duration: 2000,
          easing: Easing.out(Easing.ease),
        });
        opacity.value = withTiming(0, { duration: 2000 });
      };

      // Start first ripple immediately
      startRipple(ripple1Scale, ripple1Opacity);
      
      // Start ripple 2 after delay
      const timeout2 = setTimeout(() => {
        startRipple(ripple2Scale, ripple2Opacity);
      }, 700);

      // Start ripple 3 after longer delay
      const timeout3 = setTimeout(() => {
        startRipple(ripple3Scale, ripple3Opacity);
      }, 1400);

      // Repeat pattern every 2 seconds
      const repeatInterval = setInterval(() => {
        startRipple(ripple1Scale, ripple1Opacity);
        setTimeout(() => startRipple(ripple2Scale, ripple2Opacity), 700);
        setTimeout(() => startRipple(ripple3Scale, ripple3Opacity), 1400);
      }, 2000);

      return () => {
        clearTimeout(timeout2);
        clearTimeout(timeout3);
        clearInterval(repeatInterval);
      };
    } else {
      // Reset ripples when not recording
      ripple1Scale.value = withTiming(0, { duration: 200 });
      ripple1Opacity.value = withTiming(0, { duration: 200 });
      ripple2Scale.value = withTiming(0, { duration: 200 });
      ripple2Opacity.value = withTiming(0, { duration: 200 });
      ripple3Scale.value = withTiming(0, { duration: 200 });
      ripple3Opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording]);

  // Animated styles
  const micButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micButtonScale.value }],
  }));

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple1Scale.value }],
    opacity: ripple1Opacity.value,
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple2Scale.value }],
    opacity: ripple2Opacity.value,
  }));

  const ripple3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple3Scale.value }],
    opacity: ripple3Opacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: dot1Opacity.value,
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: dot2Opacity.value,
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: dot3Opacity.value,
  }));

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

  const buildTasksFromTitles = (titles: string[]): Task[] =>
    titles.map((title, i) => ({
      id: `task-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      subtasks: [],
      createdAt: new Date(),
    }));

  const fallbackParseTitles = (text: string): string[] =>
    text
      .toLowerCase()
      .split(/(?:and also|also|and|oh and|maybe|,|;)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  const parseAndCreateTasks = async (text: string) => {
    if (processingRef.current) return; // ✅ prevents “doubles”
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const titles = await transcriptToTaskTitles(text);
      const tasks = titles.length > 0 ? buildTasksFromTitles(titles) : buildTasksFromTitles(fallbackParseTitles(text));
      setReviewTasks(JSON.parse(JSON.stringify(tasks)));
    } catch (_) {
      const titles = fallbackParseTitles(text);
      const tasks = buildTasksFromTitles(titles);
      setReviewTasks(JSON.parse(JSON.stringify(tasks)));
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  const updateReviewTask = (taskId: string, updates: Partial<Pick<Task, 'title'>> & { subtasks?: Subtask[] }) => {
    setReviewTasks(prev => prev ? prev.map(t => t.id === taskId ? { ...t, ...updates } : t) : null);
  };

  const addReviewSubtask = (taskId: string, text: string) => {
    if (!text.trim()) return;
    setReviewTasks(prev => {
      if (!prev) return null;
      return prev.map(t => {
        if (t.id !== taskId) return t;
        const newSub: Subtask = {
          id: `${taskId}-sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: text.trim(),
          completed: false,
        };
        return { ...t, subtasks: [...t.subtasks, newSub] };
      });
    });
  };

  const updateReviewSubtask = (taskId: string, subtaskId: string, text: string) => {
    setReviewTasks(prev => prev ? prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, text } : s) };
    }) : null);
  };

  const removeReviewSubtask = (taskId: string, subtaskId: string) => {
    setReviewTasks(prev => prev ? prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) };
    }) : null);
  };

  const removeReviewTask = (taskId: string) => {
    setReviewTasks(prev => (prev ? prev.filter(t => t.id !== taskId) : null));
  };

  const addReviewSubtasks = (taskId: string, labels: string[]) => {
    if (labels.length === 0) return;
    const ts = Date.now();
    const newSubs: Subtask[] = labels.map((text, i) => ({
      id: `${taskId}-sub-${ts}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      text: text.trim(),
      completed: false,
    }));
    setReviewTasks(prev => prev ? prev.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, ...newSubs] } : t) : null);
  };

  const handleSplitReviewTask = async (task: Task) => {
    if (!isSplitTaskAvailable()) {
      Alert.alert('API key required', 'Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env to use Split task.', [{ text: 'OK' }]);
      return;
    }
    setSplittingReviewTaskId(task.id);
    try {
      const labels = await generateSubtasks(task.title);
      addReviewSubtasks(task.id, labels);
    } catch (err) {
      Alert.alert('Split failed', err instanceof Error ? err.message : 'Could not split task. Try again.', [{ text: 'OK' }]);
    } finally {
      setSplittingReviewTaskId(null);
    }
  };

  const confirmReviewTasks = () => {
    if (reviewTasks && reviewTasks.length > 0) {
      const toAdd: Task[] = reviewTasks.map((t) => ({
        id: String(t.id),
        title: String(t.title ?? ''),
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks.map((s) => ({ id: String(s.id), text: String(s.text ?? ''), completed: Boolean(s.completed) }))
          : [],
        createdAt: new Date(),
      }));
      onTasksCreated(toAdd);
    }
    setTasksConfirmed(true);
  };

  const goToTaskList = () => {
    setReviewTasks(null);
    setTasksConfirmed(false);
    setTranscript('');
    navigation.navigate('Tasks');
  };

  const cancelReviewTasks = () => {
    setReviewTasks(null);
    setTasksConfirmed(false);
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
    if (transcript) return "Got it! Ready to create tasks when you are! ✨";
    return "Tell me what's on your mind! 💭";
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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

      {/* Mic Card (boxed + centered) */}
      <View style={[styles.voiceCard, isRecording && styles.voiceCardRecording]}>
        {/* Ripple waves container */}
        <View style={styles.rippleContainer}>
          <Animated.View style={[styles.ripple, ripple1Style]} />
          <Animated.View style={[styles.ripple, ripple2Style]} />
          <Animated.View style={[styles.ripple, ripple3Style]} />
        </View>

        {/* Animated mic button */}
        <Animated.View style={micButtonAnimatedStyle}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isProcessing || hasPermission === false || !isApiConfigured}
            activeOpacity={0.9}
          >
            <Ionicons name={isRecording ? "mic-off" : "mic"} size={56} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Enhanced listening state text */}
        <View style={styles.recordLabelContainer}>
          {isRecording ? (
            <View style={styles.listeningContainer}>
              <Ionicons name="radio-button-on" size={16} color="#9333ea" />
              <Text style={styles.recordLabelListening}>Listening</Text>
              <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, dot1Style]} />
                <Animated.View style={[styles.dot, dot2Style]} />
                <Animated.View style={[styles.dot, dot3Style]} />
              </View>
            </View>
          ) : (
            <Text style={styles.recordLabel}>Tap to start braindump</Text>
          )}
        </View>
        <Text style={styles.recordHint}>
          Say whatever's on your mind. No structure needed.
        </Text>

        {/* Done button - appears when recording */}
        {isRecording && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleStopRecording}
            activeOpacity={0.85}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}

        {transcript && isRecording && (
          <View style={styles.liveTranscript}>
            <Text style={styles.liveTranscriptText}>{transcript}</Text>
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

      {/* Transcribing indicator - fixed at bottom */}
      {isTranscribing && (
        <View style={styles.transcribingIndicator}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.transcribingText}>Transcribing audio...</Text>
        </View>
      )}

      <Modal
        visible={reviewTasks !== null}
        animationType="slide"
        transparent
        onRequestClose={cancelReviewTasks}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {tasksConfirmed ? "Tasks added! 🎉" : "Do these tasks look good?"}
            </Text>

            {!tasksConfirmed ? (
              <>
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {reviewTasks?.map((task) => (
                    <View key={task.id} style={styles.reviewTaskCard}>
                      <View style={styles.reviewTaskTitleRow}>
                        <TextInput
                          style={[styles.reviewTaskTitleInput, { flex: 1 }]}
                          value={task.title}
                          onChangeText={(title) => updateReviewTask(task.id, { title })}
                          placeholder="Task title"
                          placeholderTextColor="#9ca3af"
                        />
                        {isSplitTaskAvailable() && (
                          splittingReviewTaskId === task.id ? (
                            <View style={styles.reviewSplitButton}>
                              <ActivityIndicator size="small" color="#9333ea" />
                            </View>
                          ) : (
                            <TouchableOpacity style={styles.reviewSplitButton} onPress={() => handleSplitReviewTask(task)} activeOpacity={0.85}>
                              <Text style={styles.reviewSplitButtonText}>Split into subtasks</Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                      {task.subtasks.map((sub, subIdx) => (
                        <View key={`${task.id}-sub-${subIdx}`} style={styles.reviewSubtaskRow}>
                          <TextInput
                            style={styles.reviewSubtaskInput}
                            value={sub.text}
                            onChangeText={(text) => updateReviewSubtask(task.id, sub.id, text)}
                            placeholder="Subtask"
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity onPress={() => removeReviewSubtask(task.id, sub.id)} style={styles.reviewSubtaskRemove}>
                            <Ionicons name="close-circle" size={22} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <AddSubtaskRow taskId={task.id} onAdd={addReviewSubtask} />
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalButtonSecondary} onPress={cancelReviewTasks} activeOpacity={0.9}>
                    <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButtonPrimary, (!reviewTasks || reviewTasks.length === 0) && styles.modalButtonPrimaryDisabled]}
                    onPress={confirmReviewTasks}
                    activeOpacity={0.9}
                    disabled={!reviewTasks || reviewTasks.length === 0}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.modalButtonPrimaryText}>Add to my tasks</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={goToTaskList}
                  activeOpacity={0.9}
                >
                  <Ionicons name="list" size={20} color="#fff" />
                  <Text style={styles.modalButtonPrimaryText}>Go to Task List</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', position: 'relative' },
  scrollView: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 80 },

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
    position: 'relative',
    overflow: 'hidden',
  },
  voiceCardRecording: {
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#e9d5ff',
  },
  rippleContainer: {
    position: 'absolute',
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    top: 32,
  },
  ripple: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#3b82f6',
  },
  recordButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  recordButtonActive: { backgroundColor: '#9333ea' },
  recordLabelContainer: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordLabelListening: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9333ea',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9333ea',
  },
  doneButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneButtonText: {
    color: '#9333ea',
    fontSize: 16,
    fontWeight: '700',
  },
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
  transcribingIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#eff6ff',
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 100,
  },
  transcribingText: { fontSize: 14, color: '#1e40af', fontWeight: '500' },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addSubtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#374151',
  },
  addSubtaskButton: { padding: 4 },
  reviewTaskCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewTaskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reviewTaskRemove: { padding: 4 },
  reviewTaskTitleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  reviewSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  reviewSubtaskInput: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewSubtaskRemove: { padding: 4 },
  reviewSplitRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, marginBottom: 4 },
  reviewSplitButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSplitButtonText: { fontSize: 13, fontWeight: '600', color: '#9333ea' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9333ea',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalButtonPrimaryDisabled: { opacity: 0.5 },
  modalButtonSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalButtonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalButtonSecondaryText: { color: '#6b7280', fontSize: 16, fontWeight: '600' },
});