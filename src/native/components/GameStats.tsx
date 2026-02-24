import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GameState, Task, FinishedTask } from '../../../App.native';
import CuteAvatar from './CuteAvatar';

interface GameStatsProps {
  gameState: GameState;
  tasks: Task[];
  finishedTasks: FinishedTask[];
}

export default function GameStats({ gameState, tasks, finishedTasks }: GameStatsProps) {
  const done = finishedTasks.length;
  const nextMilestone = done < 10 ? 10 : (Math.floor(done / 10) + 1) * 10;
  const remaining = nextMilestone - done;

  const getBenchmarkEncouragement = () => {
    if (done > 0 && done % 10 === 0) return `You hit ${done}! Aim for ${done + 10} next! 🎉`;
    if (done === 0) return 'Complete 10 tasks to reach your first milestone! 🎯';
    if (remaining === 1) return `So close! Just 1 more task to hit ${nextMilestone}! 🌟`;
    return `${done} done! ${remaining} more to reach ${nextMilestone}! 💪`;
  };

  const getAvatarMood = () => {
    if (done >= 30) return 'cheering';
    if (done >= 20) return 'excited';
    if (done >= 10) return 'proud';
    if (done >= 2) return 'happy';
    return 'neutral';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.levelCard}>
        <CuteAvatar mood={getAvatarMood()} size="lg" />
        <Text style={styles.levelTitle}>{done} / {nextMilestone}</Text>
        <Text style={styles.levelSubtitle}>tasks toward next benchmark</Text>
        
        <View style={styles.benchmarkContainer}>
          <Text style={styles.benchmarkText}>{getBenchmarkEncouragement()}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fed7aa' }]}>
            <Ionicons name="flame" size={20} color="#f97316" />
          </View>
          <Text style={styles.statValue}>{gameState.streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#bbf7d0' }]}>
            <Ionicons name="target" size={20} color="#10b981" />
          </View>
          <Text style={styles.statValue}>{finishedTasks.length}</Text>
          <Text style={styles.statLabel}>Total Done</Text>
        </View>
      </View>

      <View style={styles.motivationalCard}>
        <Text style={styles.motivationalEmoji}>💜</Text>
        <Text style={styles.motivationalText}>
          {finishedTasks.length === 0 
            ? "You've got this! Every journey starts with a single step."
            : finishedTasks.length < 10
            ? "Amazing start! Keep the momentum going!"
            : finishedTasks.length < 50
            ? "You're on fire! Look at all that progress!"
            : "Wow! You're absolutely crushing it! 🌟"
          }
        </Text>
        <Text style={styles.motivationalSubtext}>
          Remember: Progress over perfection! 🚀
        </Text>
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
  levelCard: {
    backgroundColor: '#9333ea',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  levelTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  levelSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  benchmarkContainer: {
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  benchmarkText: {
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  motivationalCard: {
    backgroundColor: '#fce7f3',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  motivationalEmoji: {
    fontSize: 40,
  },
  motivationalText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  motivationalSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

