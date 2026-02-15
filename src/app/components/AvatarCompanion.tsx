import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Sparkles, Heart, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Task, GameState } from '../App';
import { CuteAvatar } from './CuteAvatar';

interface Message {
  id: string;
  type: 'user' | 'avatar';
  text: string;
  timestamp: Date;
}

interface AvatarCompanionProps {
  tasks: Task[];
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  gameState: GameState;
}

const encouragementMessages = [
  "You're doing amazing! 🌟",
  "Every step forward is progress! 💪",
  "I'm proud of you for showing up! ✨",
  "You're making it happen! 🎯",
  "Look at you go! Keep it up! 🚀",
  "Progress over perfection! 💜",
  "You're stronger than you think! 💪",
  "One task at a time, you've got this! 🌈"
];

export function AvatarCompanion({ tasks, onToggleSubtask, onAddSubtask, gameState }: AvatarCompanionProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'avatar',
      text: "Hey there! 👋 I'm here to help you stay on track. Tell me what you're working on, or let me know when you complete something!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getRandomEncouragement = () => {
    return encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
  };

  const parseUserMessage = (text: string): string => {
    const lowerText = text.toLowerCase();

    // Check for completion reports
    if (lowerText.includes('done') || lowerText.includes('finished') || lowerText.includes('completed')) {
      return `${getRandomEncouragement()} That's awesome progress! What's next on your list?`;
    }

    // Check for starting something
    if (lowerText.includes('starting') || lowerText.includes('working on') || lowerText.includes('doing')) {
      return `Great choice to get started! Remember, you don't have to do it all at once. Just take it one step at a time. I'm here with you! 💪`;
    }

    // Check for struggles
    if (lowerText.includes('hard') || lowerText.includes('difficult') || lowerText.includes('stuck') || lowerText.includes('can\'t')) {
      return `I hear you - it's tough sometimes. That's totally okay! Let's break it down into even smaller pieces. What's the tiniest first step you could take? 🤗`;
    }

    // Check for overwhelm
    if (lowerText.includes('overwhelmed') || lowerText.includes('too much') || lowerText.includes('stressed')) {
      return `Take a breath - you don't have to do everything right now. Let's focus on just ONE thing. Which task feels most doable at this moment? 🌸`;
    }

    // Check for task additions
    if (lowerText.includes('add') || lowerText.includes('need to') || lowerText.includes('should')) {
      return `Got it! I've noted that down. Remember, it's all about progress, not perfection. When do you think you might tackle this? 📝`;
    }

    // Generic supportive response
    const responses = [
      `I'm listening! Tell me more - how can I support you right now? 💙`,
      `Thanks for checking in! How are you feeling about your tasks today? 🌟`,
      `I'm here for you! What would be most helpful - encouragement, breaking down a task, or just talking it through? 💜`,
      `You're doing great by staying engaged! What's on your mind? ✨`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate thinking time
    setTimeout(() => {
      const avatarResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'avatar',
        text: parseUserMessage(inputText),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, avatarResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      setIsRecording(false);
      // Simulate voice transcription
      setTimeout(() => {
        setInputText("I just finished cleaning my room!");
      }, 500);
    } else {
      setIsRecording(true);
    }
  };

  const completedToday = tasks.reduce((acc, task) => {
    return acc + task.subtasks.filter(s => s.completed).length;
  }, 0);

  const totalSubtasks = tasks.reduce((acc, task) => acc + task.subtasks.length, 0);
  
  // Determine avatar mood based on progress
  const getAvatarMood = () => {
    if (totalSubtasks === 0) return 'neutral';
    const progress = completedToday / totalSubtasks;
    if (progress >= 0.8) return 'cheering';
    if (progress >= 0.5) return 'excited';
    if (progress >= 0.3) return 'proud';
    if (progress > 0) return 'happy';
    return 'neutral';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Avatar Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-6 mb-4 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16">
            <CuteAvatar mood={getAvatarMood()} size="md" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Your Buddy</h3>
            <p className="text-sm text-white/90">Always here for you! 💜</p>
          </div>
        </div>
        
        {/* Progress Stats */}
        {totalSubtasks > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Today's Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{completedToday}</span>
              <span className="text-sm text-white/80">/ {totalSubtasks}</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${
                message.type === 'user' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                  : 'bg-white text-gray-900 shadow-sm'
              } rounded-2xl px-4 py-3`}>
                {message.type === 'avatar' && (
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-purple-600">Companion</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-white/70' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-purple-400 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.6,
                      delay: i * 0.1
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={handleVoiceInput}
            className={`p-3 rounded-xl transition-colors ${
              isRecording 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isRecording ? "Listening..." : "Tell me what you're working on..."}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            disabled={isRecording}
          />

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => {
              setInputText("I just completed a task!");
              setTimeout(handleSendMessage, 100);
            }}
            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs hover:bg-green-200 transition-colors"
          >
            ✅ Completed something
          </button>
          <button
            onClick={() => {
              setInputText("I'm feeling overwhelmed");
              setTimeout(handleSendMessage, 100);
            }}
            className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs hover:bg-orange-200 transition-colors"
          >
            😰 Need support
          </button>
          <button
            onClick={() => {
              setInputText("Starting to work now");
              setTimeout(handleSendMessage, 100);
            }}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200 transition-colors"
          >
            🚀 Getting started
          </button>
        </div>
      </div>
    </div>
  );
}

