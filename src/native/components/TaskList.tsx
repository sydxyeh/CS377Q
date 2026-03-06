import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Modal, Keyboard, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import type { Task, GameState, FinishedTask, Subtask } from '../../../App.native';
import { format } from 'date-fns';
import { generateSubtasks, isSplitTaskAvailable, transcriptToSubtaskEdits } from '../services/splitTask';
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
} from '../services/audioRecording';
import { transcribeAudio, isTranscriptionAvailable } from '../services/transcription';

type TasksSubTab = 'current' | 'completed';

interface TaskListProps {
  tasks: Task[];
  finishedTasks: FinishedTask[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onCompleteTask: (taskId: string) => void;
  onConfirmCompleteTask?: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onReorderTasks?: (reordered: Task[]) => void;
  completedTabJustUpdated?: boolean;
  gameState: GameState;
}

export default function TaskList({
  tasks,
  finishedTasks,
  onToggleSubtask,
  onAddSubtask,
  onCompleteTask,
  onConfirmCompleteTask,
  onUpdateTask,
  onReorderTasks,
  completedTabJustUpdated,
  gameState
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<TasksSubTab>('current');
  const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<{ taskId: string; subtaskId: string } | null>(null);
  const [draftSubtaskText, setDraftSubtaskText] = useState('');
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const completingOpacityRef = useRef(new Animated.Value(1)).current;
  const completingSlideRef = useRef(new Animated.Value(0)).current;
  const completedTabPulseRef = useRef(new Animated.Value(1)).current;
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(null);
  const [draftTaskTitle, setDraftTaskTitle] = useState('');

  const [voiceTask, setVoiceTask] = useState<Task | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const refillInProgressRef = useRef(false);

  const [addSubtaskFocusedTaskId, setAddSubtaskFocusedTaskId] = useState<string | null>(null);
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<Record<string, string[]>>({});
  const [subtaskSuggestionsLoading, setSubtaskSuggestionsLoading] = useState<string | null>(null);
  const [subtaskSuggestionsRefreshingTaskId, setSubtaskSuggestionsRefreshingTaskId] = useState<string | null>(null);
  const [showChooseTaskForSubtaskHelper, setShowChooseTaskForSubtaskHelper] = useState(false);

  const [orderedIds, setOrderedIds] = useState<string[]>(() => tasks.map(t => t.id));
  const prevTaskCountRef = useRef(tasks.length);

  useEffect(() => {
    setOrderedIds(tasks.map(t => t.id));
  }, [tasks]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setAddSubtaskFocusedTaskId(null));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!completingTaskId) return;
    const screenWidth = Dimensions.get('window').width;
    completingOpacityRef.setValue(1);
    completingSlideRef.setValue(0);
    const opacityAnim = Animated.timing(completingOpacityRef, {
      toValue: 0.72,
      duration: 600,
      useNativeDriver: true,
    });
    const slideAnim = Animated.sequence([
      Animated.delay(400),
      Animated.timing(completingSlideRef, {
        toValue: screenWidth + 80,
        duration: 1800,
        useNativeDriver: true,
      }),
    ]);
    opacityAnim.start();
    slideAnim.start();
    return () => {
      opacityAnim.stop();
      slideAnim.stop();
    };
  }, [completingTaskId]);

  useEffect(() => {
    if (completingTaskId && !tasks.some(t => t.id === completingTaskId)) {
      setCompletingTaskId(null);
      completingOpacityRef.setValue(1);
      completingSlideRef.setValue(0);
    }
  }, [completingTaskId, tasks]);

  useEffect(() => {
    if (completedTabJustUpdated) {
      completedTabPulseRef.setValue(1);
      Animated.sequence([
        Animated.timing(completedTabPulseRef, {
          toValue: 1.35,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(completedTabPulseRef, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [completedTabJustUpdated]);

  // Auto-expand newly created tasks
  useEffect(() => {
    if (tasks.length > prevTaskCountRef.current) {
      // New tasks added - expand all tasks
      setExpandedTasks(new Set(tasks.map(t => t.id)));
    }
    prevTaskCountRef.current = tasks.length;
  }, [tasks]);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach(t => {
      if (t && String(t.id)) {
        const safe: Task = {
          id: String(t.id),
          title: String(t.title ?? ''),
          subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(s => ({
            id: String(s.id),
            text: String(s.text ?? ''),
            completed: Boolean(s.completed),
          })) : [],
          createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(),
        };
        map.set(safe.id, safe);
      }
    });
    return map;
  }, [tasks]);

  const orderedTasks = useMemo(() => {
    return orderedIds
      .map(id => tasksById.get(id))
      .filter((t): t is Task => t != null);
  }, [orderedIds, tasksById]);

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleAddSubtask = (taskId: string) => {
    const text = newSubtaskText[taskId]?.trim();
    if (!text) return;
    onAddSubtask(taskId, text);
    setNewSubtaskText(prev => ({ ...prev, [taskId]: '' }));
    setSubtaskSuggestions(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(s => s !== text),
    }));
  };

  const fetchSubtaskSuggestions = useCallback(async (task: Task) => {
    if (!isSplitTaskAvailable() || subtaskSuggestionsLoading) return;
    const existingTexts = new Set(task.subtasks.map(s => s.text.trim().toLowerCase()));
    if ((subtaskSuggestions[task.id] || []).length > 0) return;
    setSubtaskSuggestionsLoading(task.id);
    try {
      const labels = await generateSubtasks(task.title);
      const filtered = labels.filter(t => t.trim() && !existingTexts.has(t.trim().toLowerCase())).slice(0, 5);
      setSubtaskSuggestions(prev => ({ ...prev, [task.id]: filtered }));
    } catch (_) {
      setSubtaskSuggestions(prev => ({ ...prev, [task.id]: [] }));
    } finally {
      setSubtaskSuggestionsLoading(null);
    }
  }, [subtaskSuggestionsLoading, subtaskSuggestions]);

  const addSuggestionSubtask = useCallback((taskId: string, text: string) => {
    onAddSubtask(taskId, text);
    setSubtaskSuggestions(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(s => s !== text),
    }));
  }, [onAddSubtask]);

  const removeSuggestion = useCallback((taskId: string, text: string) => {
    setSubtaskSuggestions(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(s => s !== text),
    }));
  }, []);

  const refillSubtaskSuggestions = useCallback(async (task: Task) => {
    if (!isSplitTaskAvailable() || refillInProgressRef.current) return;
    const pool = subtaskSuggestions[task.id] || [];
    if (pool.length >= 3) return;
    refillInProgressRef.current = true;
    try {
      const labels = await generateSubtasks(task.title);
      const existingSet = new Set([
        ...task.subtasks.map(s => s.text.trim().toLowerCase()),
        ...pool.map(s => s.trim().toLowerCase()),
      ]);
      const newOnes = labels
        .filter(t => t.trim() && !existingSet.has(t.trim().toLowerCase()))
        .slice(0, 3 - pool.length);
      if (newOnes.length > 0) {
        setSubtaskSuggestions(prev => ({
          ...prev,
          [task.id]: [...(prev[task.id] || []), ...newOnes],
        }));
      }
    } catch (_) {
      // keep current pool on error
    } finally {
      refillInProgressRef.current = false;
    }
  }, [subtaskSuggestions]);

  const refreshSubtaskSuggestions = useCallback(async (task: Task) => {
    if (!isSplitTaskAvailable() || subtaskSuggestionsRefreshingTaskId || subtaskSuggestionsLoading === task.id) return;
    const existingSet = new Set(task.subtasks.map(s => s.text.trim().toLowerCase()));
    const currentPool = (subtaskSuggestions[task.id] || []).filter(s => !existingSet.has(s.trim().toLowerCase()));
    const lastShown = currentPool.slice(0, 3);
    setSubtaskSuggestionsRefreshingTaskId(task.id);
    try {
      const labels = await generateSubtasks(task.title, lastShown);
      const existingTexts = new Set(task.subtasks.map(s => s.text.trim().toLowerCase()));
      const excludeSet = new Set(lastShown.map(s => s.trim().toLowerCase()));
      const filtered = labels
        .filter(t => t.trim() && !existingTexts.has(t.trim().toLowerCase()) && !excludeSet.has(t.trim().toLowerCase()))
        .slice(0, 5);
      setSubtaskSuggestions(prev => ({ ...prev, [task.id]: filtered }));
    } catch (_) {
      // keep current on error
    } finally {
      setSubtaskSuggestionsRefreshingTaskId(null);
    }
  }, [subtaskSuggestionsRefreshingTaskId, subtaskSuggestionsLoading, subtaskSuggestions]);

  useEffect(() => {
    if (!addSubtaskFocusedTaskId || refillInProgressRef.current) return;
    const task = tasks.find(t => t.id === addSubtaskFocusedTaskId);
    if (!task) return;
    const pool = (subtaskSuggestions[task.id] || []).filter(
      s => !task.subtasks.some(st => st.text.trim().toLowerCase() === s.trim().toLowerCase())
    );
    if (pool.length >= 3) return;
    refillSubtaskSuggestions(task);
  }, [addSubtaskFocusedTaskId, subtaskSuggestions, tasks, refillSubtaskSuggestions]);

  const handleCompletePress = (task: Task) => {
    setTaskToComplete(task);
  };

  const startEditSubtask = (taskId: string, subtaskId: string, currentText: string) => {
    setEditingSubtask({ taskId, subtaskId });
    setDraftSubtaskText(currentText);
  };

  const submitEditSubtask = (task: Task) => {
    if (!editingSubtask || editingSubtask.taskId !== task.id) return;
    const { subtaskId } = editingSubtask;
    const text = draftSubtaskText.trim();
    if (text) {
      const newSubtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, text } : s
      );
      onUpdateTask(task.id, { subtasks: newSubtasks });
    }
    setEditingSubtask(null);
    setDraftSubtaskText('');
  };

  const handleSplitTask = async (task: Task) => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        'API key required',
        'Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use Split task.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSplittingTaskId(task.id);
    try {
      const subtaskLabels = await generateSubtasks(task.title);
      for (const text of subtaskLabels) {
        if (text.trim()) onAddSubtask(task.id, text.trim());
      }
      if (!expandedTasks.has(task.id)) toggleExpanded(task.id);
    } catch (err) {
      Alert.alert(
        'Split task failed',
        err instanceof Error ? err.message : 'Could not generate subtasks. Try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSplittingTaskId(null);
    }
  };

  const openSubtaskHelper = (task: Task) => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        'API key required',
        'Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use the voice subtask helper.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (!isTranscriptionAvailable()) {
      Alert.alert(
        'Voice not available',
        'Add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file to use voice.',
        [{ text: 'OK' }]
      );
      return;
    }
    setVoiceTask(task);
    setVoiceError(null);
  };

  const openSubtaskHelperFloating = () => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        'API key required',
        'Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use the subtasks helper.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (!isTranscriptionAvailable()) {
      Alert.alert(
        'Voice not available',
        'Add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file to use voice.',
        [{ text: 'OK' }]
      );
      return;
    }
    setShowChooseTaskForSubtaskHelper(true);
  };

  const startVoiceRecording = async () => {
    const task = voiceTask;
    if (!task) return;
    setVoiceError(null);
    try {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        setVoiceError('Microphone permission is required.');
        return;
      }
      const recording = await startRecording();
      voiceRecordingRef.current = recording;
      setVoiceRecording(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to start recording.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!voiceRecordingRef.current) {
      setVoiceRecording(false);
      return;
    }
    const task = voiceTask;
    setVoiceRecording(false);
    try {
      const uri = await stopRecording(voiceRecordingRef.current);
      voiceRecordingRef.current = null;
      if (!uri || !task) return;
      setVoiceTranscribing(true);
      setVoiceError(null);
      const transcript = await transcribeAudio(uri);
      setVoiceTranscribing(false);
      if (!transcript.trim()) {
        setVoiceError('No speech detected. Try again.');
        return;
      }
      setVoiceProcessing(true);
      const currentTexts = task.subtasks.map((s) => s.text);
      const newTexts = await transcriptToSubtaskEdits(task.title, currentTexts, transcript);
      const newSubtasks: Subtask[] = newTexts.map((text, i) => ({
        id: `${task.id}-sub-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        text,
        completed: false,
      }));
      onUpdateTask(task.id, { subtasks: newSubtasks });
      setVoiceTask(null);
      setVoiceProcessing(false);
      if (!expandedTasks.has(task.id)) toggleExpanded(task.id);
    } catch (err) {
      setVoiceTranscribing(false);
      setVoiceProcessing(false);
      setVoiceError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  useEffect(() => {
    return () => {
      if (voiceRecordingRef.current) {
        voiceRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  const completedSubtasks = tasks.reduce((acc, task) =>
    acc + task.subtasks.filter(s => s.completed).length, 0);

  const submitTaskTitleEdit = useCallback((taskId: string) => {
    if (editingTaskTitleId !== taskId) return;
    const title = draftTaskTitle.trim();
    if (title) onUpdateTask(taskId, { title });
    setEditingTaskTitleId(null);
    setDraftTaskTitle('');
  }, [editingTaskTitleId, draftTaskTitle, onUpdateTask]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Task>) => {
    const task = item;
    const taskNumber = orderedIds.findIndex(id => id === task.id) + 1;
    const isExpanded = expandedTasks.has(task.id);
    const doneCount = task.subtasks.filter(s => s.completed).length;
    const totalCount = task.subtasks.length;
    const isCompleted = totalCount > 0 && doneCount === totalCount;
    const isEditingTitle = editingTaskTitleId === task.id;
    const isCompleting = completingTaskId === task.id;
    
    const cardContent = (
      <>
        <View style={styles.taskHeader}>
          <TouchableOpacity onLongPress={drag} style={styles.taskDragHandle} activeOpacity={0.8}>
            <Ionicons name="reorder-two" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.taskHeaderContent} 
            onPress={() => !isCompleting && toggleExpanded(task.id)} 
            onLongPress={() => {
              if (!isCompleting) {
                setEditingTaskTitleId(task.id);
                setDraftTaskTitle(task.title);
              }
            }}
            activeOpacity={0.85}
          >
            {isEditingTitle ? (
              <View style={styles.taskTitleRow}>
                <Text style={styles.taskNumberPrefix}>{taskNumber}.</Text>
                <TextInput
                  style={styles.taskTitleInput}
                  value={draftTaskTitle}
                  onChangeText={setDraftTaskTitle}
                  onSubmitEditing={() => submitTaskTitleEdit(task.id)}
                  onBlur={() => submitTaskTitleEdit(task.id)}
                  autoFocus
                  selectTextOnFocus
                  placeholder="Task title"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            ) : (
              <Text style={[styles.taskTitle, isCompleting && styles.taskTitleCompleting]}>
                {taskNumber}. {task.title}
              </Text>
            )}
            {totalCount > 0 && !isCompleting && (
              <Text style={styles.taskMeta}>
                {doneCount}/{totalCount} complete
              </Text>
            )}
            {isCompleting && (
              <Text style={styles.taskMovingLabel}>Moving to completed ✓</Text>
            )}
          </TouchableOpacity>

          {!isCompleting && (
            <TouchableOpacity
              onPress={() => handleCompletePress(task)}
              style={[styles.completeButton, isCompleted && styles.completeButtonDone]}
              activeOpacity={0.85}
            >
              {isCompleted ? (
                <Ionicons name="checkmark-circle" size={26} color="#10b981" />
              ) : (
                <Text style={styles.completeButtonText}>Mark as complete</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.expandHit} onPress={() => !isCompleting && toggleExpanded(task.id)} activeOpacity={0.8}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>

        {isExpanded && !isCompleting && (
          <View style={styles.subtasksContainer}>
            <DraggableFlatList<Subtask>
              data={task.subtasks}
              keyExtractor={(s) => s.id}
              onDragEnd={({ data }) => onUpdateTask(task.id, { subtasks: data })}
              scrollEnabled={false}
              activationDistance={10}
              renderItem={({ item: subtask, drag, isActive }) => {
                const isEditingSubtask =
                  editingSubtask?.taskId === task.id && editingSubtask?.subtaskId === subtask.id;
                const subtaskIndex = task.subtasks.findIndex(s => s.id === subtask.id);
                const subtaskNumber = subtaskIndex + 1;
                const isLastSubtask = subtaskIndex === task.subtasks.length - 1;
                return (
                  <View
                    style={[
                      styles.subtask,
                      !isEditingSubtask && subtask.completed && styles.subtaskCompleted,
                      isActive && styles.subtaskDragging,
                      isLastSubtask && styles.subtaskLast,
                    ]}
                  >
                    <TouchableOpacity onLongPress={drag} style={styles.subtaskDragHandle} activeOpacity={0.8}>
                      <Ionicons name="reorder-two" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    {isEditingSubtask ? (
                      <>
                        <View style={styles.subtaskTitleRow}>
                          <Text style={styles.subtaskNumberPrefix}>{subtaskNumber}.</Text>
                          <TextInput
                            style={styles.subtaskEditInput}
                            value={draftSubtaskText}
                            onChangeText={setDraftSubtaskText}
                            onSubmitEditing={() => submitEditSubtask(task)}
                            onBlur={() => submitEditSubtask(task)}
                            autoFocus
                            selectTextOnFocus
                            multiline
                            numberOfLines={3}
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            onUpdateTask(task.id, {
                              subtasks: task.subtasks.filter((s) => s.id !== subtask.id),
                            });
                            setEditingSubtask(null);
                          }}
                          style={styles.subtaskDeleteButton}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="close" size={18} color="#9333ea" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            const wasCompleting = !subtask.completed;
                            const totalCount = task.subtasks.length;
                            const doneCount = task.subtasks.filter((s) => s.completed).length;
                            const wasLastIncomplete = wasCompleting && doneCount === totalCount - 1;
                            onToggleSubtask(task.id, subtask.id);
                            if (wasLastIncomplete) setTaskToComplete(task);
                          }}
                          style={styles.subtaskCheckboxHit}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.checkbox, subtask.completed && styles.checkboxChecked]}>
                            {subtask.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.subtaskTextHit}
                          onPress={() => startEditSubtask(task.id, subtask.id, subtask.text)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.subtaskText, subtask.completed && styles.subtaskTextCompleted]}>
                            {subtaskNumber}. {subtask.text}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            onUpdateTask(task.id, {
                              subtasks: task.subtasks.filter((s) => s.id !== subtask.id),
                            });
                          }}
                          style={styles.subtaskDeleteButton}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="close" size={18} color="#9333ea" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              }}
            />

            <View style={styles.addSubtaskContainer}>
              <TextInput
                style={styles.addSubtaskInput}
                value={newSubtaskText[task.id] || ''}
                onChangeText={(text) => setNewSubtaskText(prev => ({ ...prev, [task.id]: text }))}
                placeholder="add subtask"
                onSubmitEditing={() => handleAddSubtask(task.id)}
                returnKeyType="done"
                onFocus={() => {
                  setAddSubtaskFocusedTaskId(task.id);
                  fetchSubtaskSuggestions(task);
                }}
                onBlur={() => setAddSubtaskFocusedTaskId(null)}
              />
              <TouchableOpacity
                style={[styles.addButton, !(newSubtaskText[task.id]?.trim()) && styles.addButtonDisabled]}
                onPress={() => handleAddSubtask(task.id)}
                activeOpacity={0.85}
                disabled={!(newSubtaskText[task.id]?.trim())}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {addSubtaskFocusedTaskId === task.id && isSplitTaskAvailable() && (
              <View style={styles.suggestionsPopup}>
                <View style={styles.suggestionsPopupHeader}>
                  <Text style={styles.suggestionsTitle}>Suggestions</Text>
                  <View style={styles.suggestionsHeaderActions}>
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => refreshSubtaskSuggestions(task)}
                      disabled={subtaskSuggestionsLoading === task.id || subtaskSuggestionsRefreshingTaskId === task.id}
                      style={styles.suggestionsRefreshButton}
                      activeOpacity={0.85}
                    >
                      {subtaskSuggestionsRefreshingTaskId === task.id ? (
                        <ActivityIndicator size="small" color="#9333ea" />
                      ) : (
                        <Ionicons name="refresh" size={20} color="#9333ea" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      onPress={() => setAddSubtaskFocusedTaskId(null)}
                      style={styles.suggestionsCloseButton}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={22} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                {subtaskSuggestionsLoading === task.id ? (
                  <View style={styles.suggestionsLoadingRow}>
                    <ActivityIndicator size="small" color="#9333ea" />
                    <Text style={styles.suggestionsLoadingText}>Suggesting subtasks...</Text>
                  </View>
                ) : (() => {
                  const existingSet = new Set(task.subtasks.map(s => s.text.trim().toLowerCase()));
                  const fullList = (subtaskSuggestions[task.id] || []).filter(s => !existingSet.has(s.trim().toLowerCase()));
                  const list = fullList.slice(0, 3);
                  if (list.length === 0) return null;
                  return (
                    <>
                      {list.map((suggestion, idx) => (
                        <View key={idx} style={styles.suggestionChip}>
                          <TouchableOpacity
                            style={styles.suggestionChipMain}
                            onPress={() => addSuggestionSubtask(task.id, suggestion)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="add-circle-outline" size={18} color="#9333ea" />
                            <Text style={styles.suggestionChipText}>{suggestion}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => removeSuggestion(task.id, suggestion)}
                            style={styles.suggestionChipClose}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="close" size={18} color="#9ca3af" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  );
                })()}
              </View>
            )}
          </View>
        )}
      </>
    );
    return isCompleting ? (
      <Animated.View
        style={[
          styles.taskCard,
          styles.taskCardCompleting,
          isActive && styles.taskCardActive,
          {
            opacity: completingOpacityRef,
            transform: [{ translateX: completingSlideRef }],
          },
        ]}
      >
        {cardContent}
      </Animated.View>
    ) : (
      <View style={[styles.taskCard, isCompleted && styles.taskCardCompleted, isActive && styles.taskCardActive]}>
        {cardContent}
      </View>
    );
  }, [expandedTasks, newSubtaskText, onAddSubtask, onCompleteTask, onToggleSubtask, onUpdateTask, splittingTaskId, editingSubtask, draftSubtaskText, editingTaskTitleId, draftTaskTitle, submitTaskTitleEdit, submitEditSubtask, startEditSubtask, tasks, orderedIds, tasksById, onReorderTasks, addSubtaskFocusedTaskId, subtaskSuggestions, subtaskSuggestionsLoading, subtaskSuggestionsRefreshingTaskId, fetchSubtaskSuggestions, addSuggestionSubtask, removeSuggestion, refreshSubtaskSuggestions, completingTaskId, onConfirmCompleteTask]);

  return (
    <View style={styles.container}>
      {/* Subtab: Current | Completed */}
      <View style={styles.subtabBar}>
        <TouchableOpacity
          style={[styles.subtab, activeSubTab === 'current' && styles.subtabActive]}
          onPress={() => setActiveSubTab('current')}
          activeOpacity={0.8}
        >
          <Text style={[styles.subtabEmoji, activeSubTab === 'current' && styles.subtabEmojiActive]}>📝</Text>
          <Text style={[styles.subtabText, activeSubTab === 'current' && styles.subtabTextActive]}>
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subtab, activeSubTab === 'completed' && styles.subtabActive]}
          onPress={() => setActiveSubTab('completed')}
          activeOpacity={0.8}
        >
          <Text style={[styles.subtabEmoji, activeSubTab === 'completed' && styles.subtabEmojiActive]}>🎉</Text>
          <Text style={[styles.subtabText, activeSubTab === 'completed' && styles.subtabTextActive]}>
            Completed
          </Text>
          {finishedTasks.length > 0 && (
            <View style={[styles.subtabBadge, activeSubTab === 'completed' && styles.subtabBadgeActive]}>
              <Text style={[styles.subtabBadgeText, activeSubTab === 'completed' && styles.subtabBadgeTextActive]}>
                {finishedTasks.length}
              </Text>
            </View>
          )}
          {completedTabJustUpdated && (
            <Animated.View style={[styles.subtabUpdatedIcon, { transform: [{ scale: completedTabPulseRef }] }]}>
              <Ionicons name="checkmark-circle" size={18} color={activeSubTab === 'completed' ? '#fff' : '#10b981'} />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {activeSubTab === 'current' ? (
        orderedTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <Ionicons name="list-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Empty list</Text>
              <Text style={styles.emptyText}>Add some tasks through a braindump.</Text>
            </View>
          </View>
        ) : (
          <DraggableFlatList
            data={orderedTasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onDragEnd={({ data }) => {
              setOrderedIds(data.map(t => t.id));
              onReorderTasks?.(data);
            }}
            contentContainerStyle={styles.listContent}
            activationDistance={12}
          />
        )
      ) : (
        <ScrollView style={styles.graveyardScroll} contentContainerStyle={styles.graveyardScrollContent}>
          {finishedTasks.length === 0 ? (
            <View style={styles.graveyardEmpty}>
              <Text style={styles.graveyardEmptyEmoji}>🎉</Text>
              <Text style={styles.graveyardEmptyTitle}>No completed tasks yet</Text>
              <Text style={styles.graveyardEmptyText}>Complete a task to see it here.</Text>
            </View>
          ) : (
            finishedTasks.map((ft) => (
              <View key={ft.id} style={styles.graveyardCard}>
                <Text style={styles.graveyardTaskTitle}>{ft.title}</Text>
                <Text style={styles.graveyardMeta}>
                  Completed {format(new Date(ft.completedAt), 'MMM d, yyyy')}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}


      {activeSubTab === 'current' && tasks.length > 0 && (
        <TouchableOpacity
          style={styles.subtaskHelperFloating}
          onPress={openSubtaskHelperFloating}
          activeOpacity={0.85}
        >
          <Ionicons name="mic" size={22} color="#fff" />
          <Text style={styles.subtaskHelperFloatingText}>Subtasks helper</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showChooseTaskForSubtaskHelper}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChooseTaskForSubtaskHelper(false)}
      >
        <TouchableOpacity
          style={styles.completeModalOverlay}
          activeOpacity={1}
          onPress={() => setShowChooseTaskForSubtaskHelper(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.chooseTaskModalCard}>
            <Text style={styles.subtaskHelperModalTitle}>Choose a task</Text>
            <Text style={styles.subtaskHelperModalMessage}>Tap a task to edit its subtasks with voice.</Text>
            <ScrollView style={styles.chooseTaskModalList} nestedScrollEnabled>
              {orderedTasks.map((t, index) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.chooseTaskModalRow}
                  onPress={() => {
                    setShowChooseTaskForSubtaskHelper(false);
                    setVoiceTask(t);
                    setVoiceError(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chooseTaskModalNumber}>{index + 1}.</Text>
                  <Text style={styles.chooseTaskRowTitle} numberOfLines={2}>{t.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.subtaskHelperCancel}
              onPress={() => setShowChooseTaskForSubtaskHelper(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.subtaskHelperCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={voiceTask !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!voiceRecording && !voiceTranscribing && !voiceProcessing) setVoiceTask(null); }}
      >
        <TouchableOpacity
          style={styles.completeModalOverlay}
          activeOpacity={1}
          onPress={() => { if (!voiceRecording && !voiceTranscribing && !voiceProcessing) setVoiceTask(null); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.voiceModalCard}>
            <Text style={styles.subtaskHelperModalTitle}>Voice agent</Text>
            <Text style={styles.subtaskHelperModalMessage}>
              Tell me how to edit or add subtasks for "{voiceTask?.title}". Tap to record, then tap again to stop.
            </Text>
            {voiceError ? <Text style={styles.voiceErrorText}>{voiceError}</Text> : null}
            {voiceTranscribing && <Text style={styles.voiceStatusText}>Transcribing...</Text>}
            {voiceProcessing && <Text style={styles.voiceStatusText}>Updating subtasks...</Text>}
            {!voiceTranscribing && !voiceProcessing && (
              <TouchableOpacity
                style={[styles.voiceRecordButton, voiceRecording && styles.voiceRecordButtonActive]}
                onPress={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                activeOpacity={0.85}
              >
                <Ionicons name={voiceRecording ? 'stop' : 'mic'} size={36} color="#fff" />
                <Text style={styles.voiceRecordButtonText}>{voiceRecording ? 'Tap to stop' : 'Tap to record'}</Text>
              </TouchableOpacity>
            )}
            {!voiceRecording && !voiceTranscribing && !voiceProcessing && (
              <TouchableOpacity
                style={styles.subtaskHelperCancel}
                onPress={() => setVoiceTask(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.subtaskHelperCancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={taskToComplete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskToComplete(null)}
      >
        <TouchableOpacity
          style={styles.completeModalOverlay}
          activeOpacity={1}
          onPress={() => setTaskToComplete(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.completeModalCard}>
            <View style={styles.completeModalIconWrap}>
              <Text style={styles.completeModalEmoji}>🎉</Text>
            </View>
            <Text style={styles.completeModalTitle}>Complete task?</Text>
            <Text style={styles.completeModalMessage}>
              Move "{taskToComplete?.title}" to completed tasks?
            </Text>
            <View style={styles.completeModalActions}>
              <TouchableOpacity
                style={styles.completeModalButtonCancel}
                onPress={() => setTaskToComplete(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.completeModalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.completeModalButtonConfirm}
                onPress={() => {
                  if (taskToComplete) {
                    setTaskToComplete(null);
                    setCompletingTaskId(taskToComplete.id);
                    if (onConfirmCompleteTask) {
                      onConfirmCompleteTask(taskToComplete);
                    } else {
                      onCompleteTask(taskToComplete.id);
                    }
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.completeModalButtonConfirmText}>Yes, complete it!</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  completeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completeModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  subtaskHelperModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  subtaskHelperModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtaskHelperModalMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtaskHelperOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    marginBottom: 10,
  },
  subtaskHelperOptionText: { fontSize: 15, fontWeight: '600', color: '#1f2937', flex: 1 },
  subtaskHelperCancel: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  subtaskHelperCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  suggestModalCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  suggestModalLoading: { alignItems: 'center', paddingVertical: 32 },
  suggestModalLoadingText: { fontSize: 14, color: '#6b7280', marginTop: 12 },
  suggestModalList: { maxHeight: 240, marginVertical: 12 },
  suggestModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  suggestModalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestModalCheckboxChecked: { backgroundColor: '#9333ea', borderColor: '#9333ea' },
  suggestModalRowText: { fontSize: 15, color: '#1f2937', flex: 1 },
  suggestModalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  voiceModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  voiceErrorText: { fontSize: 13, color: '#dc2626', marginBottom: 12, textAlign: 'center' },
  voiceStatusText: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  voiceRecordButton: {
    backgroundColor: '#9333ea',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceRecordButtonActive: { backgroundColor: '#dc2626' },
  voiceRecordButtonText: { fontSize: 15, fontWeight: '600', color: '#fff', marginTop: 8 },
  completeModalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  completeModalEmoji: { fontSize: 44 },
  completeModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  completeModalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  completeModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  completeModalButtonCancel: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeModalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  completeModalButtonConfirm: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  completeModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 16,
    marginTop: 16,
  },
  statsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statsValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },

  statsRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#6b7280' },

  listContent: { padding: 16, paddingTop: 12, gap: 12 },

  subtabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  subtab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  subtabActive: { backgroundColor: '#9333ea' },
  subtabText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  subtabTextActive: { color: '#fff' },
  subtabEmoji: { fontSize: 16 },
  subtabEmojiActive: { opacity: 1 },
  subtabBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subtabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  subtabBadgeText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  subtabBadgeTextActive: { color: '#fff' },
  subtabUpdatedIcon: { marginLeft: 4 },

  graveyardScroll: { flex: 1 },
  graveyardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
  },
  graveyardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  graveyardEmptyEmoji: { fontSize: 48 },
  graveyardEmptyTitle: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
  graveyardEmptyText: { fontSize: 14, color: '#d1d5db' },

  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  taskCardCompleted: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  taskCardActive: { opacity: 0.95 },
  taskCardCompleting: { borderColor: '#86efac', backgroundColor: '#ecfdf5' },

  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, paddingRight: 16, paddingVertical: 16, gap: 8 },

  dragHandle: { paddingTop: 1, paddingRight: 4 },
  expandHit: { paddingTop: 2, paddingHorizontal: 4 },
  taskDragHandle: { padding: 4, justifyContent: 'center', marginRight: 4 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskNumberPrefix: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  taskCheckboxHit: { paddingTop: 4, paddingBottom: 4, paddingRight: 4, paddingLeft: 8 },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },

  completeTaskButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  completeTaskButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  splitTaskButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  splitTaskButtonText: { fontSize: 12, fontWeight: '600', color: '#9333ea' },

  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  taskActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    minWidth: 110,
  },
  taskActionButtonText: { fontSize: 13, fontWeight: '600', color: '#9333ea' },
  taskActionButtonPlaceholder: { minWidth: 110 },
  taskActionButtonDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#10b981',
    minWidth: 110,
  },
  taskActionButtonDoneText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  graveyardCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  graveyardTaskTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  graveyardMeta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },

  taskHeaderContent: { flex: 1, gap: 6 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  taskTitleCompleting: { textDecorationLine: 'line-through', color: '#6b7280' },
  taskMovingLabel: { fontSize: 13, color: '#10b981', fontWeight: '600', marginTop: 4 },
  taskTitleInput: { fontSize: 16, fontWeight: '600', color: '#1f2937', paddingVertical: 2, paddingHorizontal: 0, flex: 1, borderBottomWidth: 1, borderBottomColor: '#9333ea' },
  taskTitleTouchable: { alignSelf: 'stretch' },
  taskMeta: { fontSize: 12, color: '#6b7280' },

  completeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonDone: { backgroundColor: 'transparent' },
  completeButtonText: { fontSize: 13, fontWeight: '600', color: '#9333ea' },

  editTasksFloating: { position: 'absolute', bottom: 24, right: 20 },
  editTasksButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#ede9fe' },
  editTasksButtonActive: { backgroundColor: '#9333ea' },
  editTasksButtonText: { fontSize: 14, fontWeight: '600', color: '#9333ea' },
  editTasksButtonTextActive: { color: '#fff' },

  subtaskHelperFloating: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#9333ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subtaskHelperFloatingText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  chooseTaskModalCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  chooseTaskModalList: { maxHeight: 320 },
  chooseTaskModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  chooseTaskModalNumber: { fontSize: 15, fontWeight: '600', color: '#6b7280', minWidth: 24 },
  chooseTaskRowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1f2937' },

  subtasksContainer: {
    padding: 0,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  subtask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 16,
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subtaskCompleted: { opacity: 0.7 },
  subtaskLast: { borderBottomWidth: 0 },
  subtaskDragHandle: { padding: 4, justifyContent: 'center', marginRight: 4 },
  subtaskDragging: { opacity: 0.9 },
  subtaskReorderWrap: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 },
  subtaskReorderBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  subtaskCheckboxHit: { paddingTop: 2, paddingBottom: 4, paddingRight: 4, paddingLeft: 0 },
  subtaskTrashHit: { padding: 4, justifyContent: 'center' },
  subtaskDeleteButton: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  subtaskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, flex: 1 },
  subtaskNumberPrefix: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  subtaskTextHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtaskEditInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 40,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9333ea',
    textAlignVertical: 'top',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  subtaskText: { flex: 1, fontSize: 14, color: '#1f2937', fontWeight: '500' },
  subtaskTextCompleted: { textDecorationLine: 'line-through', color: '#6b7280' },

  addSubtaskContainer: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 4,
  },
  addSubtaskInput: {
    flex: 1,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: '#e5e7eb',
    borderRightColor: '#e5e7eb',
    borderBottomColor: '#e5e7eb',
    borderRadius: 0,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#f3f4f6',
  },
  addButton: {
    backgroundColor: '#9333ea',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },

  suggestionsPopup: {
    marginTop: 0,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9e5ff',
  },
  suggestionsPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  suggestionsHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  suggestionsRefreshButton: { padding: 4, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  suggestionsCloseButton: { padding: 4 },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionsLoadingText: { fontSize: 13, color: '#6b7280' },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingRight: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionChipMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  suggestionChipClose: { padding: 4 },
  suggestionChipText: { fontSize: 14, color: '#1f2937', fontWeight: '500', flex: 1 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyCard: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});