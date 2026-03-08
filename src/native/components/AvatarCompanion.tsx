import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import type { Task, GameState } from '../../../App.native';
import CuteAvatar from './CuteAvatar';
import { getRecommendedTask } from '../services/prioritize';
import { speakAvatarMessageIfSet, stopAvatarSpeech } from '../services/avatarSpeech';

type NavParamList = { Braindump: undefined; Tasks: undefined; Buddy: undefined };

interface Message {
  id: string;
  type: 'user' | 'avatar';
  text: string;
  timestamp: Date;
  recommendedTask?: Task;
}

interface AvatarCompanionProps {
  tasks: Task[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  gameState: GameState;
}

const encouragementMessages = [
  "You're doing amazing! 🌟",
  "Every step forward is progress! 💪",
  "I'm proud of you for showing up! ✨",
  "You're making it happen! 🎯",
];

export default function AvatarCompanion({ tasks, gameState, onUpdateTask }: AvatarCompanionProps) {
  const navigation = useNavigation<BottomTabNavigationProp<NavParamList, 'Buddy'>>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'avatar',
      text: "Hey there! 👋 I'm here to help you stay on track. Tell me what you're working on!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const lastSpokenMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === 'avatar' && lastMsg.id !== lastSpokenMessageIdRef.current) {
      lastSpokenMessageIdRef.current = lastMsg.id;
      speakAvatarMessageIfSet(lastMsg.text);
    }
  }, [messages]);

  useEffect(() => {
    return () => { stopAvatarSpeech(); };
  }, []);

  const isPrioritizationQuestion = (text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return (
      lower.includes('what should i do first') ||
      lower.includes('what\'s most important') ||
      lower.includes('prioritize') ||
      lower.includes('what task should i') ||
      lower.includes('which task first') ||
      lower.includes('what to do first') ||
      lower === 'what first'
    );
  };

  const parseSetDueDate = (msg: string): { task: Task; dueDate: string } | null => {
    const lower = msg.toLowerCase().trim();
    const today = new Date();
    let dueDateStr: string | null = null;
    if (lower.includes('tomorrow')) dueDateStr = format(addDays(today, 1), 'yyyy-MM-dd');
    else if (lower.includes('today')) dueDateStr = format(today, 'yyyy-MM-dd');
    else if (lower.includes('next week')) dueDateStr = format(addDays(today, 7), 'yyyy-MM-dd');
    if (!dueDateStr) return null;

    const setMatch = msg.match(/set\s+(.+?)\s+due\s+(tomorrow|today|next\s+week)/i);
    const simpleMatch = msg.match(/(.+?)\s+due\s+(tomorrow|today|next\s+week)/i);
    const taskTitlePart = (setMatch?.[1] ?? simpleMatch?.[1])?.trim();
    const taskToUpdate = taskTitlePart
      ? tasks.find((t) => t.title.toLowerCase().includes(taskTitlePart.toLowerCase()) || taskTitlePart.toLowerCase().includes(t.title.toLowerCase()))
      : tasks[0];
    if (taskToUpdate) return { task: taskToUpdate, dueDate: dueDateStr };
    return null;
  };

  const getResponse = (text: string): { text: string; recommendedTask?: Task } => {
    const lowerText = text.toLowerCase();

    if (isPrioritizationQuestion(text)) {
      const rec = getRecommendedTask(tasks);
      if (rec) {
        return {
          text: `Start with **${rec.task.title}** — ${rec.reason}. 💜`,
          recommendedTask: rec.task,
        };
      }
      return { text: 'You have no tasks right now. Add some from the Braindump tab and I\'ll help you prioritize! 🌟' };
    }

    if (lowerText.includes('due') && (lowerText.includes('tomorrow') || lowerText.includes('today') || lowerText.includes('next week'))) {
      const parsed = parseSetDueDate(text);
      if (parsed) {
        onUpdateTask(parsed.task.id, { dueDate: parsed.dueDate });
        return { text: `Done! I set "${parsed.task.title}" due ${parsed.dueDate}. 📅` };
      }
      if (tasks.length === 0) return { text: 'You have no tasks yet. Add some from the Braindump tab first! 🌟' };
      return { text: 'I couldn\'t match that to a task. Try "Set [task name] due tomorrow" or "due tomorrow for [task name]". 💜' };
    }

    if (lowerText.includes('done') || lowerText.includes('finished')) {
      return { text: `${encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)]} That's awesome progress!` };
    }

    if (lowerText.includes('overwhelmed') || lowerText.includes('stressed')) {
      return { text: `Take a breath - you don't have to do everything right now. Let's focus on just ONE thing. 🌸` };
    }

    return { text: `I'm listening! Tell me more - how can I support you right now? 💙` };
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const { text, recommendedTask } = getResponse(inputText);
      const avatarResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'avatar',
        text,
        timestamp: new Date(),
        recommendedTask,
      };

      setMessages((prev) => [...prev, avatarResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const completedToday = tasks.reduce((acc, task) => {
    return acc + task.subtasks.filter(s => s.completed).length;
  }, 0);

  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  
  const getAvatarMood = () => {
    if (totalSubtasks === 0) return 'neutral';
    const progress = completedToday / totalSubtasks;
    if (progress >= 0.8) return 'cheering';
    if (progress >= 0.5) return 'excited';
    if (progress >= 0.3) return 'proud';
    if (progress > 0) return 'happy';
    return 'neutral';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <CuteAvatar mood={getAvatarMood()} size="md" />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Your Buddy</Text>
          <Text style={styles.headerSubtitle}>Always here for you! 💜</Text>
        </View>
      </View>

      {totalSubtasks > 0 && (
        <View style={styles.progressCard}>
          <Ionicons name="trending-up" size={16} color="#fff" />
          <Text style={styles.progressLabel}>Today's Progress</Text>
          <Text style={styles.progressValue}>{completedToday} / {totalSubtasks}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.message,
              message.type === 'user' ? styles.userMessage : styles.avatarMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.type === 'user' && styles.userMessageText
            ]}>
              {message.text.replace(/\*\*(.*?)\*\*/g, '$1')}
            </Text>
            {message.type === 'avatar' && message.recommendedTask && (
              <TouchableOpacity
                style={styles.goToTaskButton}
                onPress={() => navigation.navigate('Tasks')}
                activeOpacity={0.85}
              >
                <Ionicons name="list" size={16} color="#9333ea" />
                <Text style={styles.goToTaskButtonText}>Go to task</Text>
              </TouchableOpacity>
            )}
            <Text style={[
              styles.messageTime,
              message.type === 'user' && styles.userMessageTime
            ]}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        {isTyping && (
          <View style={styles.typingIndicator}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Tell me what you're working on..."
          placeholderTextColor="#9ca3af"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#9333ea',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: '#9333ea',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressLabel: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  message: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#9333ea',
  },
  avatarMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  goToTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    borderWidth: 1.5,
    borderColor: '#e9d5ff',
    alignSelf: 'flex-start',
  },
  goToTaskButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9333ea',
  },
  messageTime: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9333ea',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

