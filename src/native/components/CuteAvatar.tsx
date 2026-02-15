import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';

interface CuteAvatarProps {
  mood: 'happy' | 'excited' | 'proud' | 'cheering' | 'neutral' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 64,
  md: 96,
  lg: 128,
};

const expressions = {
  neutral: { eyes: '• •', mouth: '‿', colors: ['#a78bfa', '#60a5fa'] },
  happy: { eyes: '^ ^', mouth: '‿', colors: ['#a78bfa', '#f472b6'] },
  excited: { eyes: '✨ ✨', mouth: '▽', colors: ['#fbbf24', '#fb923c'] },
  proud: { eyes: '◕ ◕', mouth: '◡', colors: ['#f472b6', '#a78bfa'] },
  cheering: { eyes: '☆ ☆', mouth: '▿', colors: ['#4ade80', '#60a5fa'] },
  thinking: { eyes: '• •', mouth: '○', colors: ['#60a5fa', '#22d3ee'] },
};

export default function CuteAvatar({ mood, size = 'md' }: CuteAvatarProps) {
  const expression = expressions[mood];
  const avatarSize = sizeMap[size];
  
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (mood === 'neutral' || mood === 'thinking') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1
      );
    } else if (mood === 'happy') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 500 }),
          withTiming(5, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1
      );
    } else if (mood === 'excited') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 200 }),
          withTiming(10, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
    } else if (mood === 'proud') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 500 }),
          withTiming(-5, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1
      );
    } else if (mood === 'cheering') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-15, { duration: 400 }),
          withTiming(-5, { duration: 200 }),
          withTiming(-15, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-15, { duration: 200 }),
          withTiming(15, { duration: 200 }),
          withTiming(-15, { duration: 200 }),
          withTiming(15, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
    }
  }, [mood]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.container, { width: avatarSize, height: avatarSize }, animatedStyle]}>
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: expression.colors[0],
          },
        ]}
      >
        <View style={styles.face}>
          <View style={styles.eyes}>
            <Text style={styles.eyeText}>{expression.eyes.split(' ')[0]}</Text>
            <Text style={styles.eyeText}>{expression.eyes.split(' ')[1]}</Text>
          </View>
          <Text style={styles.mouth}>{expression.mouth}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyes: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  eyeText: {
    fontSize: 18,
  },
  mouth: {
    fontSize: 24,
  },
});

