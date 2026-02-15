import { Trophy, Zap, Flame, Star, Award, Target } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameState, Task } from '../App';
import { CuteAvatar } from './CuteAvatar';

interface GameStatsProps {
  gameState: GameState;
  tasks: Task[];
}

const achievements = [
  { id: 'first-step', name: 'First Step', description: 'Complete your first task', icon: '🎯', emoji: '🎯' },
  { id: 'getting-started', name: 'Getting Started', description: 'Complete 10 tasks', icon: '⭐', emoji: '⭐' },
  { id: 'on-a-roll', name: 'On a Roll', description: 'Complete 50 tasks', icon: '🔥', emoji: '🔥' },
  { id: 'streak-master', name: 'Streak Master', description: 'Maintain a 3-day streak', icon: '⚡', emoji: '⚡' },
  { id: 'level-up', name: 'Rising Star', description: 'Reach level 5', icon: '🌟', emoji: '🌟' },
];

export function GameStats({ gameState, tasks }: GameStatsProps) {
  const pointsToNextLevel = 100 - (gameState.points % 100);
  const progressToNextLevel = (gameState.points % 100) / 100 * 100;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.subtasks.every(s => s.completed)).length;
  
  // Determine avatar mood based on level
  const getAvatarMood = () => {
    if (gameState.level >= 10) return 'cheering';
    if (gameState.level >= 7) return 'excited';
    if (gameState.level >= 4) return 'proud';
    if (gameState.level >= 2) return 'happy';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Level Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3">
            <CuteAvatar mood={getAvatarMood()} size="lg" />
          </div>
          <h2 className="text-3xl font-bold mb-1">Level {gameState.level}</h2>
          <p className="text-white/80 text-sm">You're doing amazing!</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{gameState.points} XP</span>
            <span>{gameState.level * 100} XP</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNextLevel}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-white rounded-full"
            />
          </div>
          <p className="text-center text-sm text-white/80">
            {pointsToNextLevel} XP to level {gameState.level + 1}
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{gameState.streak}</p>
              <p className="text-xs text-gray-600">Day Streak</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{gameState.totalCompleted}</p>
              <p className="text-xs text-gray-600">Total Done</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{gameState.points}</p>
              <p className="text-xs text-gray-600">Total XP</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{gameState.achievements.length}</p>
              <p className="text-xs text-gray-600">Achievements</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-gray-900">Achievements</h3>
        </div>

        <div className="space-y-3">
          {achievements.map((achievement, index) => {
            const unlocked = gameState.achievements.includes(achievement.id);
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                  unlocked 
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' 
                    : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className={`text-3xl ${!unlocked && 'grayscale opacity-50'}`}>
                  {achievement.emoji}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${unlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                    {achievement.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {achievement.description}
                  </p>
                </div>
                {unlocked && (
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Star className="w-4 h-4 text-white fill-white" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Motivational Message */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl p-6 text-center"
      >
        <div className="text-4xl mb-3">💜</div>
        <p className="text-gray-800 font-medium mb-2">
          {gameState.totalCompleted === 0 
            ? "You've got this! Every journey starts with a single step."
            : gameState.totalCompleted < 10
            ? "Amazing start! Keep the momentum going!"
            : gameState.totalCompleted < 50
            ? "You're on fire! Look at all that progress!"
            : "Wow! You're absolutely crushing it! 🌟"
          }
        </p>
        <p className="text-sm text-gray-600">
          Remember: Progress over perfection! 🚀
        </p>
      </motion.div>
    </div>
  );
}

