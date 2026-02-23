import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import type { Task, GameState, FinishedTask } from '../../../App.native';
import { format } from 'date-fns';

type TasksSubTab = 'current' | 'completed';

interface TaskListProps {
  tasks: Task[];
  finishedTasks: FinishedTask[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  gameState: GameState;
}

export default function TaskList({
  tasks,
  finishedTasks,
  onToggleSubtask,
  onAddSubtask,
  onCompleteTask,
  onUpdateTask,
  gameState
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<TasksSubTab>('current');

  // --- local ordering for drag ---
  const [orderedIds, setOrderedIds] = useState<string[]>(() => tasks.map(t => t.id));

  useEffect(() => {
    setOrderedIds(prev => {
      const incoming = tasks.map(t => t.id);
      const kept = prev.filter(id => incoming.includes(id));
      const added = incoming.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
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

  const handleCompletePress = (task: Task) => {
    Alert.alert(
      'Complete task?',
      `Move "${task.title}" to completed tasks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, complete it!', onPress: () => onCompleteTask(task.id) },
      ]
    );
  };

  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  const completedSubtasks = tasks.reduce((acc, task) =>
    acc + task.subtasks.filter(s => s.completed).length, 0);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Task>) => {
    const task = item;
    const isExpanded = expandedTasks.has(task.id);
    const doneCount = task.subtasks.filter(s => s.completed).length;
    const totalCount = task.subtasks.length;
    const isCompleted = totalCount > 0 && doneCount === totalCount;

    return (
      <View style={[styles.taskCard, isCompleted && styles.taskCardCompleted, isActive && styles.taskCardActive]}>
        <View style={styles.taskHeader}>
          {/* drag handle */}
          <TouchableOpacity onLongPress={drag} style={styles.dragHandle} activeOpacity={0.8}>
            <Ionicons name="reorder-two" size={22} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.expandHit} onPress={() => toggleExpanded(task.id)} activeOpacity={0.8}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.taskHeaderContent} onPress={() => toggleExpanded(task.id)} activeOpacity={0.85}>
            <Text style={styles.taskTitle}>
              {isCompleted ? '✓ ' : ''}
              {task.title}
            </Text>
            <Text style={styles.taskMeta}>
              {doneCount}/{totalCount} complete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleCompletePress(task)} style={styles.completeHit} activeOpacity={0.85}>
            <Ionicons name="checkmark-done-circle-outline" size={22} color="#10b981" />
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.subtasksContainer}>
            {task.subtasks.map((subtask) => (
              <TouchableOpacity
                key={subtask.id}
                style={[styles.subtask, subtask.completed && styles.subtaskCompleted]}
                onPress={() => onToggleSubtask(task.id, subtask.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, subtask.completed && styles.checkboxChecked]}>
                  {subtask.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[styles.subtaskText, subtask.completed && styles.subtaskTextCompleted]}>
                  {subtask.text}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.addSubtaskContainer}>
              <TextInput
                style={styles.addSubtaskInput}
                value={newSubtaskText[task.id] || ''}
                onChangeText={(text) => setNewSubtaskText(prev => ({ ...prev, [task.id]: text }))}
                placeholder="Add task..."
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
  }, [expandedTasks, newSubtaskText, onAddSubtask, onCompleteTask, onToggleSubtask]);

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
      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsLabel}>Overview</Text>
          <Text style={styles.statsValue}>{completedSubtasks}/{totalSubtasks}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={14} color="#f97316" />
            <Text style={styles.statText}>{gameState.streak} day streak</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flash" size={14} color="#eab308" />
            <Text style={styles.statText}>{gameState.points} XP</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="list" size={14} color="#9333ea" />
            <Text style={styles.statText}>{tasks.length} tasks</Text>
          </View>
        </View>
      </View>

      {/* Subtab: Current | Completed */}
      <View style={styles.subtabBar}>
        <TouchableOpacity
          style={[styles.subtab, activeSubTab === 'current' && styles.subtabActive]}
          onPress={() => setActiveSubTab('current')}
          activeOpacity={0.8}
        >
          <Ionicons name="list" size={18} color={activeSubTab === 'current' ? '#fff' : '#6b7280'} />
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
          onDragEnd={({ data }) => setOrderedIds(data.map(t => t.id))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

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

  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 8 },

  dragHandle: { paddingTop: 1, paddingRight: 4 },
  expandHit: { paddingTop: 2, paddingHorizontal: 4 },
  completeHit: { paddingTop: 2, paddingLeft: 6 },

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
  taskMeta: { fontSize: 12, color: '#6b7280' },

  subtasksContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  subtask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subtaskCompleted: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },

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

  addSubtaskContainer: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addSubtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#9333ea',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyCard: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});