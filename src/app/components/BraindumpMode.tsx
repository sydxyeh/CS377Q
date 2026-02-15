import { useState } from 'react';
import { Mic, MicOff, FileText, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Task, GameState } from '../App';
import { CuteAvatar } from './CuteAvatar';

interface BraindumpModeProps {
  onTasksCreated: (tasks: Task[]) => void;
  gameState: GameState;
}

export function BraindumpMode({ onTasksCreated, gameState }: BraindumpModeProps) {
  const [mode, setMode] = useState<'voice' | 'written'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [writtenText, setWrittenText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine avatar mood based on state
  const getAvatarMood = () => {
    if (isProcessing) return 'excited';
    if (isRecording) return 'happy';
    if (transcript || writtenText) return 'proud';
    return 'neutral';
  };

  const getAvatarMessage = () => {
    if (isProcessing) return "Let me organize that for you! 🎯";
    if (isRecording) return "I'm listening... keep going! 💜";
    if (transcript || writtenText) return "Got it! Ready when you are! ✨";
    if (mode === 'voice') return "Tell me what's on your mind! 💭";
    return "Write it all out - no filter needed! 📝";
  };

  const startRecording = () => {
    setIsRecording(true);
    setTranscript('');
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Simulate transcription
    setTimeout(() => {
      setTranscript("I need to clean my room and also finish that project for work, oh and remember to call mom, maybe I should also organize my desk and download those files");
    }, 500);
  };

  const parseAndCreateTasks = (text: string) => {
    setIsProcessing(true);
    
    // Simulate AI parsing
    setTimeout(() => {
      const tasks: Task[] = [];
      
      // Simple parsing logic to split by conjunctions and create subtasks
      const segments = text.toLowerCase()
        .split(/(?:and also|also|and|oh and|maybe|,|;)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      segments.forEach((segment) => {
        const taskId = Date.now().toString() + Math.random();
        
        // Create subtasks based on the segment
        let title = segment.charAt(0).toUpperCase() + segment.slice(1);
        const subtasks = [];
        
        if (segment.includes('clean')) {
          title = 'Clean room';
          subtasks.push(
            { id: taskId + '_1', text: 'Pick up clothes', completed: false },
            { id: taskId + '_2', text: 'Make bed', completed: false },
            { id: taskId + '_3', text: 'Vacuum floor', completed: false }
          );
        } else if (segment.includes('project') || segment.includes('work')) {
          title = 'Finish work project';
          subtasks.push(
            { id: taskId + '_1', text: 'Review requirements', completed: false },
            { id: taskId + '_2', text: 'Complete draft', completed: false },
            { id: taskId + '_3', text: 'Send for review', completed: false }
          );
        } else if (segment.includes('call')) {
          title = 'Call mom';
          subtasks.push(
            { id: taskId + '_1', text: 'Find a quiet time', completed: false },
            { id: taskId + '_2', text: 'Make the call', completed: false }
          );
        } else if (segment.includes('organize') || segment.includes('desk')) {
          title = 'Organize desk';
          subtasks.push(
            { id: taskId + '_1', text: 'Clear desk surface', completed: false },
            { id: taskId + '_2', text: 'Sort papers', completed: false },
            { id: taskId + '_3', text: 'Arrange supplies', completed: false }
          );
        } else if (segment.includes('download')) {
          title = 'Download files';
          subtasks.push(
            { id: taskId + '_1', text: 'Find download links', completed: false },
            { id: taskId + '_2', text: 'Download files', completed: false },
            { id: taskId + '_3', text: 'Organize in folders', completed: false }
          );
        } else {
          // Generic task
          subtasks.push(
            { id: taskId + '_1', text: `Start: ${title}`, completed: false },
            { id: taskId + '_2', text: `Complete: ${title}`, completed: false }
          );
        }

        tasks.push({
          id: taskId,
          title,
          subtasks,
          createdAt: new Date()
        });
      });

      onTasksCreated(tasks);
      setIsProcessing(false);
      setTranscript('');
      setWrittenText('');
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Avatar Companion Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CuteAvatar mood={getAvatarMood()} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <motion.div
              key={getAvatarMessage()}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl px-4 py-3 shadow-sm"
            >
              <p className="text-sm text-gray-800">{getAvatarMessage()}</p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Mode Toggle */}
      <div className="bg-white rounded-2xl p-2 shadow-sm flex gap-2">
        <button
          onClick={() => setMode('voice')}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
            mode === 'voice'
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span>Voice Mode</span>
        </button>
        <button
          onClick={() => setMode('written')}
          className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
            mode === 'written'
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Written Mode</span>
        </button>
      </div>

      {/* Voice Mode */}
      {mode === 'voice' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="text-center space-y-4">
              <motion.div
                animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: isRecording ? Infinity : 0, duration: 1.5 }}
              >
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-gradient-to-br from-purple-500 to-blue-500 hover:scale-105'
                  }`}
                  disabled={isProcessing}
                >
                  {isRecording ? (
                    <MicOff className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}
                </button>
              </motion.div>
              
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isRecording ? 'Listening...' : 'Tap to start braindump'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Say whatever's on your mind. No structure needed.
                </p>
              </div>

              {isRecording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center gap-1"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-red-500 rounded-full"
                      animate={{
                        height: [10, 25, 10],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Transcript */}
          <AnimatePresence>
            {transcript && !isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
              >
                <p className="text-gray-700 italic">"{transcript}"</p>
                <button
                  onClick={() => parseAndCreateTasks(transcript)}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Create Tasks</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Written Mode */}
      {mode === 'written' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brain dump here
              </label>
              <textarea
                value={writtenText}
                onChange={(e) => setWrittenText(e.target.value)}
                placeholder="Type everything on your mind... no organization needed, just let it flow"
                className="w-full h-48 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isProcessing}
              />
            </div>
            
            <button
              onClick={() => parseAndCreateTasks(writtenText)}
              disabled={!writtenText.trim() || isProcessing}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              <span>Create Tasks</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Processing State */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="bg-white rounded-2xl p-8 shadow-2xl text-center space-y-4 max-w-xs mx-4"
            >
              <div className="flex justify-center">
                <CuteAvatar mood="thinking" size="lg" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Breaking it down...
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Creating actionable subtasks for you! 🎯
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

