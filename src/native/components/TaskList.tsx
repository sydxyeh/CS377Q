import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import type { Task, GameState } from '../../../App.native';

interface TaskListProps {
  tasks: Task[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  gameState: GameState;
}

export default function TaskList({
  tasks,
  onToggleSubtask,
  onAddSubtask,
  onDeleteTask,
  onUpdateTask,
  gameState
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});

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
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  const orderedTasks = useMemo(() => {
    return orderedIds.map(id => tasksById.get(id)).filter(Boolean) as Task[];
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

          <TouchableOpacity onPress={() => onDeleteTask(task.id)} style={styles.deleteHit} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
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
  }, [expandedTasks, newSubtaskText, onAddSubtask, onDeleteTask, onToggleSubtask]);

  if (tasks.length === 0) {
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
      {/* Stats (no progress bar) */}
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

      <DraggableFlatList
        data={orderedTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          // update local order
          setOrderedIds(data.map(t => t.id));

          // optional: persist in parent if you want
          // onUpdateTask(...) not suitable for bulk reorder unless you add an `order` field
        }}
        contentContainerStyle={styles.listContent}
        activationDistance={12}
      />
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
  deleteHit: { paddingTop: 2, paddingLeft: 6 },

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