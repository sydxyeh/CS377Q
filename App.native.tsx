import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BraindumpMode from './src/native/components/BraindumpMode';
import TaskList from './src/native/components/TaskList';
import AvatarCompanion from './src/native/components/AvatarCompanion';
import GameStats from './src/native/components/GameStats';
import Header from './src/native/components/Header';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  subtasks: Subtask[];
  createdAt: Date;
}

export interface GameState {
  points: number;
  level: number;
  streak: number;
  lastCompletedDate: string | null;
  achievements: string[];
  totalCompleted: number;
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    points: 0,
    level: 1,
    streak: 0,
    lastCompletedDate: null,
    achievements: [],
    totalCompleted: 0
  });
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveTasks();
  }, [tasks]);

  useEffect(() => {
    saveGameState();
  }, [gameState]);

  const loadData = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('adhd-tasks');
      if (savedTasks) {
        const parsed = JSON.parse(savedTasks);
        setTasks(parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })));
      }
      
      const savedGameState = await AsyncStorage.getItem('adhd-game-state');
      if (savedGameState) {
        setGameState(JSON.parse(savedGameState));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveTasks = async () => {
    try {
      await AsyncStorage.setItem('adhd-tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  const saveGameState = async () => {
    try {
      await AsyncStorage.setItem('adhd-game-state', JSON.stringify(gameState));
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  };

  const addPoints = (points: number) => {
    setGameState(prev => {
      const newPoints = prev.points + points;
      const newLevel = Math.floor(newPoints / 100) + 1;
      const leveledUp = newLevel > prev.level;
      
      if (leveledUp) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
      
      return {
        ...prev,
        points: newPoints,
        level: newLevel
      };
    });
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    setGameState(prev => {
      if (prev.lastCompletedDate === today) {
        return prev;
      }
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = prev.lastCompletedDate === yesterday.toDateString();
      
      return {
        ...prev,
        streak: isConsecutive ? prev.streak + 1 : 1,
        lastCompletedDate: today
      };
    });
  };

  const checkAchievements = (completedCount: number) => {
    setGameState(prev => {
      const newAchievements = [...prev.achievements];
      
      if (completedCount >= 1 && !newAchievements.includes('first-step')) {
        newAchievements.push('first-step');
      }
      if (completedCount >= 10 && !newAchievements.includes('getting-started')) {
        newAchievements.push('getting-started');
      }
      if (completedCount >= 50 && !newAchievements.includes('on-a-roll')) {
        newAchievements.push('on-a-roll');
      }
      if (prev.streak >= 3 && !newAchievements.includes('streak-master')) {
        newAchievements.push('streak-master');
      }
      if (prev.level >= 5 && !newAchievements.includes('level-up')) {
        newAchievements.push('level-up');
      }
      
      return {
        ...prev,
        achievements: newAchievements
      };
    });
  };

  const addTasks = (newTasks: Task[]) => {
    setTasks(prev => [...newTasks, ...prev]);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: t.subtasks.map(s => {
            if (s.id === subtaskId) {
              const nowCompleted = !s.completed;
              if (nowCompleted) {
                addPoints(10);
                updateStreak();
                setGameState(gs => {
                  const newTotal = gs.totalCompleted + 1;
                  checkAchievements(newTotal);
                  return { ...gs, totalCompleted: newTotal };
                });
              } else {
                addPoints(-10);
              }
              return { ...s, completed: nowCompleted };
            }
            return s;
          })
        };
      }
      return t;
    }));
  };

  const addSubtask = (taskId: string, text: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: [...t.subtasks, {
            id: Date.now().toString(),
            text,
            completed: false
          }]
        };
      }
      return t;
    }));
  };

  return (
    <NavigationContainer>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <Header gameState={gameState} />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#9333ea',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
              paddingBottom: Platform.OS === 'ios' ? 20 : 10,
              height: Platform.OS === 'ios' ? 90 : 70,
            },
          }}
        >
          <Tab.Screen
            name="Braindump"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="bulb-outline" size={size} color={color} />
              ),
            }}
          >
            {() => <BraindumpMode onTasksCreated={addTasks} gameState={gameState} />}
          </Tab.Screen>
          
          <Tab.Screen
            name="Tasks"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="list-outline" size={size} color={color} />
              ),
            }}
          >
            {() => (
              <TaskList
                tasks={tasks}
                onToggleSubtask={toggleSubtask}
                onAddSubtask={addSubtask}
                onDeleteTask={deleteTask}
                onUpdateTask={updateTask}
                gameState={gameState}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Buddy"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
              ),
            }}
          >
            {() => (
              <AvatarCompanion
                tasks={tasks}
                onToggleSubtask={toggleSubtask}
                onAddSubtask={addSubtask}
                gameState={gameState}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Stats"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy-outline" size={size} color={color} />
              ),
            }}
          >
            {() => <GameStats gameState={gameState} tasks={tasks} />}
          </Tab.Screen>
        </Tab.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

