import { useState, useEffect } from 'react';
import { Brain, ListTodo, MessageCircle, Trophy } from 'lucide-react';
import { BraindumpMode } from './components/BraindumpMode';
import { TaskList } from './components/TaskList';
import { AvatarCompanion } from './components/AvatarCompanion';
import { GameStats } from './components/GameStats';
import { CuteAvatar } from './components/CuteAvatar';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'braindump' | 'tasks' | 'chat' | 'stats'>('braindump');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAvatar, setShowAvatar] = useState(true);
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
    const savedTasks = localStorage.getItem('adhd-tasks');
    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      setTasks(parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })));
    }
    
    const savedGameState = localStorage.getItem('adhd-game-state');
    if (savedGameState) {
      setGameState(JSON.parse(savedGameState));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('adhd-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('adhd-game-state', JSON.stringify(gameState));
  }, [gameState]);

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
    <div className="min-h-screen pb-20 bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            MindFlow
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-100 to-orange-100 px-3 py-1.5 rounded-full shadow-sm">
              <Trophy className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-700">Lv.{gameState.level}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-100 to-blue-100 px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-sm font-semibold text-purple-700">{gameState.points} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {activeTab === 'braindump' && (
          <BraindumpMode onTasksCreated={addTasks} gameState={gameState} />
        )}
        
        {activeTab === 'tasks' && (
          <TaskList 
            tasks={tasks}
            onToggleSubtask={toggleSubtask}
            onAddSubtask={addSubtask}
            onDeleteTask={deleteTask}
            onUpdateTask={updateTask}
            gameState={gameState}
          />
        )}

        {activeTab === 'chat' && (
          <AvatarCompanion 
            tasks={tasks}
            onToggleSubtask={toggleSubtask}
            onAddSubtask={addSubtask}
            gameState={gameState}
          />
        )}

        {activeTab === 'stats' && (
          <GameStats 
            gameState={gameState}
            tasks={tasks}
          />
        )}
      </div>

      {/* Avatar Floating Button */}
      {showAvatar && activeTab !== 'chat' && activeTab !== 'braindump' && (
        <div className="fixed top-20 right-4 z-40">
          <button
            onClick={() => setActiveTab('chat')}
            className="hover:scale-110 transition-transform"
          >
            <CuteAvatar mood="happy" size="md" />
          </button>
        </div>
      )}

      {/* Level Up Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl">
              <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Level {gameState.level}!
              </p>
              <p className="text-gray-600 mt-2">You're amazing! 🌟</p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('braindump')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'braindump' 
                ? 'bg-purple-100 text-purple-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Brain className="w-6 h-6" />
            <span className="text-xs">Braindump</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'tasks' 
                ? 'bg-purple-100 text-purple-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ListTodo className="w-6 h-6" />
            <span className="text-xs">Tasks</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors relative ${
              activeTab === 'chat' 
                ? 'bg-purple-100 text-purple-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="text-xl">🌟</div>
            <span className="text-xs">Buddy</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'stats' 
                ? 'bg-purple-100 text-purple-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-xs">Stats</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

