import React, {
  useState,
  useEffect,
  useRef,
  Component,
  ErrorInfo,
  ReactNode,
} from "react";
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
  Text,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BraindumpMode from "./src/native/components/BraindumpMode";
import TaskList from "./src/native/components/TaskList";
import AvatarCompanion from "./src/native/components/AvatarCompanion";
import GameStats from "./src/native/components/GameStats";
import Header from "./src/native/components/Header";

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={errorStyles.container}>
          <ScrollView contentContainerStyle={errorStyles.content}>
            <Text style={errorStyles.title}>Something went wrong</Text>
            <Text style={errorStyles.message}>
              {this.state.error?.message || "An unexpected error occurred"}
            </Text>
            <Text style={errorStyles.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

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

export interface FinishedTask extends Task {
  completedAt: string; // ISO date string
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

const CONFETTI_COLORS = [
  "#9333ea",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];
const NUM_PIECES = 48;

function ConfettiOverlay({ visible }: { visible: boolean }) {
  const { width } = Dimensions.get("window");
  const anims = useRef(
    Array.from({ length: NUM_PIECES }, () => ({
      y: new Animated.Value(-20),
      x: new Animated.Value(0),
      rot: new Animated.Value(0),
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      startX: Math.random() * width,
      delay: Math.random() * 400,
      duration: 2000 + Math.random() * 1000,
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;
    anims.forEach((a) => {
      a.y.setValue(-20);
      a.x.setValue(0);
      a.rot.setValue(0);
    });
    const animations = anims.map((a) =>
      Animated.parallel([
        Animated.timing(a.y, {
          toValue: Dimensions.get("window").height + 30,
          duration: a.duration,
          delay: a.delay,
          useNativeDriver: true,
        }),
        Animated.timing(a.x, {
          toValue: (Math.random() - 0.5) * 80,
          duration: a.duration,
          delay: a.delay,
          useNativeDriver: true,
        }),
        Animated.timing(a.rot, {
          toValue: Math.random() * 360,
          duration: a.duration,
          delay: a.delay,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.stagger(0, animations).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <View style={confettiStyles.overlay} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            confettiStyles.piece,
            {
              left: a.startX,
              backgroundColor: a.color,
              transform: [
                { translateY: a.y },
                { translateX: a.x },
                {
                  rotate: a.rot.interpolate({
                    inputRange: [0, 360],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  piece: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [finishedTasks, setFinishedTasks] = useState<FinishedTask[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    points: 0,
    level: 1,
    streak: 0,
    lastCompletedDate: null,
    achievements: [],
    totalCompleted: 0,
  });
  const [showCelebration, setShowCelebration] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedTabJustUpdated, setCompletedTabJustUpdated] = useState(false);

  useEffect(() => {
    loadGameStateOnly();
  }, []);

  useEffect(() => {
    saveGameState();
  }, [gameState]);

  const loadGameStateOnly = async () => {
    try {
      const savedGameState = await AsyncStorage.getItem("adhd-game-state");
      if (savedGameState) {
        setGameState(JSON.parse(savedGameState));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const saveGameState = async () => {
    try {
      await AsyncStorage.setItem("adhd-game-state", JSON.stringify(gameState));
    } catch (error) {
      console.error("Error saving game state:", error);
    }
  };

  const addPoints = (points: number) => {
    setGameState((prev) => {
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
        level: newLevel,
      };
    });
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    setGameState((prev) => {
      if (prev.lastCompletedDate === today) {
        return prev;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = prev.lastCompletedDate === yesterday.toDateString();

      return {
        ...prev,
        streak: isConsecutive ? prev.streak + 1 : 1,
        lastCompletedDate: today,
      };
    });
  };

  const checkAchievements = (completedCount: number) => {
    setGameState((prev) => {
      const newAchievements = [...prev.achievements];

      if (completedCount >= 1 && !newAchievements.includes("first-step")) {
        newAchievements.push("first-step");
      }
      if (
        completedCount >= 10 &&
        !newAchievements.includes("getting-started")
      ) {
        newAchievements.push("getting-started");
      }
      if (completedCount >= 50 && !newAchievements.includes("on-a-roll")) {
        newAchievements.push("on-a-roll");
      }
      if (prev.streak >= 3 && !newAchievements.includes("streak-master")) {
        newAchievements.push("streak-master");
      }
      if (prev.level >= 5 && !newAchievements.includes("level-up")) {
        newAchievements.push("level-up");
      }

      return {
        ...prev,
        achievements: newAchievements,
      };
    });
  };

  const addTasks = (newTasks: Task[]) => {
    const normalized = newTasks.map((t): Task => {
      const taskId = String(t.id);
      return {
        id: taskId,
        title: String(t.title ?? ""),
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks.map((s, i) => ({
              id: `${taskId}-sub-${i}-${Math.random().toString(36).slice(2, 9)}`,
              text: String(s.text ?? ""),
              completed: Boolean(s.completed),
            }))
          : [],
        createdAt:
          t.createdAt instanceof Date
            ? t.createdAt
            : new Date(t.createdAt as unknown as string),
      };
    });
    setTasks((prev) => [...normalized, ...prev]);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    );
  };

  const reorderTasks = (reordered: Task[]) => {
    setTasks(reordered);
  };

  const completeTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const finished: FinishedTask = {
      ...task,
      completedAt: new Date().toISOString(),
    };
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setFinishedTasks((prev) => [finished, ...prev]);
  };

  const completeTaskWithCelebration = (task: Task) => {
    setShowConfetti(true);
    setTimeout(() => {
      completeTask(task.id);
      setCompletedTabJustUpdated(true);
      setTimeout(() => setCompletedTabJustUpdated(false), 2200);
      setShowConfetti(false);
    }, 2600);
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: t.subtasks.map((s) => {
              if (s.id === subtaskId) {
                const nowCompleted = !s.completed;
                if (nowCompleted) {
                  addPoints(10);
                  updateStreak();
                  setGameState((gs) => {
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
            }),
          };
        }
        return t;
      }),
    );
  };

  const addSubtask = (taskId: string, text: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const subId = `${taskId}-sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          return {
            ...t,
            subtasks: [...t.subtasks, { id: subId, text, completed: false }],
          };
        }
        return t;
      }),
    );
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.container}>
          <NavigationContainer>
            <SafeAreaView style={styles.container} edges={["top"]}>
              <StatusBar barStyle="dark-content" />
              <Header gameState={gameState} />
              <ConfettiOverlay visible={showConfetti} />
              <Tab.Navigator
                screenOptions={{
                  headerShown: false,
                  tabBarActiveTintColor: "#9333ea",
                  tabBarInactiveTintColor: "#6b7280",
                  tabBarStyle: {
                    backgroundColor: "#ffffff",
                    borderTopWidth: 1,
                    borderTopColor: "#e5e7eb",
                    paddingBottom: Platform.OS === "ios" ? 20 : 10,
                    height: Platform.OS === "ios" ? 90 : 70,
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
                  {() => (
                    <BraindumpMode
                      onTasksCreated={addTasks}
                      gameState={gameState}
                    />
                  )}
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
                      finishedTasks={finishedTasks}
                      onToggleSubtask={toggleSubtask}
                      onAddSubtask={addSubtask}
                      onCompleteTask={completeTask}
                      onConfirmCompleteTask={completeTaskWithCelebration}
                      onUpdateTask={updateTask}
                      onReorderTasks={reorderTasks}
                      completedTabJustUpdated={completedTabJustUpdated}
                      gameState={gameState}
                    />
                  )}
                </Tab.Screen>

                <Tab.Screen
                  name="Stats"
                  options={{
                    tabBarIcon: ({ color, size }) => (
                      <Ionicons
                        name="trophy-outline"
                        size={size}
                        color={color}
                      />
                    ),
                  }}
                >
                  {() => (
                    <GameStats
                      gameState={gameState}
                      tasks={tasks}
                      finishedTasks={finishedTasks}
                    />
                  )}
                </Tab.Screen>
              </Tab.Navigator>
            </SafeAreaView>
          </NavigationContainer>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 20,
  },
  stack: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
