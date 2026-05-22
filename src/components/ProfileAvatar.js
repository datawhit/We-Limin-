import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import AvatarSVG from './AvatarSVG';
import { COLORS } from '../lib/constants';

// One-stop avatar renderer. Shows the user's uploaded photo when
// present; otherwise shows a colored circle with their first
// initial, using their chosen accent color.
export default function ProfileAvatar({ profile, size = 80, ringColor, ringWidth, style }) {
  const rw = ringColor ? (ringWidth ?? Math.max(2, Math.round(size * 0.035))) : 0;

  const container = [
    styles.base,
    { width: size, height: size, borderRadius: size / 2 },
    rw ? { borderWidth: rw, borderColor: ringColor } : null,
    style,
  ];

  if (profile?.photo_url) {
    return (
      <View style={container}>
        <Image source={{ uri: profile.photo_url }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }

  const innerSize = size - rw * 2;
  return (
    <View style={container}>
      <AvatarSVG
        name={profile?.name}
        color={profile?.accent_color || profile?.color || COLORS.coral}
        textColor={profile?.accent_text || '#FFFFFF'}
        size={innerSize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
  },
});
