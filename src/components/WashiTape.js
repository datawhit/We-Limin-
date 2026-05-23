// A short colored strip that sits absolutely on top of a card to
// suggest tape holding a polaroid down. Default is positioned at
// the top of the parent; pass `style` to override top/left/right.
//
//   <WashiTape color="amber" width="28%" rotation={-3}
//              style={{ top: -6, left: '36%' }} />

import React from 'react';
import { View } from 'react-native';
import { TAPE_COLORS } from '../lib/theme';

export default function WashiTape({
  color = 'amber',
  width = '50%',
  height = 14,
  rotation = -3,
  opacity = 0.85,
  style,
}) {
  const bg = TAPE_COLORS[color] || color; // accept a token or a raw hex
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -8,
          left: '25%',
          width,
          height,
          backgroundColor: bg,
          opacity,
          transform: [{ rotate: `${rotation}deg` }],
        },
        style,
      ]}
    />
  );
}
