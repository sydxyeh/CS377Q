import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GameState } from '../../../App.native';

interface HeaderProps {
  gameState: GameState;
}

export default function Header({ gameState }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>MindFlow</Text>
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
});

