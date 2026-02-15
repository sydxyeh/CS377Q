import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GameState } from '../../../App.native';

interface HeaderProps {
  gameState: GameState;
}

export default function Header({ gameState }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>MindFlow</Text>
      <View style={styles.stats}>
        <View style={styles.statBadge}>
          <Ionicons name="trophy" size={16} color="#f59e0b" />
          <Text style={styles.statText}>Lv.{gameState.level}</Text>
        </View>
        <View style={[styles.statBadge, styles.xpBadge]}>
          <Text style={styles.statText}>{gameState.points} XP</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9333ea',
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpBadge: {
    backgroundColor: '#ede9fe',
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
});

