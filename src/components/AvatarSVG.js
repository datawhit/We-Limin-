import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../lib/constants';

// Fallback avatar — used when the user hasn't uploaded a photo.
// Renders their first initial inside a circle filled with their
// "Your color" (defaulting to coral).
export default function AvatarSVG({ name, color, size = 80, textColor }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const bg = color || COLORS.coral;
  const fg = textColor || '#FFFFFF';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: bg,
    }}>
      <Text style={{
        color: fg, fontSize: size * 0.42, fontWeight: '700', letterSpacing: -0.5,
      }}>{initial}</Text>
    </View>
  );
}
