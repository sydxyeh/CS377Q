import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  gameState
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});

  const getCompletionPercentage = (task: Task) => {
    if (task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddSubtask = (taskId: string) => {
    const text = newSubtaskText[taskId]?.trim();
    if (text) {
      onAddSubtask(taskId, text);
      setNewSubtaskText(prev => ({ ...prev, [taskId]: '' }));
    }
  };

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <Ionicons name="list-outline" size={48} color="#9333ea" />
          <Text style={styles.emptyTitle}>No Active Quests</Text>
          <Text style={styles.emptyText}>Visit the Braindump to start your adventure!</Text>
        </View>
      </View>
    );
  }

  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  const completedSubtasks = tasks.reduce((acc, task) => 
    acc + task.subtasks.filter(s => s.completed).length, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Ionicons name="heart" size={16} color="#ec4899" />
          <Text style={styles.statsLabel}>Progress</Text>
          <Text style={styles.statsValue}>{completedSubtasks}/{totalSubtasks}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completedSubtasks / totalSubtasks) * 100}%` }]} />
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
        </View>
      </View>

      {tasks.map((task) => {
        const isExpanded = expandedTasks.has(task.id);
        const completion = getCompletionPercentage(task);
        const isCompleted = completion === 100;

        return (
          <View key={task.id} style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}>
            <TouchableOpacity
              style={styles.taskHeader}
              onPress={() => toggleExpanded(task.id)}
            >
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#6b7280"
              />
              <View style={styles.taskHeaderContent}>
                <Text style={styles.taskTitle}>
                  {isCompleted && '✓ '}
                  {task.title}
                </Text>
                <View style={styles.progressBarSmall}>
                  <View style={[styles.progressFillSmall, { width: `${completion}%` }]} />
                </View>
                <Text style={styles.taskMeta}>
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} complete
                </Text>
              </View>
              <TouchableOpacity onPress={() => onDeleteTask(task.id)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.subtasksContainer}>
                {task.subtasks.map((subtask) => (
                  <TouchableOpacity
                    key={subtask.id}
                    style={[styles.subtask, subtask.completed && styles.subtaskCompleted]}
                    onPress={() => onToggleSubtask(task.id, subtask.id)}
                  >
                    <View style={[styles.checkbox, subtask.completed && styles.checkboxChecked]}>
                      {subtask.completed && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
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
                    placeholder="Add objective..."
                    onSubmitEditing={() => handleAddSubtask(task.id)}
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddSubtask(task.id)}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  taskCardCompleted: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  taskHeaderContent: {
    flex: 1,
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressBarSmall: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    backgroundColor: '#9333ea',
  },
  taskMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
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
  subtaskCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
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
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  subtaskText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  subtaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  addSubtaskContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addSubtaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#9333ea',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

