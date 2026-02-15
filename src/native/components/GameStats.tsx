import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GameState, Task } from '../../../App.native';
import CuteAvatar from './CuteAvatar';

interface GameStatsProps {
  gameState: GameState;
  tasks: Task[];
}

const achievements = [
  { id: 'first-step', name: 'First Step', description: 'Complete your first task', emoji: '🎯' },
  { id: 'getting-started', name: 'Getting Started', description: 'Complete 10 tasks', emoji: '⭐' },
  { id: 'on-a-roll', name: 'On a Roll', description: 'Complete 50 tasks', emoji: '🔥' },
  { id: 'streak-master', name: 'Streak Master', description: 'Maintain a 3-day streak', emoji: '⚡' },
  { id: 'level-up', name: 'Rising Star', description: 'Reach level 5', emoji: '🌟' },
];

export default function GameStats({ gameState, tasks }: GameStatsProps) {
  const pointsToNextLevel = 100 - (gameState.points % 100);
  const progressToNextLevel = (gameState.points % 100) / 100 * 100;

  const getAvatarMood = () => {
    if (gameState.level >= 10) return 'cheering';
    if (gameState.level >= 7) return 'excited';
    if (gameState.level >= 4) return 'proud';
    if (gameState.level >= 2) return 'happy';
    return 'neutral';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.levelCard}>
        <CuteAvatar mood={getAvatarMood()} size="lg" />
        <Text style={styles.levelTitle}>Level {gameState.level}</Text>
        <Text style={styles.levelSubtitle}>You're doing amazing!</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>{gameState.points} XP</Text>
            <Text style={styles.progressText}>{gameState.level * 100} XP</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressToNextLevel}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {pointsToNextLevel} XP to level {gameState.level + 1}
          </Text>
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
          <Text style={styles.statValue}>{gameState.totalCompleted}</Text>
          <Text style={styles.statLabel}>Total Done</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e9d5ff' }]}>
            <Ionicons name="flash" size={20} color="#9333ea" />
          </View>
          <Text style={styles.statValue}>{gameState.points}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#bfdbfe' }]}>
            <Ionicons name="trophy" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.statValue}>{gameState.achievements.length}</Text>
          <Text style={styles.statLabel}>Achievements</Text>
        </View>
      </View>

      <View style={styles.achievementsCard}>
        <View style={styles.achievementsHeader}>
          <Ionicons name="trophy" size={20} color="#f59e0b" />
          <Text style={styles.achievementsTitle}>Achievements</Text>
        </View>

        {achievements.map((achievement) => {
          const unlocked = gameState.achievements.includes(achievement.id);
          
          return (
            <View
              key={achievement.id}
              style={[
                styles.achievementItem,
                unlocked && styles.achievementItemUnlocked
              ]}
            >
              <Text style={[styles.achievementEmoji, !unlocked && styles.achievementEmojiLocked]}>
                {achievement.emoji}
              </Text>
              <View style={styles.achievementContent}>
                <Text style={[
                  styles.achievementName,
                  !unlocked && styles.achievementNameLocked
                ]}>
                  {achievement.name}
                </Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
              </View>
              {unlocked && (
                <View style={styles.achievementBadge}>
                  <Ionicons name="star" size={16} color="#fff" />
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.motivationalCard}>
        <Text style={styles.motivationalEmoji}>💜</Text>
        <Text style={styles.motivationalText}>
          {gameState.totalCompleted === 0 
            ? "You've got this! Every journey starts with a single step."
            : gameState.totalCompleted < 10
            ? "Amazing start! Keep the momentum going!"
            : gameState.totalCompleted < 50
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
  progressContainer: {
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
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
  achievementsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    opacity: 0.6,
  },
  achievementItemUnlocked: {
    backgroundColor: '#fef3c7',
    opacity: 1,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  achievementEmoji: {
    fontSize: 32,
  },
  achievementEmojiLocked: {
    opacity: 0.5,
  },
  achievementContent: {
    flex: 1,
    gap: 2,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  achievementNameLocked: {
    color: '#6b7280',
  },
  achievementDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  achievementBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
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

