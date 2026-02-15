import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Zap, Star, Flame, Sword, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Task, GameState } from '../App';

interface TaskListProps {
  tasks: Task[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  gameState: GameState;
}

export function TaskList({ 
  tasks, 
  onToggleSubtask, 
  onAddSubtask,
  onDeleteTask,
  onUpdateTask,
  gameState
}: TaskListProps) {
  const [newSubtaskText, setNewSubtaskText] = useState<Record<string, string>>({});
  const [showMiniCelebration, setShowMiniCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const [celebrationPosition, setCelebrationPosition] = useState({ x: 0, y: 0 });

  // Define helper function first
  const getCompletionPercentage = (task: Task) => {
    if (task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  // Focus on one task at a time - only expand the first incomplete task by default
  const getDefaultExpandedTask = () => {
    const firstIncomplete = tasks.find(t => {
      const completion = getCompletionPercentage(t);
      return completion < 100;
    });
    return firstIncomplete ? new Set([firstIncomplete.id]) : new Set();
  };

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(getDefaultExpandedTask());

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddSubtask = (taskId: string) => {
    const text = newSubtaskText[taskId]?.trim();
    if (text) {
      onAddSubtask(taskId, text);
      setNewSubtaskText(prev => ({ ...prev, [taskId]: '' }));
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string, event: React.MouseEvent) => {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(s => s.id === subtaskId);
    
    if (subtask && !subtask.completed) {
      const rect = event.currentTarget.getBoundingClientRect();
      setCelebrationPosition({ x: rect.left + rect.width / 2, y: rect.top });
      setShowMiniCelebration(true);
      setCelebrationPoints(10);
      setTimeout(() => setShowMiniCelebration(false), 1200);
    }
    
    onToggleSubtask(taskId, subtaskId);
  };

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-200">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <Sword className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No Active Quests</h3>
            <p className="text-sm text-gray-600">
              Visit the Braindump to start your adventure!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  const completedSubtasks = tasks.reduce((acc, task) => 
    acc + task.subtasks.filter(s => s.completed).length, 0);
  const healthPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Compact Stats Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-medium text-gray-700">Progress</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
        
        {/* Simplified HP Bar - no pulsing or complex animations */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${healthPercentage}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
          />
        </div>

        {/* Compact Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1 text-gray-600">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>{gameState.streak} day streak</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span>{gameState.points} XP</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Star className="w-3.5 h-3.5 text-purple-500" />
            <span>{tasks.length} quests</span>
          </div>
        </div>
      </div>

      {/* Task List - Clean and Focused */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {tasks.map((task, index) => {
            const isExpanded = expandedTasks.has(task.id);
            const completion = getCompletionPercentage(task);
            const isCompleted = completion === 100;
            const subtaskCount = task.subtasks.length;

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`bg-white rounded-xl border-2 shadow-sm transition-all ${
                  isCompleted 
                    ? 'border-green-200 bg-green-50/30' 
                    : isExpanded
                    ? 'border-purple-300'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Task Header - Clear and Simple */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleExpanded(task.id)}
                      className="mt-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {isCompleted && '✓ '}
                        {task.title}
                      </h3>

                      {/* Simple Progress Bar */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${completion}%` }}
                            transition={{ duration: 0.3 }}
                            className={`h-full ${
                              isCompleted 
                                ? 'bg-green-500' 
                                : 'bg-purple-500'
                            }`}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 flex-shrink-0">
                          {completion}%
                        </span>
                      </div>

                      {/* Task Meta Info */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} complete</span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-500" />
                          {subtaskCount * 10} XP
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtasks - Focused on Action */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                        {task.subtasks.map((subtask) => (
                          <button
                            key={subtask.id}
                            onClick={(e) => handleToggleSubtask(task.id, subtask.id, e)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                              subtask.completed 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-gray-50 border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                            }`}
                          >
                            {/* Simple Checkbox */}
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              subtask.completed 
                                ? 'bg-green-500 border-green-500' 
                                : 'border-gray-300'
                            }`}>
                              {subtask.completed && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            <span className={`flex-1 text-sm ${
                              subtask.completed 
                                ? 'text-gray-500 line-through' 
                                : 'text-gray-900 font-medium'
                            }`}>
                              {subtask.text}
                            </span>

                            {!subtask.completed && (
                              <span className="text-xs text-purple-600 font-medium flex-shrink-0">
                                +10 XP
                              </span>
                            )}
                          </button>
                        ))}

                        {/* Add Subtask - Clear and Focused */}
                        <div className="flex gap-2 mt-3 pt-2">
                          <input
                            type="text"
                            value={newSubtaskText[task.id] || ''}
                            onChange={(e) => setNewSubtaskText(prev => ({
                              ...prev,
                              [task.id]: e.target.value
                            }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddSubtask(task.id);
                              }
                            }}
                            placeholder="Add objective..."
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                          />
                          <button
                            onClick={() => handleAddSubtask(task.id)}
                            disabled={!newSubtaskText[task.id]?.trim()}
                            className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Simple XP Popup - Quick and Clear */}
      <AnimatePresence>
        {showMiniCelebration && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{ opacity: 1, y: -50, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              position: 'fixed',
              left: celebrationPosition.x,
              top: celebrationPosition.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
              pointerEvents: 'none'
            }}
          >
            <div className="bg-purple-500 text-white px-4 py-2 rounded-full font-bold shadow-lg text-sm">
              +{celebrationPoints} XP
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

