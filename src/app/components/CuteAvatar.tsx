import { motion } from 'motion/react';

interface CuteAvatarProps {
  mood: 'happy' | 'excited' | 'proud' | 'cheering' | 'neutral' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
}

export function CuteAvatar({ mood, size = 'md' }: CuteAvatarProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const expressions = {
    neutral: { eyes: '• •', mouth: '‿', color: 'from-purple-400 to-blue-400' },
    happy: { eyes: '^ ^', mouth: '‿', color: 'from-purple-400 to-pink-400' },
    excited: { eyes: '✨ ✨', mouth: '▽', color: 'from-yellow-400 to-orange-400' },
    proud: { eyes: '◕ ◕', mouth: '◡', color: 'from-pink-400 to-purple-400' },
    cheering: { eyes: '☆ ☆', mouth: '▿', color: 'from-green-400 to-blue-400' },
    thinking: { eyes: '• •', mouth: '○', color: 'from-blue-400 to-cyan-400' }
  };

  const expression = expressions[mood];

  const animations = {
    neutral: { y: [0, -5, 0] },
    happy: { 
      y: [0, -8, 0],
      rotate: [0, -5, 5, 0]
    },
    excited: { 
      scale: [1, 1.1, 1],
      rotate: [0, -10, 10, -10, 10, 0]
    },
    proud: { 
      y: [0, -10, 0],
      rotate: [0, 5, -5, 0]
    },
    cheering: { 
      y: [0, -15, -5, -15, 0],
      rotate: [0, -15, 15, -15, 15, 0]
    },
    thinking: { 
      y: [0, -8, 0]
    }
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} relative`}
      animate={animations[mood]}
      transition={{
        duration: mood === 'cheering' ? 0.8 : mood === 'excited' ? 0.6 : 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {/* Body */}
      <div className={`w-full h-full bg-gradient-to-br ${expression.color} rounded-full shadow-lg flex items-center justify-center relative overflow-hidden`}>
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full" />
        
        {/* Face container */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Eyes */}
          <div className="flex gap-3 mb-2">
            <span className="text-lg">{expression.eyes.split(' ')[0]}</span>
            <span className="text-lg">{expression.eyes.split(' ')[1]}</span>
          </div>
          
          {/* Mouth */}
          <div className="text-2xl">{expression.mouth}</div>
        </div>

        {/* Cheeks - only show on happy/excited moods */}
        {(mood === 'happy' || mood === 'excited' || mood === 'proud') && (
          <>
            <motion.div
              className="absolute left-2 top-1/2 w-3 h-3 bg-pink-300 rounded-full opacity-60"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.div
              className="absolute right-2 top-1/2 w-3 h-3 bg-pink-300 rounded-full opacity-60"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
      </div>

      {/* Sparkles for excited/cheering moods */}
      {(mood === 'excited' || mood === 'cheering') && (
        <>
          <motion.div
            className="absolute -top-2 -left-2 text-xl"
            animate={{
              opacity: [0, 1, 0],
              y: [0, -10],
              rotate: [0, 180]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          >
            ✨
          </motion.div>
          <motion.div
            className="absolute -top-2 -right-2 text-xl"
            animate={{
              opacity: [0, 1, 0],
              y: [0, -10],
              rotate: [0, -180]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: 0.7,
              ease: "easeOut"
            }}
          >
            ⭐
          </motion.div>
        </>
      )}

      {/* Hearts for proud mood */}
      {mood === 'proud' && (
        <>
          <motion.div
            className="absolute -bottom-1 left-1/4 text-sm"
            animate={{
              opacity: [0, 1, 0],
              y: [0, -20],
              scale: [0.5, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut"
            }}
          >
            💜
          </motion.div>
          <motion.div
            className="absolute -bottom-1 right-1/4 text-sm"
            animate={{
              opacity: [0, 1, 0],
              y: [0, -20],
              scale: [0.5, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 1,
              ease: "easeOut"
            }}
          >
            💙
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

