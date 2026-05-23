// Small hand-drawn SVG doodles used to scatter accents on
// scrapbook-style cards. Every component is non-blocking
// (pointerEvents="none") and positioned via the caller's `style`.
//
// Common props:
//   color    — stroke / fill color (default coral)
//   size     — bounding box edge in px (default per-shape)
//   opacity  — 0–1 (default per-shape)
//   style    — absolute-position offsets etc.
//
// Drop them onto any card by wrapping in a `position: 'relative'`
// parent and passing position via style.

import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../lib/constants';

function Wrap({ children, size, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      {children}
    </View>
  );
}

export function Star({ color = COLORS.coral, size = 16, opacity = 0.35, style }) {
  return (
    <Wrap size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path
          d="M10 1 L11.8 7.4 L18.5 8 L13.4 12.2 L15 19 L10 15.2 L5 19 L6.6 12.2 L1.5 8 L8.2 7.4 Z"
          fill={color} fillOpacity={opacity}
        />
      </Svg>
    </Wrap>
  );
}

export function Heart({ color = COLORS.coral, size = 16, opacity = 0.3, style }) {
  return (
    <Wrap size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path
          d="M10 17 C 4 12 1 9 1 6 C 1 3.5 3 2 5 2 C 7 2 9 3.5 10 5 C 11 3.5 13 2 15 2 C 17 2 19 3.5 19 6 C 19 9 16 12 10 17 Z"
          fill={color} fillOpacity={opacity}
        />
      </Svg>
    </Wrap>
  );
}

// Four-line sparkle / asterisk mark — punctuation for headlines.
export function Sparkle({ color = COLORS.coral, size = 14, opacity = 0.4, style }) {
  return (
    <Wrap size={size} style={style}>
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Path
          d="M7 0 V14 M0 7 H14 M2 2 L12 12 M12 2 L2 12"
          stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={opacity}
        />
      </Svg>
    </Wrap>
  );
}

// Curly arrow used for "spin the lime ↩" style annotations.
// `size` here scales the bounding box (50×28 native ratio).
export function CurvedArrow({ color = COLORS.dark, size = 50, opacity = 1, style }) {
  const h = Math.round(size * 0.56); // preserve 50:28 ratio
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: h }, style]}>
      <Svg width={size} height={h} viewBox="0 0 50 28">
        <Path
          d="M2 4 Q 22 -2, 36 8 Q 44 14, 30 22"
          stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={opacity}
        />
        <Path
          d="M30 22 L34 20 M30 22 L32 26"
          stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={opacity}
        />
      </Svg>
    </View>
  );
}

// Wavy underline that sits under a word.
export function Underline({ color = COLORS.coral, size = 60, opacity = 1, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: 10 }, style]}>
      <Svg width={size} height={10} viewBox="0 0 60 10">
        <Path
          d="M1 6 Q 12 1, 22 5 T 45 5 T 59 6"
          stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={opacity}
        />
      </Svg>
    </View>
  );
}
