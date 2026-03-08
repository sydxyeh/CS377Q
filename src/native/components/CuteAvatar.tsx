import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const smoothEasing = Easing.inOut(Easing.cubic);

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
  neutral: { colors: ['#a78bfa', '#60a5fa'] as [string, string], hasBlush: true },
  happy: { colors: ['#a78bfa', '#f472b6'] as [string, string], hasBlush: true },
  excited: { colors: ['#fbbf24', '#fb923c'] as [string, string], hasBlush: true },
  proud: { colors: ['#f472b6', '#a78bfa'] as [string, string], hasBlush: true },
  cheering: { colors: ['#4ade80', '#60a5fa'] as [string, string], hasBlush: true },
  thinking: { colors: ['#60a5fa', '#22d3ee'] as [string, string], hasBlush: true },
};

type Mood = keyof typeof expressions;

const handPositions: Record<
  Mood,
  { left: { top: number; left: number; rotate: number }; right: { top: number; right: number; rotate: number } }
> = {
  neutral: {
    left: { top: 0.52, left: -0.08, rotate: 10 },
    right: { top: 0.52, right: -0.08, rotate: -10 },
  },
  happy: {
    left: { top: 0.48, left: -0.06, rotate: 25 },
    right: { top: 0.48, right: -0.06, rotate: -25 },
  },
  excited: {
    left: { top: 0.15, left: 0.02, rotate: -35 },
    right: { top: 0.15, right: 0.02, rotate: 35 },
  },
  proud: {
    left: { top: 0.5, left: -0.1, rotate: 15 },
    right: { top: 0.5, right: -0.1, rotate: -15 },
  },
  cheering: {
    left: { top: 0.08, left: 0.05, rotate: -40 },
    right: { top: 0.08, right: 0.05, rotate: 40 },
  },
  thinking: {
    left: { top: 0.28, left: 0, rotate: -55 },
    right: { top: 0.55, right: -0.08, rotate: -8 },
  },
};

export default function CuteAvatar({ mood, size = 'md' }: CuteAvatarProps) {
  const expression = expressions[mood];
  const avatarSize = sizeMap[size];

  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const pressScale = useSharedValue(1);

  React.useEffect(() => {
    const timing = (toValue: number, duration: number) =>
      withTiming(toValue, { duration, easing: smoothEasing });

    if (mood === 'neutral' || mood === 'thinking') {
      translateY.value = withRepeat(
        withSequence(
          timing(-5, 1800),
          timing(0, 1800)
        ),
        -1
      );
    } else if (mood === 'happy') {
      translateY.value = withRepeat(
        withSequence(
          timing(-8, 1800),
          timing(0, 1800)
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          timing(-5, 900),
          timing(5, 900),
          timing(0, 900)
        ),
        -1
      );
    } else if (mood === 'excited') {
      scale.value = withRepeat(
        withSequence(
          timing(1.1, 700),
          timing(1, 700)
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          timing(-10, 500),
          timing(10, 500),
          timing(0, 500)
        ),
        -1
      );
    } else if (mood === 'proud') {
      translateY.value = withRepeat(
        withSequence(
          timing(-10, 1800),
          timing(0, 1800)
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          timing(5, 900),
          timing(-5, 900),
          timing(0, 900)
        ),
        -1
      );
    } else if (mood === 'cheering') {
      translateY.value = withRepeat(
        withSequence(
          timing(-15, 900),
          timing(-5, 600),
          timing(-15, 900),
          timing(0, 900)
        ),
        -1
      );
      rotate.value = withRepeat(
        withSequence(
          timing(-15, 500),
          timing(15, 500),
          timing(-15, 500),
          timing(15, 500),
          timing(0, 500)
        ),
        -1
      );
    }
  }, [mood]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value * pressScale.value },
    ],
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.92, { duration: 80, easing: smoothEasing });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    pressScale.value = withTiming(1, { duration: 220, easing: smoothEasing });
  };

  const eyeSize = Math.max(4, avatarSize * 0.09);
  const eyeGap = avatarSize * 0.2;
  const mouthWidth = avatarSize * 0.36;
  const mouthHeight = mood === 'thinking' ? mouthWidth * 0.9 : mouthWidth / 2;
  const blushSize = avatarSize * 0.12;

  const handWidth = avatarSize * 0.22;
  const handHeight = avatarSize * 0.12;
  const wrapperWidth = avatarSize * 1.32;
  const hp = handPositions[mood];

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ width: wrapperWidth, height: avatarSize }]}
    >
      <Animated.View
        style={[
          styles.container,
          { width: wrapperWidth, height: avatarSize },
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.hand,
            {
              width: handWidth,
              height: handHeight,
              borderRadius: handHeight / 2,
              top: avatarSize * hp.left.top - handHeight / 2,
              left: (wrapperWidth - avatarSize) / 2 + avatarSize * (0.5 + hp.left.left) - handWidth / 2,
              transform: [{ rotate: `${hp.left.rotate}deg` }],
            },
          ]}
        >
          <LinearGradient
            colors={expression.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: handHeight / 2 }]}
          />
        </View>
        <View
          style={[
            styles.hand,
            {
              width: handWidth,
              height: handHeight,
              borderRadius: handHeight / 2,
              top: avatarSize * hp.right.top - handHeight / 2,
              left: (wrapperWidth - avatarSize) / 2 + avatarSize * (0.5 - hp.right.right) - handWidth / 2,
              transform: [{ rotate: `${hp.right.rotate}deg` }],
            },
          ]}
        >
          <LinearGradient
            colors={expression.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: handHeight / 2 }]}
          />
        </View>
        <LinearGradient
          colors={expression.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              marginLeft: (wrapperWidth - avatarSize) / 2,
            },
          ]}
        >
          {(
            <>
              <View
                style={[
                  styles.blush,
                  {
                    position: 'absolute',
                    width: blushSize,
                    height: blushSize,
                    borderRadius: blushSize / 2,
                    left: avatarSize * 0.12,
                    top: avatarSize * 0.38,
                  },
                ]}
              />
              <View
                style={[
                  styles.blush,
                  {
                    position: 'absolute',
                    width: blushSize,
                    height: blushSize,
                    borderRadius: blushSize / 2,
                    right: avatarSize * 0.12,
                    top: avatarSize * 0.38,
                  },
                ]}
              />
            </>
          )}
          <View style={styles.face}>
            <View style={[styles.eyes, { gap: eyeGap, marginBottom: avatarSize * 0.08 }]}>
              <View
                style={[
                  styles.eye,
                  {
                    width: eyeSize,
                    height: eyeSize,
                    borderRadius: eyeSize / 2,
                  },
                ]}
              />
              <View
                style={[
                  styles.eye,
                  {
                    width: eyeSize,
                    height: eyeSize,
                    borderRadius: eyeSize / 2,
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.mouth,
                mood === 'thinking'
                  ? {
                      width: mouthHeight,
                      height: mouthHeight,
                      borderRadius: mouthHeight / 2,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    }
                  : {
                      width: mouthWidth,
                      height: mouthWidth / 2,
                      borderBottomLeftRadius: mouthWidth / 2,
                      borderBottomRightRadius: mouthWidth / 2,
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                    },
              ]}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  hand: {
    position: 'absolute',
    overflow: 'hidden',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  mouth: {
    alignSelf: 'center',
  },
  blush: {
    backgroundColor: 'rgba(251, 182, 206, 0.5)',
    pointerEvents: 'none',
  },
});
