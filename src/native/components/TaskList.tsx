import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import type { Task, GameState, FinishedTask, Subtask } from '../../../App.native';
import { format } from 'date-fns';
import { generateSubtasks, isSplitTaskAvailable } from '../services/splitTask';

type TasksSubTab = 'current' | 'completed';

interface TaskListProps {
  tasks: Task[];
  finishedTasks: FinishedTask[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onReorderTasks?: (reordered: Task[]) => void;
  gameState: GameState;
}

export default function TaskList({
  tasks,
  finishedTasks,
  onToggleSubtask,
  onAddSubtask,
  onCompleteTask,
  onUpdateTask,
  onReorderTasks,
  gameState
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<TasksSubTab>('current');
  const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<{ taskId: string; subtaskId: string } | null>(null);
  const [draftSubtaskText, setDraftSubtaskText] = useState('');
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(null);
  const [draftTaskTitle, setDraftTaskTitle] = useState('');

  const [orderedIds, setOrderedIds] = useState<string[]>(() => tasks.map(t => t.id));
  const prevTaskCountRef = useRef(tasks.length);

  useEffect(() => {
    setOrderedIds(tasks.map(t => t.id));
  }, [tasks]);

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
  };

  const moveSubtaskUp = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentIndex = task.subtasks.findIndex(s => s.id === subtaskId);
    if (currentIndex <= 0) return; // Already at top
    
    const newSubtasks = [...task.subtasks];
    [newSubtasks[currentIndex - 1], newSubtasks[currentIndex]] = [newSubtasks[currentIndex], newSubtasks[currentIndex - 1]];
    onUpdateTask(taskId, { subtasks: newSubtasks });
  };

  const moveSubtaskDown = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentIndex = task.subtasks.findIndex(s => s.id === subtaskId);
    if (currentIndex < 0 || currentIndex >= task.subtasks.length - 1) return; // Already at bottom
    
    const newSubtasks = [...task.subtasks];
    [newSubtasks[currentIndex], newSubtasks[currentIndex + 1]] = [newSubtasks[currentIndex + 1], newSubtasks[currentIndex]];
    onUpdateTask(taskId, { subtasks: newSubtasks });
  };

  const moveTaskUp = (taskId: string) => {
    const currentIndex = orderedIds.findIndex(id => id === taskId);
    if (currentIndex <= 0) return; // Already at top
    
    const newOrderedIds = [...orderedIds];
    [newOrderedIds[currentIndex - 1], newOrderedIds[currentIndex]] = 
      [newOrderedIds[currentIndex], newOrderedIds[currentIndex - 1]];
    setOrderedIds(newOrderedIds);
    
    const reorderedTasks = newOrderedIds
      .map(id => tasksById.get(id))
      .filter((t): t is Task => t != null);
    onReorderTasks?.(reorderedTasks);
  };

  const moveTaskDown = (taskId: string) => {
    const currentIndex = orderedIds.findIndex(id => id === taskId);
    if (currentIndex < 0 || currentIndex >= orderedIds.length - 1) return; // Already at bottom
    
    const newOrderedIds = [...orderedIds];
    [newOrderedIds[currentIndex], newOrderedIds[currentIndex + 1]] = 
      [newOrderedIds[currentIndex + 1], newOrderedIds[currentIndex]];
    setOrderedIds(newOrderedIds);
    
    const reorderedTasks = newOrderedIds
      .map(id => tasksById.get(id))
      .filter((t): t is Task => t != null);
    onReorderTasks?.(reorderedTasks);
  };

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
    const isExpanded = expandedTasks.has(task.id);
    const doneCount = task.subtasks.filter(s => s.completed).length;
    const totalCount = task.subtasks.length;
    const isCompleted = totalCount > 0 && doneCount === totalCount;
    const isEditingTitle = editingTaskTitleId === task.id;
    
    const currentIndex = orderedIds.findIndex(id => id === task.id);
    const canMoveUp = currentIndex > 0;
    const canMoveDown = currentIndex >= 0 && currentIndex < orderedIds.length - 1;

    return (
      <View style={[styles.taskCard, isCompleted && styles.taskCardCompleted, isActive && styles.taskCardActive]}>
        <View style={styles.taskHeader}>
          <View style={styles.taskReorderButtons}>
            <TouchableOpacity
              onPress={() => moveTaskUp(task.id)}
              disabled={!canMoveUp}
              style={[styles.taskArrowButton, !canMoveUp && styles.taskArrowButtonDisabled]}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-up" size={14} color={canMoveUp ? "#fff" : "#9ca3af"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveTaskDown(task.id)}
              disabled={!canMoveDown}
              style={[styles.taskArrowButton, !canMoveDown && styles.taskArrowButtonDisabled]}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-down" size={14} color={canMoveDown ? "#fff" : "#9ca3af"} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            onPress={() => handleCompletePress(task)}
            style={styles.taskCheckboxHit}
            activeOpacity={0.85}
          >
            <View style={[styles.taskCheckbox, isCompleted && styles.taskCheckboxChecked]}>
              {isCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.taskHeaderContent} 
            onPress={() => toggleExpanded(task.id)} 
            onLongPress={() => {
              setEditingTaskTitleId(task.id);
              setDraftTaskTitle(task.title);
            }}
            activeOpacity={0.85}
          >
            {isEditingTitle ? (
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
            ) : (
              <Text style={styles.taskTitle}>
                {task.title}
              </Text>
            )}
            {totalCount > 0 && (
              <Text style={styles.taskMeta}>
                {doneCount}/{totalCount} complete
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.expandHit} onPress={() => toggleExpanded(task.id)} activeOpacity={0.8}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.subtasksContainer}>
            <View style={styles.taskActionsRow}>
              <View style={styles.taskActionButtonPlaceholder} />
              {splittingTaskId === task.id ? (
                <View style={styles.taskActionButton}>
                  <ActivityIndicator size="small" color="#9333ea" />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleSplitTask(task)}
                  style={styles.taskActionButton}
                  activeOpacity={0.85}
                >
                  <Text style={styles.taskActionButtonText}>Split into subtasks</Text>
                </TouchableOpacity>
              )}
            </View>

            <DraggableFlatList<Subtask>
              data={task.subtasks}
              keyExtractor={(s) => s.id}
              onDragEnd={({ data }) => onUpdateTask(task.id, { subtasks: data })}
              scrollEnabled={false}
              activationDistance={10}
              renderItem={({ item: subtask, drag, isActive }) => {
                const isEditingSubtask =
                  editingSubtask?.taskId === task.id && editingSubtask?.subtaskId === subtask.id;
                const currentIndex = task.subtasks.findIndex(s => s.id === subtask.id);
                const canMoveUp = currentIndex > 0;
                const canMoveDown = currentIndex < task.subtasks.length - 1;
                const isLastSubtask = currentIndex === task.subtasks.length - 1;
                return (
                  <View
                    style={[
                      styles.subtask,
                      !isEditingSubtask && subtask.completed && styles.subtaskCompleted,
                      isActive && styles.subtaskDragging,
                      isLastSubtask && styles.subtaskLast,
                    ]}
                  >
                    <View style={styles.subtaskReorderButtons}>
                      <TouchableOpacity
                        onPress={() => moveSubtaskUp(task.id, subtask.id)}
                        disabled={!canMoveUp}
                        style={[styles.subtaskArrowButton, !canMoveUp && styles.subtaskArrowButtonDisabled]}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="chevron-up" size={14} color={canMoveUp ? "#9333ea" : "#9ca3af"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveSubtaskDown(task.id, subtask.id)}
                        disabled={!canMoveDown}
                        style={[styles.subtaskArrowButton, !canMoveDown && styles.subtaskArrowButtonDisabled]}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="chevron-down" size={14} color={canMoveDown ? "#9333ea" : "#9ca3af"} />
                      </TouchableOpacity>
                    </View>
                    {isEditingSubtask ? (
                      <>
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
                            {subtask.text}
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
          </View>
        )}
      </View>
    );
  }, [expandedTasks, newSubtaskText, onAddSubtask, onCompleteTask, onToggleSubtask, onUpdateTask, splittingTaskId, editingSubtask, draftSubtaskText, editingTaskTitleId, draftTaskTitle, submitTaskTitleEdit, submitEditSubtask, startEditSubtask, tasks, moveSubtaskUp, moveSubtaskDown, moveTaskUp, moveTaskDown, orderedIds, tasksById, onReorderTasks]);

  if (tasks.length === 0 && finishedTasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <Ionicons name="list-outline" size={48} color="#9333ea" />
          <Text style={styles.emptyTitle}>No Tasks</Text>
          <Text style={styles.emptyText}>Visit the Braindump to add your first tasks.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subtab: Current | Completed */}
      <View style={styles.subtabBar}>
        <TouchableOpacity
          style={[styles.subtab, activeSubTab === 'current' && styles.subtabActive]}
          onPress={() => setActiveSubTab('current')}
          activeOpacity={0.8}
        >
          <Text style={[styles.subtabEmoji, activeSubTab === 'current' && styles.subtabEmojiActive]}>✅</Text>
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
        </TouchableOpacity>
      </View>

      {activeSubTab === 'current' ? (
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
                    onCompleteTask(taskToComplete.id);
                    setTaskToComplete(null);
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

  graveyardScroll: { flex: 1 },
  graveyardScrollContent: { padding: 16, paddingBottom: 32 },
  graveyardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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

  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, paddingRight: 16, paddingVertical: 16, gap: 8 },

  dragHandle: { paddingTop: 1, paddingRight: 4 },
  expandHit: { paddingTop: 2, paddingHorizontal: 4 },
  taskReorderButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    marginRight: 4,
    marginLeft: 8,
    paddingTop: 2,
  },
  taskArrowButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 28,
    minHeight: 24,
    backgroundColor: '#9333ea',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9333ea',
  },
  taskArrowButtonDisabled: { 
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
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
  taskTitleInput: { fontSize: 16, fontWeight: '600', color: '#1f2937', paddingVertical: 2, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: '#9333ea' },
  taskTitleTouchable: { alignSelf: 'stretch' },
  taskMeta: { fontSize: 12, color: '#6b7280' },

  editTasksFloating: { position: 'absolute', bottom: 24, right: 20 },
  editTasksButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#ede9fe' },
  editTasksButtonActive: { backgroundColor: '#9333ea' },
  editTasksButtonText: { fontSize: 14, fontWeight: '600', color: '#9333ea' },
  editTasksButtonTextActive: { color: '#fff' },

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
  subtaskReorderButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    marginRight: 4,
    paddingTop: 2,
  },
  subtaskArrowButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 28,
    minHeight: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subtaskArrowButtonDisabled: { 
    opacity: 0.5,
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  subtaskCheckboxHit: { paddingTop: 2, paddingBottom: 4, paddingRight: 4, paddingLeft: 0 },
  subtaskTrashHit: { padding: 4, justifyContent: 'center' },
  subtaskDeleteButton: { padding: 4, justifyContent: 'center', alignItems: 'center' },
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

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyCard: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});