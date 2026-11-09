'use client';

import { useId, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type ColorKey = `color${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17}`;
export type Colors = Record<ColorKey, string>;

const svgOrder = ['svg1', 'svg2', 'svg3', 'svg4', 'svg3', 'svg2', 'svg1'] as const;
type SvgKey = (typeof svgOrder)[number];
type Stop = { offset: number; stopColor: string };
type SvgState = { gradientTransform: string; stops: Stop[] };
type SvgStates = Record<SvgKey, SvgState>;

function createStates(colors: Colors): SvgStates {
  return {
    svg1: {
      gradientTransform: 'translate(287.5 280) rotate(-29.0546) scale(689.807 1000)',
      stops: [
        { offset: 0, stopColor: colors.color1 },
        { offset: 0.188423, stopColor: colors.color2 },
        { offset: 0.260417, stopColor: colors.color3 },
        { offset: 0.328792, stopColor: colors.color4 },
        { offset: 0.328892, stopColor: colors.color5 },
        { offset: 0.328992, stopColor: colors.color1 },
        { offset: 0.442708, stopColor: colors.color6 },
        { offset: 0.537556, stopColor: colors.color7 },
        { offset: 0.631738, stopColor: colors.color1 },
        { offset: 0.725645, stopColor: colors.color8 },
        { offset: 0.817779, stopColor: colors.color9 },
        { offset: 0.84375, stopColor: colors.color10 },
        { offset: 0.90569, stopColor: colors.color1 },
        { offset: 1, stopColor: colors.color11 },
      ],
    },
    svg2: {
      gradientTransform: 'translate(126.5 418.5) rotate(-64.756) scale(533.444 773.324)',
      stops: [
        { offset: 0, stopColor: colors.color1 },
        { offset: 0.104167, stopColor: colors.color12 },
        { offset: 0.182292, stopColor: colors.color13 },
        { offset: 0.28125, stopColor: colors.color1 },
        { offset: 0.328792, stopColor: colors.color4 },
        { offset: 0.328892, stopColor: colors.color5 },
        { offset: 0.453125, stopColor: colors.color6 },
        { offset: 0.515625, stopColor: colors.color7 },
        { offset: 0.631738, stopColor: colors.color1 },
        { offset: 0.692708, stopColor: colors.color8 },
        { offset: 0.75, stopColor: colors.color14 },
        { offset: 0.817708, stopColor: colors.color9 },
        { offset: 0.869792, stopColor: colors.color10 },
        { offset: 1, stopColor: colors.color1 },
      ],
    },
    svg3: {
      gradientTransform: 'translate(264.5 339.5) rotate(-42.3022) scale(946.451 1372.05)',
      stops: [
        { offset: 0, stopColor: colors.color1 },
        { offset: 0.188423, stopColor: colors.color2 },
        { offset: 0.307292, stopColor: colors.color1 },
        { offset: 0.328792, stopColor: colors.color4 },
        { offset: 0.328892, stopColor: colors.color5 },
        { offset: 0.442708, stopColor: colors.color15 },
        { offset: 0.537556, stopColor: colors.color16 },
        { offset: 0.631738, stopColor: colors.color1 },
        { offset: 0.725645, stopColor: colors.color17 },
        { offset: 0.817779, stopColor: colors.color9 },
        { offset: 0.84375, stopColor: colors.color10 },
        { offset: 0.90569, stopColor: colors.color1 },
        { offset: 1, stopColor: colors.color11 },
      ],
    },
    svg4: {
      gradientTransform: 'translate(860.5 420) rotate(-153.984) scale(957.528 1388.11)',
      stops: [
        { offset: 0.109375, stopColor: colors.color11 },
        { offset: 0.171875, stopColor: colors.color2 },
        { offset: 0.260417, stopColor: colors.color13 },
        { offset: 0.328792, stopColor: colors.color4 },
        { offset: 0.328892, stopColor: colors.color5 },
        { offset: 0.328992, stopColor: colors.color1 },
        { offset: 0.442708, stopColor: colors.color6 },
        { offset: 0.515625, stopColor: colors.color7 },
        { offset: 0.631738, stopColor: colors.color1 },
        { offset: 0.692708, stopColor: colors.color8 },
        { offset: 0.817708, stopColor: colors.color9 },
        { offset: 0.869792, stopColor: colors.color10 },
        { offset: 1, stopColor: colors.color11 },
      ],
    },
  };
}

function GradientSvg({ colors, active }: { colors: Colors; active: boolean }) {
  const id = `github-liquid-${useId().replace(/:/g, '')}`;
  const { states, stops, transforms } = useMemo(() => {
    const states = createStates(colors);
    const maximum = Math.max(...Object.values(states).map(state => state.stops.length));
    const stops = Array.from({ length: maximum }, (_, index) => svgOrder.map(key => {
      const state = states[key];
      return state.stops[index] ?? state.stops[state.stops.length - 1];
    }));
    return { states, stops, transforms: svgOrder.map(key => states[key].gradientTransform) };
  }, [colors]);
  const transition = active ? { duration: 16, repeat: Infinity, ease: 'linear' as const } : { duration: 0 };

  return <svg className="github-liquid-svg" viewBox="0 0 1030 280" fill="none" aria-hidden="true" focusable="false">
    <rect width="1030" height="280" rx="140" fill={`url(#${id})`}/>
    <defs><motion.radialGradient id={id} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" initial={false} animate={{ gradientTransform: active ? transforms : states.svg1.gradientTransform }} transition={transition}>
      {stops.map((configurations, index) => <motion.stop key={index} initial={false} animate={{
        offset: active ? configurations.map(stop => stop.offset) : configurations[0].offset,
        stopColor: active ? configurations.map(stop => stop.stopColor) : configurations[0].stopColor,
      }} transition={transition}/>)}
    </motion.radialGradient></defs>
  </svg>;
}

/** Supplied seven-layer liquid artwork, sized relative to its button instead of fixed pixels. */
export function Liquid({ isHovered, colors }: { isHovered: boolean; colors: Colors }) {
  const reducedMotion = useReducedMotion();
  return <span className="github-liquid" aria-hidden="true">
    {Array.from({ length: 7 }, (_, index) => <span className={`github-liquid-layer github-liquid-layer-${index}`} key={index}>
      <GradientSvg colors={colors} active={isHovered && !reducedMotion}/>
    </span>)}
  </span>;
}
