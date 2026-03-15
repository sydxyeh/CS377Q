import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Keyboard,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import type {
  Task,
  GameState,
  FinishedTask,
  Subtask,
} from "../../../App.native";
import {
  format,
  addDays,
  parseISO,
  startOfDay,
  isBefore,
  isToday,
  parse,
  isValid,
  differenceInDays,
} from "date-fns";
import {
  generateSubtasks,
  isSplitTaskAvailable,
  transcriptToSubtaskEdits,
} from "../services/splitTask";
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
} from "../services/audioRecording";
import {
  transcribeAudio,
  isTranscriptionAvailable,
} from "../services/transcription";
import { getRecommendedTask } from "../services/prioritize";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CuteAvatar from "./CuteAvatar";

type TasksSubTab = "current" | "completed";

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
  gameState,
}: TaskListProps) {
  const insets = useSafeAreaInsets();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>(
    {},
  );
  const [subtaskInputMode, setSubtaskInputMode] = useState<"voice" | "text">(
    "voice",
  );
  const [subtaskTextInput, setSubtaskTextInput] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<TasksSubTab>("current");
  const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<{
    taskId: string;
    subtaskId: string;
  } | null>(null);
  const [draftSubtaskText, setDraftSubtaskText] = useState("");
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const completingOpacityRef = useRef(new Animated.Value(1)).current;
  const completingSlideRef = useRef(new Animated.Value(0)).current;
  const completedTabPulseRef = useRef(new Animated.Value(1)).current;
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(
    null,
  );
  const [draftTaskTitle, setDraftTaskTitle] = useState("");

  const [voiceTask, setVoiceTask] = useState<Task | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pendingVoiceEdits, setPendingVoiceEdits] = useState<{
    task: Task;
    before: string[];
    after: string[];
  } | null>(null);
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState("");
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceReRecordingRef = useRef(false);
  const voiceTranscriptionQueueRef = useRef<string[]>([]);
  const voiceRecordingIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const voiceChunkTranscribingRef = useRef(false);
  const voiceLiveTranscriptRef = useRef("");
  const refillInProgressRef = useRef(false);

  const [addSubtaskFocusedTaskId, setAddSubtaskFocusedTaskId] = useState<
    string | null
  >(null);
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<
    Record<string, string[]>
  >({});
  const [subtaskSuggestionsLoading, setSubtaskSuggestionsLoading] = useState<
    string | null
  >(null);
  const [
    subtaskSuggestionsRefreshingTaskId,
    setSubtaskSuggestionsRefreshingTaskId,
  ] = useState<string | null>(null);
  const [showChooseTaskForSubtaskHelper, setShowChooseTaskForSubtaskHelper] =
    useState(false);
  const [dueDateModalTask, setDueDateModalTask] = useState<Task | null>(null);
  const [dueDateInput, setDueDateInput] = useState("");

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    tasks.map((t) => t.id),
  );
  const [activeSort, setActiveSort] = useState<
    "priority" | "recentlyAdded" | null
  >(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null,
  );
  const prevTaskCountRef = useRef(tasks.length);

  useEffect(() => {
    if (dueDateModalTask) {
      if (
        dueDateModalTask.dueDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(dueDateModalTask.dueDate)
      ) {
        const d = parseISO(dueDateModalTask.dueDate);
        setDueDateInput(format(d, "MMM d, yyyy"));
      } else {
        setDueDateInput("");
      }
    }
  }, [dueDateModalTask]);

  const parseDateInput = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const ref = new Date();
    const formats = [
      "yyyy-MM-dd",
      "M/d/yyyy",
      "MM/dd/yyyy",
      "M-d-yyyy",
      "MM-d-yyyy",
      "M/d/yy",
      "MMM d, yyyy",
      "MMMM d, yyyy",
      "MMM d yyyy",
    ];
    for (const fmt of formats) {
      try {
        const d = parse(trimmed, fmt, ref);
        if (isValid(d)) return format(d, "yyyy-MM-dd");
      } catch {
        // try next format
      }
    }
    return null;
  };

  useEffect(() => {
    setOrderedIds(tasks.map((t) => t.id));
  }, [tasks]);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () =>
      setAddSubtaskFocusedTaskId(null),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!completingTaskId) return;
    const screenWidth = Dimensions.get("window").width;
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
    if (completingTaskId && !tasks.some((t) => t.id === completingTaskId)) {
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
      setExpandedTasks(new Set(tasks.map((t) => t.id)));
    }
    prevTaskCountRef.current = tasks.length;
  }, [tasks]);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => {
      if (t && String(t.id)) {
        const safe: Task = {
          id: String(t.id),
          title: String(t.title ?? ""),
          subtasks: Array.isArray(t.subtasks)
            ? t.subtasks.map((s) => ({
                id: String(s.id),
                text: String(s.text ?? ""),
                completed: Boolean(s.completed),
              }))
            : [],
          createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(),
          dueDate:
            typeof t.dueDate === "string" && t.dueDate ? t.dueDate : undefined,
          priority: t.priority,
        };
        map.set(safe.id, safe);
      }
    });
    return map;
  }, [tasks]);

  const orderedTasks = useMemo(() => {
    return orderedIds
      .map((id) => tasksById.get(id))
      .filter((t): t is Task => t != null);
  }, [orderedIds, tasksById]);

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
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
    setNewSubtaskText((prev) => ({ ...prev, [taskId]: "" }));
    setSubtaskSuggestions((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter((s) => s !== text),
    }));
  };

  const fetchSubtaskSuggestions = useCallback(
    async (task: Task) => {
      if (!isSplitTaskAvailable() || subtaskSuggestionsLoading) return;
      const existingTexts = new Set(
        task.subtasks.map((s) => s.text.trim().toLowerCase()),
      );
      if ((subtaskSuggestions[task.id] || []).length > 0) return;
      setSubtaskSuggestionsLoading(task.id);
      try {
        const labels = await generateSubtasks(task.title);
        const filtered = labels
          .filter((t) => t.trim() && !existingTexts.has(t.trim().toLowerCase()))
          .slice(0, 5);
        setSubtaskSuggestions((prev) => ({ ...prev, [task.id]: filtered }));
      } catch (_) {
        setSubtaskSuggestions((prev) => ({ ...prev, [task.id]: [] }));
      } finally {
        setSubtaskSuggestionsLoading(null);
      }
    },
    [subtaskSuggestionsLoading, subtaskSuggestions],
  );

  const addSuggestionSubtask = useCallback(
    (taskId: string, text: string) => {
      onAddSubtask(taskId, text);
      setSubtaskSuggestions((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((s) => s !== text),
      }));
    },
    [onAddSubtask],
  );

  const removeSuggestion = useCallback((taskId: string, text: string) => {
    setSubtaskSuggestions((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter((s) => s !== text),
    }));
  }, []);

  const refillSubtaskSuggestions = useCallback(
    async (task: Task) => {
      if (!isSplitTaskAvailable() || refillInProgressRef.current) return;
      const pool = subtaskSuggestions[task.id] || [];
      if (pool.length >= 3) return;
      refillInProgressRef.current = true;
      try {
        const labels = await generateSubtasks(task.title);
        const existingSet = new Set([
          ...task.subtasks.map((s) => s.text.trim().toLowerCase()),
          ...pool.map((s) => s.trim().toLowerCase()),
        ]);
        const newOnes = labels
          .filter((t) => t.trim() && !existingSet.has(t.trim().toLowerCase()))
          .slice(0, 3 - pool.length);
        if (newOnes.length > 0) {
          setSubtaskSuggestions((prev) => ({
            ...prev,
            [task.id]: [...(prev[task.id] || []), ...newOnes],
          }));
        }
      } catch (_) {
        // keep current pool on error
      } finally {
        refillInProgressRef.current = false;
      }
    },
    [subtaskSuggestions],
  );

  const refreshSubtaskSuggestions = useCallback(
    async (task: Task) => {
      if (
        !isSplitTaskAvailable() ||
        subtaskSuggestionsRefreshingTaskId ||
        subtaskSuggestionsLoading === task.id
      )
        return;
      const existingSet = new Set(
        task.subtasks.map((s) => s.text.trim().toLowerCase()),
      );
      const currentPool = (subtaskSuggestions[task.id] || []).filter(
        (s) => !existingSet.has(s.trim().toLowerCase()),
      );
      const lastShown = currentPool.slice(0, 3);
      setSubtaskSuggestionsRefreshingTaskId(task.id);
      try {
        const labels = await generateSubtasks(task.title, lastShown);
        const existingTexts = new Set(
          task.subtasks.map((s) => s.text.trim().toLowerCase()),
        );
        const excludeSet = new Set(
          lastShown.map((s) => s.trim().toLowerCase()),
        );
        const filtered = labels
          .filter(
            (t) =>
              t.trim() &&
              !existingTexts.has(t.trim().toLowerCase()) &&
              !excludeSet.has(t.trim().toLowerCase()),
          )
          .slice(0, 5);
        setSubtaskSuggestions((prev) => ({ ...prev, [task.id]: filtered }));
      } catch (_) {
        // keep current on error
      } finally {
        setSubtaskSuggestionsRefreshingTaskId(null);
      }
    },
    [
      subtaskSuggestionsRefreshingTaskId,
      subtaskSuggestionsLoading,
      subtaskSuggestions,
    ],
  );

  useEffect(() => {
    if (!addSubtaskFocusedTaskId || refillInProgressRef.current) return;
    const task = tasks.find((t) => t.id === addSubtaskFocusedTaskId);
    if (!task) return;
    const pool = (subtaskSuggestions[task.id] || []).filter(
      (s) =>
        !task.subtasks.some(
          (st) => st.text.trim().toLowerCase() === s.trim().toLowerCase(),
        ),
    );
    if (pool.length >= 3) return;
    refillSubtaskSuggestions(task);
  }, [
    addSubtaskFocusedTaskId,
    subtaskSuggestions,
    tasks,
    refillSubtaskSuggestions,
  ]);

  const handleCompletePress = (task: Task) => {
    setTaskToComplete(task);
  };

  const startEditSubtask = (
    taskId: string,
    subtaskId: string,
    currentText: string,
  ) => {
    setEditingSubtask({ taskId, subtaskId });
    setDraftSubtaskText(currentText);
  };

  const submitEditSubtask = (task: Task) => {
    if (!editingSubtask || editingSubtask.taskId !== task.id) return;
    const { subtaskId } = editingSubtask;
    const text = draftSubtaskText.trim();
    if (text) {
      const newSubtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, text } : s,
      );
      onUpdateTask(task.id, { subtasks: newSubtasks });
    }
    setEditingSubtask(null);
    setDraftSubtaskText("");
  };

  const handleSplitTask = async (task: Task) => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        "API key required",
        "Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use Split task.",
        [{ text: "OK" }],
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
        "Split task failed",
        err instanceof Error
          ? err.message
          : "Could not generate subtasks. Try again.",
        [{ text: "OK" }],
      );
    } finally {
      setSplittingTaskId(null);
    }
  };

  const openSubtaskHelper = (task: Task) => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        "API key required",
        "Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use the voice subtask helper.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!isTranscriptionAvailable()) {
      Alert.alert(
        "Voice not available",
        "Add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file to use voice.",
        [{ text: "OK" }],
      );
      return;
    }
    setVoiceTask(task);
    setVoiceError(null);
  };

  const openSubtaskHelperFloating = () => {
    if (!isSplitTaskAvailable()) {
      Alert.alert(
        "API key required",
        "Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to use the subtasks helper.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!isTranscriptionAvailable()) {
      Alert.alert(
        "Voice not available",
        "Add EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY to your .env file to use voice.",
        [{ text: "OK" }],
      );
      return;
    }
    setShowChooseTaskForSubtaskHelper(true);
  };

  const processVoiceTranscriptionQueue = useCallback(async () => {
    if (
      voiceChunkTranscribingRef.current ||
      voiceTranscriptionQueueRef.current.length === 0
    )
      return;
    voiceChunkTranscribingRef.current = true;
    while (voiceTranscriptionQueueRef.current.length > 0) {
      const uri = voiceTranscriptionQueueRef.current.shift();
      if (!uri) continue;
      try {
        const text = await transcribeAudio(uri);
        if (text.trim()) {
          const next = voiceLiveTranscriptRef.current
            ? `${voiceLiveTranscriptRef.current} ${text}`.trim()
            : text.trim();
          voiceLiveTranscriptRef.current = next;
          setVoiceLiveTranscript(next);
        }
      } catch (err) {
        console.error("Voice chunk transcription error:", err);
      }
    }
    voiceChunkTranscribingRef.current = false;
  }, []);

  const startVoiceRecording = async () => {
    const task = voiceTask;
    if (!task) return;
    setVoiceError(null);
    setVoiceLiveTranscript("");
    voiceLiveTranscriptRef.current = "";
    voiceTranscriptionQueueRef.current = [];
    try {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        setVoiceError("Microphone permission is required.");
        return;
      }
      const recording = await startRecording();
      voiceRecordingRef.current = recording;
      setVoiceRecording(true);
      voiceRecordingIntervalRef.current = setInterval(async () => {
        if (voiceRecordingRef.current && !voiceChunkTranscribingRef.current) {
          try {
            const uri = await stopRecording(voiceRecordingRef.current);
            voiceTranscriptionQueueRef.current.push(uri);
            const newRecording = await startRecording();
            voiceRecordingRef.current = newRecording;
            if (!voiceChunkTranscribingRef.current) {
              processVoiceTranscriptionQueue();
            }
          } catch (err) {
            console.error("Error in voice recording interval:", err);
          }
        }
      }, 4000);
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "Failed to start recording.",
      );
    }
  };

  const getPriorityTabStyle = (
    priority: Task["priority"],
    isExpanded: boolean,
  ): { backgroundColor?: string; borderLeftColor?: string } => {
    if (!priority) return {};
    switch (priority) {
      case "high":
        return { backgroundColor: "#ede9fe", borderLeftColor: "#c4b5fd" };
      case "medium":
        return { backgroundColor: "#dbeafe", borderLeftColor: "#93c5fd" };
      case "low":
        return { backgroundColor: "#f3f4f6", borderLeftColor: "#d1d5db" };
      default:
        return {};
    }
  };

  const getPriorityChipInactiveStyle = (
    priority: Task["priority"],
  ): {
    backgroundColor: string;
    borderColor: string;
    color: string;
  } => {
    switch (priority) {
      case "high":
        return {
          backgroundColor: "#ede9fe",
          borderColor: "#ddd6fe",
          color: "#c4b5fd",
        };
      case "medium":
        return {
          backgroundColor: "#dbeafe",
          borderColor: "#bfdbfe",
          color: "#60a5fa",
        };
      case "low":
        return {
          backgroundColor: "#f3f4f6",
          borderColor: "#e5e7eb",
          color: "#6b7280",
        };
      default:
        return {
          backgroundColor: "#f3f4f6",
          borderColor: "#e5e7eb",
          color: "#6b7280",
        };
    }
  };

  const getPriorityChipActiveStyle = (
    p: "high" | "medium" | "low",
  ): { backgroundColor: string; borderWidth: number; borderColor: string } => {
    switch (p) {
      case "high": {
        const bg = "#8b5cf6";
        return {
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: bg,
        };
      }
      case "medium": {
        const bg = "#3b82f6";
        return {
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: bg,
        };
      }
      case "low": {
        const bg = "#9ca3af";
        return {
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: bg,
        };
      }
    }
  };

  const getPriorityChipTextColor = (p: "high" | "medium" | "low"): string => {
    return "#fff";
  };

  const getDueDateLabel = (dueDateStr: string | undefined): string | null => {
    if (!dueDateStr) return null;
    try {
      const d = startOfDay(parseISO(dueDateStr));
      const today = startOfDay(new Date());
      if (isBefore(d, today)) return "Overdue";
      return format(d, "MMM d");
    } catch {
      return null;
    }
  };

  const isOverdue = (dueDateStr: string | undefined): boolean => {
    if (!dueDateStr) return false;
    try {
      return isBefore(startOfDay(parseISO(dueDateStr)), startOfDay(new Date()));
    } catch {
      return false;
    }
  };

  /** Priority for display only: derived from due date (soonest due = high, then medium, then low). */
  const getDerivedPriority = (
    dueDateStr: string | undefined,
  ): "high" | "medium" | "low" => {
    if (!dueDateStr) return "low";
    try {
      const d = startOfDay(parseISO(dueDateStr));
      const today = startOfDay(new Date());
      const daysUntil = differenceInDays(d, today);
      if (daysUntil <= 0) return "high"; // overdue or today = soonest
      if (daysUntil <= 7) return "medium"; // within a week
      return "low";
    } catch {
      return "low";
    }
  };

  const setTaskDueDate = (taskId: string, dueDate: string | undefined) => {
    onUpdateTask(taskId, { dueDate });
    setDueDateModalTask(null);
  };

  const stopVoiceRecording = async () => {
    if (!voiceRecordingRef.current) {
      setVoiceRecording(false);
      return;
    }
    const task = voiceTask;
    setVoiceRecording(false);
    if (voiceRecordingIntervalRef.current) {
      clearInterval(voiceRecordingIntervalRef.current);
      voiceRecordingIntervalRef.current = null;
    }
    try {
      const finalUri = await stopRecording(voiceRecordingRef.current);
      voiceRecordingRef.current = null;
      if (!task) return;
      setVoiceError(null);
      await processVoiceTranscriptionQueue();
      if (finalUri) {
        setVoiceTranscribing(true);
        try {
          const finalText = await transcribeAudio(finalUri);
          if (finalText.trim()) {
            const next = voiceLiveTranscriptRef.current
              ? `${voiceLiveTranscriptRef.current} ${finalText}`.trim()
              : finalText.trim();
            voiceLiveTranscriptRef.current = next;
            setVoiceLiveTranscript(next);
          }
        } finally {
          setVoiceTranscribing(false);
        }
      }
      const combinedTranscript = voiceLiveTranscriptRef.current.trim();
      if (!combinedTranscript.trim()) {
        setVoiceError("No speech detected. Try again.");
        return;
      }
      setVoiceTranscribing(true);
      const currentTexts = task.subtasks.map((s) => s.text);
      const newTexts = await transcriptToSubtaskEdits(
        task.title,
        currentTexts,
        combinedTranscript,
      );
      setVoiceTranscribing(false);
      setVoiceProcessing(false);
      voiceReRecordingRef.current = true;
      setPendingVoiceEdits({ task, before: currentTexts, after: newTexts });
    } catch (err) {
      setVoiceTranscribing(false);
      setVoiceProcessing(false);
      setVoiceError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  useEffect(() => {
    return () => {
      if (voiceRecordingRef.current) {
        voiceRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (voiceTask === null) {
      if (voiceRecordingIntervalRef.current) {
        clearInterval(voiceRecordingIntervalRef.current);
        voiceRecordingIntervalRef.current = null;
      }
      voiceTranscriptionQueueRef.current = [];
      voiceChunkTranscribingRef.current = false;
      voiceLiveTranscriptRef.current = "";
      setVoiceLiveTranscript("");
    }
  }, [voiceTask]);

  const totalSubtasks = tasks.reduce(
    (acc, task) => acc + task.subtasks.length,
    0,
  );
  const completedSubtasks = tasks.reduce(
    (acc, task) => acc + task.subtasks.filter((s) => s.completed).length,
    0,
  );

  const submitTaskTitleEdit = useCallback(
    (taskId: string) => {
      if (editingTaskTitleId !== taskId) return;
      const title = draftTaskTitle.trim();
      if (title) onUpdateTask(taskId, { title });
      setEditingTaskTitleId(null);
      setDraftTaskTitle("");
    },
    [editingTaskTitleId, draftTaskTitle, onUpdateTask],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<Task>) => {
      const task = item;
      const taskNumber = orderedIds.findIndex((id) => id === task.id) + 1;
      const isExpanded = expandedTasks.has(task.id);
      const doneCount = task.subtasks.filter((s) => s.completed).length;
      const totalCount = task.subtasks.length;
      const isCompleted = totalCount > 0 && doneCount === totalCount;
      const isEditingTitle = editingTaskTitleId === task.id;
      const isCompleting = completingTaskId === task.id;

      const displayPriority = getDerivedPriority(task.dueDate);
      const priorityTabStyle = !isCompleting
        ? getPriorityTabStyle(displayPriority, isExpanded)
        : {};
      const cardContent = (
        <>
          <View
            style={[
              styles.taskHeader,
              isExpanded && priorityTabStyle.backgroundColor
                ? { backgroundColor: priorityTabStyle.backgroundColor }
                : {},
            ]}
          >
            <View style={styles.taskHeaderTopRow}>
              <TouchableOpacity
                onLongPress={drag}
                style={styles.taskDragHandle}
                activeOpacity={0.8}
              >
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
                <View style={styles.taskTitleBlock}>
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
                    <Text
                      style={[
                        styles.taskTitle,
                        isCompleting && styles.taskTitleCompleting,
                      ]}
                      numberOfLines={2}
                    >
                      {taskNumber}. {task.title}
                    </Text>
                  )}
                  {totalCount > 0 && !isCompleting && (
                    <Text style={styles.taskMeta} numberOfLines={1}>
                      {doneCount}/{totalCount} done
                    </Text>
                  )}
                  {isCompleting && (
                    <Text style={styles.taskMovingLabel}>
                      Moving to completed ✓
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.taskHeaderActions}>
                {!isCompleting && (
                  <TouchableOpacity
                    onPress={() => handleCompletePress(task)}
                    style={styles.markDonePill}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.markDonePillText}>Mark done</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.expandHit}
                  onPress={() => !isCompleting && toggleExpanded(task.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!isCompleting && (
              <TouchableOpacity
                style={styles.taskMetaRowWrapper}
                onPress={() => toggleExpanded(task.id)}
                activeOpacity={0.85}
              >
                <View style={styles.taskHeaderSpacer} />
                <View style={styles.taskMetaRow}>
                  <TouchableOpacity
                    onPress={() => setDueDateModalTask(task)}
                    activeOpacity={0.85}
                    style={styles.dueDateMetaItem}
                  >
                    {task.dueDate ? (
                      <View
                        style={[
                          styles.dueDatePill,
                          !isOverdue(task.dueDate) &&
                            getPriorityChipActiveStyle(displayPriority),
                          isOverdue(task.dueDate) && styles.dueDatePillOverdue,
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={
                            isOverdue(task.dueDate)
                              ? "#dc2626"
                              : getPriorityChipTextColor(displayPriority)
                          }
                        />
                        <Text
                          style={[
                            styles.dueDatePillText,
                            !isOverdue(task.dueDate) && {
                              color: getPriorityChipTextColor(displayPriority),
                            },
                            isOverdue(task.dueDate) &&
                              styles.dueDatePillTextOverdue,
                          ]}
                        >
                          {getDueDateLabel(task.dueDate)}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.dueDatePill,
                          getPriorityChipInactiveStyle(displayPriority),
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={
                            getPriorityChipInactiveStyle(displayPriority).color
                          }
                        />
                        <Text
                          style={[
                            styles.dueDatePillText,
                            {
                              color:
                                getPriorityChipInactiveStyle(displayPriority)
                                  .color,
                            },
                          ]}
                        >
                          Set due date
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {isExpanded && !isCompleting && (
            <View style={styles.subtasksContainer}>
              <DraggableFlatList<Subtask>
                data={task.subtasks}
                keyExtractor={(s) => s.id}
                onDragEnd={({ data }) =>
                  onUpdateTask(task.id, { subtasks: data })
                }
                scrollEnabled={false}
                activationDistance={10}
                renderItem={({ item: subtask, drag, isActive }) => {
                  const isEditingSubtask =
                    editingSubtask?.taskId === task.id &&
                    editingSubtask?.subtaskId === subtask.id;
                  const subtaskIndex = task.subtasks.findIndex(
                    (s) => s.id === subtask.id,
                  );
                  const subtaskNumber = subtaskIndex + 1;
                  const isLastSubtask =
                    subtaskIndex === task.subtasks.length - 1;
                  return (
                    <View
                      style={[
                        styles.subtask,
                        !isEditingSubtask &&
                          subtask.completed &&
                          styles.subtaskCompleted,
                        isActive && styles.subtaskDragging,
                        isLastSubtask && styles.subtaskLast,
                      ]}
                    >
                      <TouchableOpacity
                        onLongPress={drag}
                        style={styles.subtaskDragHandle}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="reorder-two"
                          size={20}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                      {isEditingSubtask ? (
                        <>
                          <View style={styles.subtaskTitleRow}>
                            <Text style={styles.subtaskNumberPrefix}>
                              {subtaskNumber}.
                            </Text>
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
                                subtasks: task.subtasks.filter(
                                  (s) => s.id !== subtask.id,
                                ),
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
                              const doneCount = task.subtasks.filter(
                                (s) => s.completed,
                              ).length;
                              const wasLastIncomplete =
                                wasCompleting && doneCount === totalCount - 1;
                              onToggleSubtask(task.id, subtask.id);
                              if (wasLastIncomplete) setTaskToComplete(task);
                            }}
                            style={styles.subtaskCheckboxHit}
                            activeOpacity={0.85}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                subtask.completed && styles.checkboxChecked,
                              ]}
                            >
                              {subtask.completed && (
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color="#fff"
                                />
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.subtaskTextHit}
                            onPress={() =>
                              startEditSubtask(
                                task.id,
                                subtask.id,
                                subtask.text,
                              )
                            }
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.subtaskText,
                                subtask.completed &&
                                  styles.subtaskTextCompleted,
                              ]}
                            >
                              {subtaskNumber}. {subtask.text}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              onUpdateTask(task.id, {
                                subtasks: task.subtasks.filter(
                                  (s) => s.id !== subtask.id,
                                ),
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
                  value={newSubtaskText[task.id] || ""}
                  onChangeText={(text) =>
                    setNewSubtaskText((prev) => ({ ...prev, [task.id]: text }))
                  }
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
                  style={[
                    styles.addButton,
                    !newSubtaskText[task.id]?.trim() &&
                      styles.addButtonDisabled,
                  ]}
                  onPress={() => handleAddSubtask(task.id)}
                  activeOpacity={0.85}
                  disabled={!newSubtaskText[task.id]?.trim()}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {addSubtaskFocusedTaskId === task.id &&
                isSplitTaskAvailable() && (
                  <View style={styles.suggestionsPopup}>
                    <View style={styles.suggestionsPopupHeader}>
                      <Text style={styles.suggestionsTitle}>Suggestions</Text>
                      <View style={styles.suggestionsHeaderActions}>
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          onPress={() => refreshSubtaskSuggestions(task)}
                          disabled={
                            subtaskSuggestionsLoading === task.id ||
                            subtaskSuggestionsRefreshingTaskId === task.id
                          }
                          style={styles.suggestionsRefreshButton}
                          activeOpacity={0.85}
                        >
                          {subtaskSuggestionsRefreshingTaskId === task.id ? (
                            <ActivityIndicator size="small" color="#9333ea" />
                          ) : (
                            <Ionicons
                              name="refresh"
                              size={20}
                              color="#9333ea"
                            />
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
                        <Text style={styles.suggestionsLoadingText}>
                          Suggesting subtasks...
                        </Text>
                      </View>
                    ) : (
                      (() => {
                        const existingSet = new Set(
                          task.subtasks.map((s) => s.text.trim().toLowerCase()),
                        );
                        const fullList = (
                          subtaskSuggestions[task.id] || []
                        ).filter(
                          (s) => !existingSet.has(s.trim().toLowerCase()),
                        );
                        const list = fullList.slice(0, 3);
                        if (list.length === 0) return null;
                        return (
                          <>
                            {list.map((suggestion, idx) => (
                              <View key={idx} style={styles.suggestionChip}>
                                <TouchableOpacity
                                  style={styles.suggestionChipMain}
                                  onPress={() =>
                                    addSuggestionSubtask(task.id, suggestion)
                                  }
                                  activeOpacity={0.85}
                                >
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={18}
                                    color="#9333ea"
                                  />
                                  <Text style={styles.suggestionChipText}>
                                    {suggestion}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                  }}
                                  onPress={() =>
                                    removeSuggestion(task.id, suggestion)
                                  }
                                  style={styles.suggestionChipClose}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons
                                    name="close"
                                    size={18}
                                    color="#9ca3af"
                                  />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </>
                        );
                      })()
                    )}
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
        <View
          style={[
            styles.taskCard,
            isCompleted && styles.taskCardCompleted,
            isActive && styles.taskCardActive,
            highlightedTaskId === task.id && styles.taskCardHighlight,
            !isExpanded &&
            !isCompleted &&
            getPriorityTabStyle(displayPriority, false).backgroundColor
              ? {
                  backgroundColor: getPriorityTabStyle(displayPriority, false)
                    .backgroundColor,
                  borderLeftWidth: 4,
                  borderLeftColor: getPriorityTabStyle(displayPriority, false)
                    .borderLeftColor,
                }
              : {},
          ]}
        >
          {cardContent}
        </View>
      );
    },
    [
      expandedTasks,
      newSubtaskText,
      onAddSubtask,
      onCompleteTask,
      onToggleSubtask,
      onUpdateTask,
      splittingTaskId,
      editingSubtask,
      draftSubtaskText,
      editingTaskTitleId,
      draftTaskTitle,
      submitTaskTitleEdit,
      submitEditSubtask,
      startEditSubtask,
      tasks,
      orderedIds,
      tasksById,
      onReorderTasks,
      addSubtaskFocusedTaskId,
      subtaskSuggestions,
      subtaskSuggestionsLoading,
      subtaskSuggestionsRefreshingTaskId,
      fetchSubtaskSuggestions,
      addSuggestionSubtask,
      removeSuggestion,
      refreshSubtaskSuggestions,
      completingTaskId,
      onConfirmCompleteTask,
      highlightedTaskId,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Subtab: Current | Completed */}
      <View style={styles.subtabBar}>
        <TouchableOpacity
          style={[
            styles.subtab,
            activeSubTab === "current" && styles.subtabActive,
          ]}
          onPress={() => setActiveSubTab("current")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.subtabEmoji,
              activeSubTab === "current" && styles.subtabEmojiActive,
            ]}
          >
            📝
          </Text>
          <Text
            style={[
              styles.subtabText,
              activeSubTab === "current" && styles.subtabTextActive,
            ]}
          >
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.subtab,
            activeSubTab === "completed" && styles.subtabActive,
          ]}
          onPress={() => setActiveSubTab("completed")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.subtabEmoji,
              activeSubTab === "completed" && styles.subtabEmojiActive,
            ]}
          >
            🎉
          </Text>
          <Text
            style={[
              styles.subtabText,
              activeSubTab === "completed" && styles.subtabTextActive,
            ]}
          >
            Completed
          </Text>
          {finishedTasks.length > 0 && (
            <View
              style={[
                styles.subtabBadge,
                activeSubTab === "completed" && styles.subtabBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.subtabBadgeText,
                  activeSubTab === "completed" && styles.subtabBadgeTextActive,
                ]}
              >
                {finishedTasks.length}
              </Text>
            </View>
          )}
          {completedTabJustUpdated && (
            <Animated.View
              style={[
                styles.subtabUpdatedIcon,
                { transform: [{ scale: completedTabPulseRef }] },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={activeSubTab === "completed" ? "#fff" : "#10b981"}
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {activeSubTab === "current" ? (
        orderedTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <Ionicons name="list-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Empty list</Text>
              <Text style={styles.emptyText}>
                Add some tasks through a braindump.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {(() => {
              const recommended = getRecommendedTask(orderedTasks);
              return recommended ? (
                <TouchableOpacity
                  style={styles.startHereBanner}
                  onPress={() => {
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    const sorted = [...orderedTasks].sort((a, b) => {
                      const pa = getDerivedPriority(a.dueDate);
                      const pb = getDerivedPriority(b.dueDate);
                      if (priorityOrder[pa] !== priorityOrder[pb])
                        return priorityOrder[pa] - priorityOrder[pb];
                      if (!a.dueDate && !b.dueDate) return 0;
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return a.dueDate.localeCompare(b.dueDate);
                    });
                    setOrderedIds(sorted.map((t) => t.id));
                    onReorderTasks?.(sorted);
                    setActiveSort("priority");
                    setHighlightedTaskId(recommended.task.id);
                    if (!expandedTasks.has(recommended.task.id))
                      toggleExpanded(recommended.task.id);
                  }}
                  activeOpacity={0.9}
                >
                  <CuteAvatar mood="excited" size="sm" />
                  <View style={styles.startHereBannerBubble}>
                    <Text style={styles.startHereBannerTitle}>
                      Start here! {recommended.task.title}
                    </Text>
                    <Text style={styles.startHereBannerReason}>
                      {recommended.reason}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9333ea" />
                </TouchableOpacity>
              ) : null;
            })()}
            <View style={styles.sortRow}>
              <TouchableOpacity
                style={[
                  styles.sortFilterButton,
                  activeSort === "priority"
                    ? styles.sortFilterButtonSelected
                    : styles.sortFilterButtonUnselected,
                ]}
                onPress={() => {
                  setHighlightedTaskId(null);
                  const priorityOrder = { high: 0, medium: 1, low: 2 };
                  const sorted = [...orderedTasks].sort((a, b) => {
                    const pa = getDerivedPriority(a.dueDate);
                    const pb = getDerivedPriority(b.dueDate);
                    if (priorityOrder[pa] !== priorityOrder[pb])
                      return priorityOrder[pa] - priorityOrder[pb];
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate.localeCompare(b.dueDate);
                  });
                  setOrderedIds(sorted.map((t) => t.id));
                  onReorderTasks?.(sorted);
                  setActiveSort("priority");
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="flag" size={16} color="#9333ea" />
                <Text style={styles.sortFilterButtonText}>
                  Sort by priority
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortFilterButton,
                  activeSort === "recentlyAdded"
                    ? styles.sortFilterButtonSelected
                    : styles.sortFilterButtonUnselected,
                ]}
                onPress={() => {
                  setHighlightedTaskId(null);
                  const sorted = [...orderedTasks].sort((a, b) => {
                    const aT =
                      a.createdAt instanceof Date
                        ? a.createdAt.getTime()
                        : new Date(a.createdAt as unknown as string).getTime();
                    const bT =
                      b.createdAt instanceof Date
                        ? b.createdAt.getTime()
                        : new Date(b.createdAt as unknown as string).getTime();
                    return bT - aT;
                  });
                  setOrderedIds(sorted.map((t) => t.id));
                  onReorderTasks?.(sorted);
                  setActiveSort("recentlyAdded");
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="time"
                  size={16}
                  color={activeSort === "recentlyAdded" ? "#9333ea" : "#6b7280"}
                />
                <Text
                  style={
                    activeSort === "recentlyAdded"
                      ? styles.sortFilterButtonTextSelected
                      : styles.sortFilterButtonTextUnselected
                  }
                >
                  Sort by recently added
                </Text>
              </TouchableOpacity>
            </View>
            <DraggableFlatList
              data={orderedTasks}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onDragEnd={({ data }) => {
                setOrderedIds(data.map((t) => t.id));
                onReorderTasks?.(data);
                setActiveSort(null);
                setHighlightedTaskId(null);
              }}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 200 + insets.bottom },
              ]}
              activationDistance={12}
            />
          </>
        )
      ) : (
        <ScrollView
          style={styles.graveyardScroll}
          contentContainerStyle={[
            styles.graveyardScrollContent,
            finishedTasks.length === 0 && styles.graveyardScrollContentEmpty,
          ]}
        >
          {finishedTasks.length > 0 && (
            <View style={styles.completedBanner}>
              <CuteAvatar mood="excited" size="sm" />
              <View style={styles.completedBannerBubble}>
                <Text style={styles.completedBannerText}>
                  Wow! Great job completing{" "}
                  {finishedTasks.length === 1
                    ? "1 task"
                    : `${finishedTasks.length} tasks`}{" "}
                  :)
                </Text>
              </View>
            </View>
          )}
          {finishedTasks.length === 0 ? (
            <View style={styles.graveyardEmpty}>
              <Text style={styles.graveyardEmptyEmoji}>🎉</Text>
              <Text style={styles.graveyardEmptyTitle}>
                No completed tasks yet
              </Text>
              <Text style={styles.graveyardEmptyText}>
                Complete a task to see it here.
              </Text>
            </View>
          ) : (
            finishedTasks.map((ft) => (
              <View key={ft.id} style={styles.graveyardCard}>
                <Text style={styles.graveyardTaskTitle}>{ft.title}</Text>
                <Text style={styles.graveyardMeta}>
                  Completed {format(new Date(ft.completedAt), "MMM d, yyyy")}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeSubTab === "current" && tasks.length > 0 && (
        <TouchableOpacity
          style={styles.subtaskHelperFloating}
          onPress={openSubtaskHelperFloating}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={22} color="#fff" />

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
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.chooseTaskModalCard}
          >
            <TouchableOpacity
              style={styles.modalCloseX}
              onPress={() => setShowChooseTaskForSubtaskHelper(false)}
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.subtaskHelperModalTitle}>Choose a task</Text>
            <Text style={styles.subtaskHelperModalMessage}>
              Tap a task to edit its subtasks with voice.
            </Text>
            <ScrollView
              style={styles.chooseTaskModalList}
              contentContainerStyle={styles.chooseTaskModalListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
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
                  <Text style={styles.chooseTaskRowTitle} numberOfLines={2}>
                    {index + 1}. {t.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={voiceTask !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pendingVoiceEdits) {
            setPendingVoiceEdits(null);
            voiceReRecordingRef.current = false;
            setVoiceTask(null);
          } else if (
            !voiceRecording &&
            !voiceTranscribing &&
            !voiceProcessing
          ) {
            voiceReRecordingRef.current = false;
            setVoiceTask(null);
          }
        }}
      >
        <TouchableOpacity
          style={styles.completeModalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (pendingVoiceEdits) {
              setPendingVoiceEdits(null);
              voiceReRecordingRef.current = false;
              setVoiceTask(null);
            } else if (
              !voiceRecording &&
              !voiceTranscribing &&
              !voiceProcessing
            ) {
              voiceReRecordingRef.current = false;
              setVoiceTask(null);
            }
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={
              pendingVoiceEdits
                ? styles.voiceConfirmModalCard
                : styles.voiceModalCard
            }
          >
            <TouchableOpacity
              style={styles.modalCloseX}
              onPress={() => {
                setPendingVoiceEdits(null);
                voiceReRecordingRef.current = false;
                setVoiceTask(null);
              }}
              disabled={
                !pendingVoiceEdits &&
                (voiceRecording || voiceTranscribing || voiceProcessing)
              }
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>

            {pendingVoiceEdits ? (
              <>
                <Text style={styles.voiceConfirmModalTitle}>
                  Review subtask changes
                </Text>
                <Text
                  style={styles.voiceConfirmModalTaskName}
                  numberOfLines={1}
                >
                  {pendingVoiceEdits.task.title}
                </Text>
                <ScrollView
                  style={styles.voiceConfirmScroll}
                  contentContainerStyle={styles.voiceConfirmScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.voiceConfirmSection}>
                    <Text style={styles.voiceConfirmSectionLabel}>Before</Text>
                    <View style={styles.voiceConfirmList}>
                      {pendingVoiceEdits.before.length ? (
                        pendingVoiceEdits.before.map((t, i) => (
                          <Text
                            key={i}
                            style={styles.voiceConfirmListItem}
                            numberOfLines={2}
                          >
                            {i + 1}. {t}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.voiceConfirmListEmpty}>
                          No subtasks
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.voiceConfirmSection}>
                    <Text style={styles.voiceConfirmSectionLabel}>After</Text>
                    <View style={styles.voiceConfirmList}>
                      {pendingVoiceEdits.after.map((t, i) => (
                        <Text
                          key={i}
                          style={styles.voiceConfirmListItem}
                          numberOfLines={2}
                        >
                          {i + 1}. {t}
                        </Text>
                      ))}
                    </View>
                  </View>
                </ScrollView>
                <View style={styles.voiceConfirmActions}>
                  <TouchableOpacity
                    style={styles.voiceConfirmRerecordButton}
                    onPress={() => setPendingVoiceEdits(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.voiceConfirmRerecordText}>
                      Re-record
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.voiceConfirmApplyButton}
                    onPress={() => {
                      const { task, after } = pendingVoiceEdits;
                      const newSubtasks: Subtask[] = after.map((text, i) => ({
                        id: `${task.id}-sub-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
                        text,
                        completed: false,
                      }));
                      onUpdateTask(task.id, { subtasks: newSubtasks });
                      setPendingVoiceEdits(null);
                      voiceReRecordingRef.current = false;
                      setVoiceTask(null);
                      if (!expandedTasks.has(task.id)) toggleExpanded(task.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.voiceConfirmApplyText}>
                      Apply changes
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.voiceModalAvatarCard}>
                  <CuteAvatar
                    mood={
                      voiceProcessing
                        ? "excited"
                        : voiceTranscribing
                          ? "proud"
                          : voiceRecording
                            ? "happy"
                            : "neutral"
                    }
                    size="md"
                  />

                  <View style={styles.voiceModalMessageBox}>
                    <Text style={styles.voiceModalMessageText}>
                      {voiceProcessing
                        ? "Updating subtasks..."
                        : voiceTranscribing
                          ? "Transcribing..."
                          : voiceRecording
                            ? "I'm listening... tell me how to edit subtasks. 💜"
                            : voiceReRecordingRef.current
                              ? `Tap the mic to record your changes again for "${voiceTask?.title}".`
                              : `Tell me how to edit or add subtasks for "${voiceTask?.title}". Tap the mic when you're ready.`}
                    </Text>
                  </View>
                </View>

                <View style={styles.subtaskInputTabs}>
                  <TouchableOpacity
                    style={[
                      styles.subtaskInputTab,
                      subtaskInputMode === "voice" &&
                        styles.subtaskInputTabActive,
                    ]}
                    onPress={() => setSubtaskInputMode("voice")}
                  >
                    <Ionicons
                      name="mic"
                      size={18}
                      color={subtaskInputMode === "voice" ? "#fff" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.subtaskInputTabText,
                        subtaskInputMode === "voice" &&
                          styles.subtaskInputTabTextActive,
                      ]}
                    >
                      Voice
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.subtaskInputTab,
                      subtaskInputMode === "text" &&
                        styles.subtaskInputTabActive,
                    ]}
                    onPress={() => setSubtaskInputMode("text")}
                  >
                    <Ionicons
                      name="create"
                      size={18}
                      color={subtaskInputMode === "text" ? "#fff" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.subtaskInputTabText,
                        subtaskInputMode === "text" &&
                          styles.subtaskInputTabTextActive,
                      ]}
                    >
                      Text
                    </Text>
                  </TouchableOpacity>
                </View>

                {voiceError ? (
                  <View style={styles.voiceModalErrorWrap}>
                    <Ionicons name="alert-circle" size={18} color="#dc2626" />
                    <Text style={styles.voiceErrorText}>{voiceError}</Text>
                  </View>
                ) : null}
                {subtaskInputMode === "voice" && (
                  <View
                    style={[
                      styles.voiceModalVoiceCard,
                      voiceRecording && styles.voiceModalVoiceCardRecording,
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.voiceModalRecordButton,
                        voiceRecording && styles.voiceModalRecordButtonActive,
                      ]}
                      onPress={
                        voiceRecording
                          ? stopVoiceRecording
                          : startVoiceRecording
                      }
                      disabled={voiceTranscribing || voiceProcessing}
                      activeOpacity={0.9}
                    >
                      <Ionicons
                        name={voiceRecording ? "mic-off" : "mic"}
                        size={48}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <Text style={styles.voiceModalRecordLabel}>
                      {voiceRecording ? "Tap to stop" : "Tap to record"}
                    </Text>
                  </View>
                )}

                {subtaskInputMode === "text" && (
                  <View style={styles.subtaskTextCard}>
                    <TextInput
                      style={styles.subtaskTextInput}
                      placeholder={`Describe subtasks for "${voiceTask?.title}"`}
                      multiline
                      value={subtaskTextInput}
                      onChangeText={setSubtaskTextInput}
                    />

                    <TouchableOpacity
                      style={[
                        styles.subtaskGenerateButton,
                        !subtaskTextInput.trim() && { opacity: 0.5 },
                      ]}
                      disabled={!subtaskTextInput.trim()}
                      onPress={async () => {
                        if (!voiceTask || !subtaskTextInput.trim()) return;
                        const currentTexts = voiceTask.subtasks.map(
                          (s) => s.text,
                        );
                        try {
                          const newTexts = await transcriptToSubtaskEdits(
                            voiceTask.title,
                            currentTexts,
                            subtaskTextInput.trim(),
                          );
                          setPendingVoiceEdits({
                            task: voiceTask,
                            before: currentTexts,
                            after: newTexts,
                          });
                          setSubtaskTextInput("");
                        } catch (err) {
                          // eh
                        }
                      }}
                    >
                      <Ionicons name="sparkles" size={18} color="#fff" />
                      <Text style={styles.subtaskGenerateButtonText}>
                        Generate subtasks
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {voiceRecording && voiceLiveTranscript.trim() ? (
                  <View style={styles.voiceLiveTranscript}>
                    <Text style={styles.voiceLiveTranscriptText}>
                      {voiceLiveTranscript}
                    </Text>
                  </View>
                ) : null}
              </>
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
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.completeModalCard}
          >
            <TouchableOpacity
              style={styles.modalCloseX}
              onPress={() => setTaskToComplete(null)}
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <View style={styles.completeModalIconWrap}>
              <Text style={styles.completeModalEmoji}>🎉</Text>
            </View>
            <Text style={styles.completeModalTitle}>Complete task?</Text>
            <Text style={styles.completeModalMessage}>
              Move "{taskToComplete?.title}" to completed tasks?
            </Text>
            <View style={styles.completeModalActions}>
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
                <Text style={styles.completeModalButtonConfirmText}>
                  Yes, complete it!
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={dueDateModalTask !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDueDateModalTask(null)}
      >
        <TouchableOpacity
          style={styles.completeModalOverlay}
          activeOpacity={1}
          onPress={() => setDueDateModalTask(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.dueDateModalCard}
          >
            <TouchableOpacity
              style={styles.modalCloseX}
              onPress={() => setDueDateModalTask(null)}
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.dueDateModalTitle}>Due date</Text>
            <Text style={styles.dueDateModalTaskName} numberOfLines={1}>
              {dueDateModalTask?.title}
            </Text>

            <View style={styles.dueDateSection}>
              <Text style={styles.dueDateInputLabel}>Enter date</Text>
              <TextInput
                style={styles.dueDateInput}
                value={dueDateInput}
                onChangeText={setDueDateInput}
                placeholder="e.g. Mar 8, 2025 or 3/8/2025"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.dueDateSetDateButton}
                onPress={() => {
                  if (!dueDateModalTask) return;
                  const iso = parseDateInput(dueDateInput);
                  if (iso) {
                    setTaskDueDate(dueDateModalTask.id, iso);
                    setDueDateModalTask(null);
                  } else if (dueDateInput.trim()) {
                    Alert.alert(
                      "Invalid date",
                      "Try formats like Mar 8, 2025 or 3/8/2025",
                      [{ text: "OK" }],
                    );
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.dueDateSetDateButtonText}>Set date</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dueDateSection}>
              <Text style={styles.dueDateQuickLabel}>Quick pick</Text>
              <View style={styles.dueDateChipsRow}>
                <TouchableOpacity
                  style={styles.dueDateChip}
                  onPress={() =>
                    dueDateModalTask &&
                    setTaskDueDate(
                      dueDateModalTask.id,
                      format(new Date(), "yyyy-MM-dd"),
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.dueDateChipText} numberOfLines={1}>
                    Today
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dueDateChip}
                  onPress={() =>
                    dueDateModalTask &&
                    setTaskDueDate(
                      dueDateModalTask.id,
                      format(addDays(new Date(), 1), "yyyy-MM-dd"),
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.dueDateChipText} numberOfLines={1}>
                    Tomorrow
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dueDateChip}
                  onPress={() =>
                    dueDateModalTask &&
                    setTaskDueDate(
                      dueDateModalTask.id,
                      format(addDays(new Date(), 7), "yyyy-MM-dd"),
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.dueDateChipText} numberOfLines={1}>
                    Next week
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.dueDateModalFooter}>
              <TouchableOpacity
                style={styles.dueDateFooterButton}
                onPress={() =>
                  dueDateModalTask &&
                  setTaskDueDate(dueDateModalTask.id, undefined)
                }
                activeOpacity={0.85}
              >
                <Text style={styles.dueDateClearText}>Clear due date</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },

  completeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  completeModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    paddingTop: 48,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  subtaskHelperModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  subtaskHelperModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtaskHelperModalMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  subtaskHelperOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    marginBottom: 10,
  },
  subtaskHelperOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  subtaskHelperCancel: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignSelf: "stretch",
    alignItems: "center",
  },
  subtaskHelperCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  suggestModalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  suggestModalLoading: { alignItems: "center", paddingVertical: 32 },
  suggestModalLoadingText: { fontSize: 14, color: "#6b7280", marginTop: 12 },
  suggestModalList: { maxHeight: 240, marginVertical: 12 },
  suggestModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  suggestModalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestModalCheckboxChecked: {
    backgroundColor: "#9333ea",
    borderColor: "#9333ea",
  },
  suggestModalRowText: { fontSize: 15, color: "#1f2937", flex: 1 },
  suggestModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  voiceModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    paddingTop: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  voiceModalAvatarCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ede9fe",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  voiceModalMessageBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
  },
  voiceModalMessageText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 20,
  },
  voiceModalErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  voiceErrorText: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
  },
  voiceModalVoiceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  voiceModalVoiceCardRecording: {
    backgroundColor: "#f5f3ff",
    borderColor: "#e9d5ff",
  },
  voiceModalRecordButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#9333ea",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  voiceModalRecordButtonActive: {
    backgroundColor: "#dc2626",
  },
  voiceModalRecordLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  voiceLiveTranscript: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  voiceLiveTranscriptText: {
    fontSize: 14,
    color: "#374151",
    fontStyle: "italic",
  },
  voiceModalCancel: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
  },
  modalCloseX: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  voiceConfirmModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    paddingTop: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  voiceConfirmModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  voiceConfirmModalTaskName: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  voiceConfirmScroll: { maxHeight: 220 },
  voiceConfirmScrollContent: { paddingBottom: 8 },
  voiceConfirmSection: { marginBottom: 14 },
  voiceConfirmSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  voiceConfirmList: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
  },
  subtaskInputTabs: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },

  subtaskInputTab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },

  subtaskInputTabActive: {
    backgroundColor: "#9333ea",
  },

  subtaskInputTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },

  subtaskInputTabTextActive: {
    color: "#fff",
  },

  subtaskTextCard: {
    gap: 12,
    marginTop: 12,
  },

  subtaskTextInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    backgroundColor: "#f9fafb",
  },

  subtaskGenerateButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#9333ea",
  },

  subtaskGenerateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  voiceConfirmListItem: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 4,
  },
  voiceConfirmListEmpty: {
    fontSize: 13,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  voiceConfirmActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  voiceConfirmRerecordButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  voiceConfirmRerecordText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  voiceConfirmApplyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#9333ea",
    alignItems: "center",
  },
  voiceConfirmApplyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  completeModalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  completeModalEmoji: { fontSize: 44 },
  completeModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  completeModalMessage: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  completeModalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  completeModalButtonCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  completeModalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  completeModalButtonConfirm: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#10b981",
  },
  completeModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginHorizontal: 16,
    marginTop: 16,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  statsValue: { fontSize: 14, fontWeight: "600", color: "#1f2937" },

  statsRow: { flexDirection: "row", gap: 16, marginTop: 12, flexWrap: "wrap" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6b7280" },

  startHereBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#ede9fe",
  },
  startHereBannerBubble: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  startHereBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  startHereBannerReason: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  completedBannerBubble: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  completedBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },

  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sortFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  sortFilterButtonSelected: {
    backgroundColor: "#ede9fe",
    borderColor: "#e9d5ff",
  },
  sortFilterButtonUnselected: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  sortFilterButtonTextSelected: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9333ea",
  },
  sortFilterButtonTextUnselected: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },

  listContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 180,
    gap: 12,
  },

  subtabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 4,
  },
  subtab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  subtabActive: { backgroundColor: "#9333ea" },
  subtabText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  subtabTextActive: { color: "#fff" },
  subtabEmoji: { fontSize: 16 },
  subtabEmojiActive: { opacity: 1 },
  subtabBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subtabBadgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  subtabBadgeText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  subtabBadgeTextActive: { color: "#fff" },
  subtabUpdatedIcon: { marginLeft: 4 },

  graveyardScroll: { flex: 1 },
  graveyardScrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 180,
    gap: 12,
  },
  graveyardScrollContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  graveyardEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  graveyardEmptyEmoji: { fontSize: 48 },
  graveyardEmptyTitle: { fontSize: 17, fontWeight: "600", color: "#9ca3af" },
  graveyardEmptyText: { fontSize: 14, color: "#d1d5db" },

  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  taskCardHighlight: {
    shadowColor: "#9333ea",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
    borderColor: "#9333ea",
  },
  taskCardCompleted: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  taskCardActive: { opacity: 0.95 },
  taskCardCompleting: { borderColor: "#86efac", backgroundColor: "#ecfdf5" },

  taskHeader: {
    flexDirection: "column",
    paddingLeft: 10,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  taskHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taskHeaderSpacer: {
    width: 32,
    flexShrink: 0,
  },
  taskMetaRowWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  dragHandle: { paddingTop: 1, paddingRight: 4 },
  expandHit: { padding: 6, justifyContent: "center", alignItems: "center" },
  taskDragHandle: { padding: 6, justifyContent: "center" },
  taskTitleBlock: {},
  taskTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  taskHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  taskNumberPrefix: { fontSize: 16, fontWeight: "600", color: "#6b7280" },
  taskCheckboxHit: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingRight: 4,
    paddingLeft: 8,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  taskCheckboxChecked: { backgroundColor: "#10b981", borderColor: "#10b981" },

  completeTaskButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#10b981",
  },
  completeTaskButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  splitTaskButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  splitTaskButtonText: { fontSize: 12, fontWeight: "600", color: "#9333ea" },

  taskActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  taskActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#ede9fe",
    borderWidth: 1.5,
    borderColor: "#e9d5ff",
    minWidth: 110,
  },
  taskActionButtonText: { fontSize: 14, fontWeight: "600", color: "#9333ea" },
  taskActionButtonPlaceholder: { minWidth: 110 },
  taskActionButtonDone: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#10b981",
    minWidth: 110,
  },
  taskActionButtonDoneText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  graveyardCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    paddingVertical: 14,
    paddingLeft: 10,
    paddingRight: 14,
  },
  graveyardTaskTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  graveyardMeta: { fontSize: 12, color: "#9ca3af", marginTop: 4 },

  taskHeaderContent: { flex: 1, minWidth: 0, gap: 6 },
  taskTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  taskTitleCompleting: { textDecorationLine: "line-through", color: "#6b7280" },
  taskMovingLabel: {
    fontSize: 13,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 4,
  },
  taskTitleInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    paddingVertical: 2,
    paddingHorizontal: 0,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#9333ea",
  },
  taskTitleTouchable: { alignSelf: "stretch" },
  taskMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  taskMetaRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    minWidth: 0,
  },
  dueDateMetaItem: { flexShrink: 0 },
  dueDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
  },
  dueDatePillOverdue: {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
  },
  dueDatePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  dueDatePillTextOverdue: { color: "#dc2626" },

  dueDateModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    paddingTop: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  dueDateModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
    textAlign: "center",
  },
  dueDateModalTaskName: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  dueDateSection: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dueDateInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  dueDateInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  dueDateSetDateButton: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#9333ea",
    alignItems: "center",
    justifyContent: "center",
  },
  dueDateSetDateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  dueDateQuickLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 10,
  },
  dueDateChipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  dueDateChip: {
    flexShrink: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e9d5ff",
    alignItems: "center",
    justifyContent: "center",
  },
  dueDateChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9333ea",
  },
  dueDateModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  dueDateFooterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dueDateClearText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  dueDateCancelText: { fontSize: 14, color: "#9333ea", fontWeight: "600" },

  priorityChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  markDonePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    borderWidth: 1.5,
    borderColor: "#e9d5ff",
  },
  markDonePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9333ea",
  },

  editTasksFloating: { position: "absolute", bottom: 24, right: 20 },
  editTasksButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#ede9fe",
    borderWidth: 1.5,
    borderColor: "#e9d5ff",
  },
  editTasksButtonActive: { backgroundColor: "#9333ea" },
  editTasksButtonText: { fontSize: 14, fontWeight: "600", color: "#9333ea" },
  editTasksButtonTextActive: { color: "#fff" },

  subtaskHelperFloating: {
    position: "absolute",
    bottom: 24,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#9333ea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subtaskHelperFloatingText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  chooseTaskModalCard: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    paddingTop: 48,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  chooseTaskModalList: { maxHeight: 320, width: "100%" },
  chooseTaskModalListContent: { paddingBottom: 8 },
  chooseTaskModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  chooseTaskRowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
  },

  subtasksContainer: {
    padding: 0,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  subtask: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 16,
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  subtaskCompleted: { opacity: 0.7 },
  subtaskLast: { borderBottomWidth: 0 },
  subtaskDragHandle: { padding: 4, justifyContent: "center", marginRight: 4 },
  subtaskDragging: { opacity: 0.9 },
  subtaskReorderWrap: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  subtaskReorderBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  subtaskCheckboxHit: {
    paddingTop: 2,
    paddingBottom: 4,
    paddingRight: 4,
    paddingLeft: 0,
  },
  subtaskTrashHit: { padding: 4, justifyContent: "center" },
  subtaskDeleteButton: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  subtaskTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    flex: 1,
  },
  subtaskNumberPrefix: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
  subtaskTextHit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subtaskEditInput: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 40,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9333ea",
    textAlignVertical: "top",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#10b981", borderColor: "#10b981" },
  subtaskText: { flex: 1, fontSize: 14, color: "#1f2937", fontWeight: "500" },
  subtaskTextCompleted: {
    textDecorationLine: "line-through",
    color: "#6b7280",
  },

  addSubtaskContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 4,
  },
  addSubtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#f3f4f6",
  },
  addButton: {
    backgroundColor: "#9333ea",
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: { opacity: 0.5 },

  suggestionsPopup: {
    marginTop: 0,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9e5ff",
  },
  suggestionsPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  suggestionsHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  suggestionsRefreshButton: {
    padding: 4,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsCloseButton: { padding: 4 },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  suggestionsLoadingText: { fontSize: 13, color: "#6b7280" },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingRight: 4,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  suggestionChipMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  suggestionChipClose: { padding: 4 },
  suggestionChipText: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyCard: { alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#1f2937" },
  emptyText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
});
