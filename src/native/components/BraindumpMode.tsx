import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task, GameState } from '../../../App.native';
import CuteAvatar from './CuteAvatar';

interface BraindumpModeProps {
  onTasksCreated: (tasks: Task[]) => void;
  gameState: GameState;
}

export default function BraindumpMode({ onTasksCreated, gameState }: BraindumpModeProps) {
  const [mode, setMode] = useState<'voice' | 'written'>('written');
  const [writtenText, setWrittenText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const parseAndCreateTasks = (text: string) => {
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
        const subtasks = [];
        
        if (segment.includes('clean')) {
          title = 'Clean room';
          subtasks.push(
            { id: taskId + '_1', text: 'Pick up clothes', completed: false },
            { id: taskId + '_2', text: 'Make bed', completed: false },
            { id: taskId + '_3', text: 'Vacuum floor', completed: false }
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
      setWrittenText('');
    }, 1500);
  };

  const getAvatarMood = () => {
    if (isProcessing) return 'excited';
    if (writtenText) return 'proud';
    return 'neutral';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCard}>
        <CuteAvatar mood={getAvatarMood()} size="md" />
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            {isProcessing ? "Let me organize that for you! 🎯" : 
             writtenText ? "Got it! Ready when you are! ✨" :
             "Write it all out - no filter needed! 📝"}
          </Text>
        </View>
      </View>

      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'written' && styles.modeButtonActive]}
          onPress={() => setMode('written')}
        >
          <Ionicons name="document-text-outline" size={20} color={mode === 'written' ? '#fff' : '#6b7280'} />
          <Text style={[styles.modeButtonText, mode === 'written' && styles.modeButtonTextActive]}>
            Written Mode
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.label}>Brain dump here</Text>
        <TextInput
          style={styles.textArea}
          value={writtenText}
          onChangeText={setWrittenText}
          placeholder="Type everything on your mind... no organization needed, just let it flow"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={8}
          editable={!isProcessing}
        />
        
        <TouchableOpacity
          style={[styles.createButton, (!writtenText.trim() || isProcessing) && styles.createButtonDisabled]}
          onPress={() => parseAndCreateTasks(writtenText)}
          disabled={!writtenText.trim() || isProcessing}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Tasks</Text>
        </TouchableOpacity>
      </View>
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
    gap: 16,
  },
  avatarCard: {
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#1f2937',
  },
  modeToggle: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#9333ea',
  },
  modeButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    minHeight: 150,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#1f2937',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9333ea',
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

