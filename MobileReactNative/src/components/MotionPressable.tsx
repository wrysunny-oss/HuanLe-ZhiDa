import React from 'react';
import {Pressable, PressableProps, PressableStateCallbackType, StyleProp, StyleSheet, ViewStyle} from 'react-native';
import {MotionFeedback} from '../theme/motion.tokens';

type MotionPressableProps = Omit<PressableProps, 'style'> & {
  feedback?: MotionFeedback;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

const pressedStyles = StyleSheet.create({
  button: {opacity: 0.86, transform: [{scale: 0.975}]},
  listRow: {opacity: 0.76, transform: [{translateX: 2}]},
  answerOption: {opacity: 0.94, transform: [{scale: 0.995}]},
  dramaCard: {opacity: 0.82, transform: [{scale: 0.975}, {translateY: 1}]},
});

/**
 * The only Tamagui-backed interactive primitive used by business screens.
 * It intentionally owns no flex, spacing or sizing styles.
 */
export function MotionPressable({
  feedback = 'button',
  style,
  ...props
}: MotionPressableProps) {
  return (
    <Pressable
      {...props}
      style={state => [typeof style === 'function' ? style(state) : style, state.pressed && pressedStyles[feedback]]}
    />
  );
}
