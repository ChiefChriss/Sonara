import React from 'react';

// All icons are 14x14 stroke/fill based, monochrome, accepting a color prop.
// Usage: <Icons.Piano color="#999" /> or <Icons.Piano /> (defaults to currentColor)

type P = { color?: string; size?: number };
const d = (size?: number) => ({ width: size || 14, height: size || 14, display: 'block' as const });

// ─── Instruments / Track Types ───

export const Piano = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="2" width="12" height="10" rx="1" stroke={color} strokeWidth="1.2" />
    <line x1="4" y1="2" x2="4" y2="12" stroke={color} strokeWidth="0.75" />
    <line x1="7" y1="2" x2="7" y2="12" stroke={color} strokeWidth="0.75" />
    <line x1="10" y1="2" x2="10" y2="12" stroke={color} strokeWidth="0.75" />
    <rect x="3" y="2" width="1.5" height="5.5" rx="0.3" fill={color} />
    <rect x="5.5" y="2" width="1.5" height="5.5" rx="0.3" fill={color} />
    <rect x="9" y="2" width="1.5" height="5.5" rx="0.3" fill={color} />
  </svg>
);

export const Microphone = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="4.5" y="1" width="5" height="7.5" rx="2.5" stroke={color} strokeWidth="1.2" />
    <path d="M3 7.5 Q3 11, 7 11 Q11 11, 11 7.5" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <line x1="7" y1="11" x2="7" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="13" x2="9" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const Drums = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <ellipse cx="7" cy="4.5" rx="5.5" ry="2" stroke={color} strokeWidth="1.2" />
    <line x1="1.5" y1="4.5" x2="1.5" y2="10" stroke={color} strokeWidth="1.2" />
    <line x1="12.5" y1="4.5" x2="12.5" y2="10" stroke={color} strokeWidth="1.2" />
    <ellipse cx="7" cy="10" rx="5.5" ry="2" stroke={color} strokeWidth="1.2" />
    <line x1="3" y1="1" x2="6" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="11" y1="1" x2="8" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="3" cy="1" r="0.8" fill={color} />
    <circle cx="11" cy="1" r="0.8" fill={color} />
  </svg>
);

export const Note = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <ellipse cx="4.5" cy="11" rx="2.5" ry="1.8" fill={color} />
    <line x1="7" y1="2" x2="7" y2="11" stroke={color} strokeWidth="1.2" />
    <path d="M7 2 Q10 2, 11 4 Q10 5.5, 7 5" fill={color} opacity="0.7" />
  </svg>
);

export const Bolt = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M8 1 L3 7.5 H6.5 L5.5 13 L11 6 H7.5 Z" fill={color} />
  </svg>
);

// ─── Transport & Recording ───

export const Record = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <circle cx="7" cy="7" r="5" fill={color} />
  </svg>
);

// ─── Piano Roll Tabs ───

export const MidiGrid = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="3" width="5" height="2" rx="0.5" fill={color} />
    <rect x="4" y="6" width="4" height="2" rx="0.5" fill={color} opacity="0.7" />
    <rect x="7" y="9" width="6" height="2" rx="0.5" fill={color} opacity="0.5" />
    <line x1="1" y1="1" x2="1" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
    <line x1="5" y1="1" x2="5" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
    <line x1="9" y1="1" x2="9" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
    <line x1="13" y1="1" x2="13" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
  </svg>
);

export const Knobs = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <circle cx="4" cy="5" r="2.8" stroke={color} strokeWidth="1.2" />
    <line x1="4" y1="5" x2="4" y2="2.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="10" cy="9" r="2.8" stroke={color} strokeWidth="1.2" />
    <line x1="10" y1="9" x2="11.5" y2="7.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// ─── Velocity ───

export const Vel = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="8" width="2.5" height="5" rx="0.5" fill={color} opacity="0.5" />
    <rect x="4.5" y="5" width="2.5" height="8" rx="0.5" fill={color} opacity="0.7" />
    <rect x="8" y="2" width="2.5" height="11" rx="0.5" fill={color} opacity="0.85" />
    <rect x="11.5" y="0.5" width="2" height="12.5" rx="0.5" fill={color} />
  </svg>
);

export const VelEdit = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M1 10 L4.5 3 L8 8 L11 2 L13 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="4.5" cy="3" r="1.5" fill={color} />
    <circle cx="8" cy="8" r="1.5" fill={color} />
    <circle cx="11" cy="2" r="1.5" fill={color} />
  </svg>
);

// ─── Humanize & Quantize ───

export const Humanize = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M1 7 Q3.5 3, 5 7 Q6.5 11, 8 7 Q9.5 4, 11 7 L13 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <line x1="3" y1="1" x2="4" y2="3.5" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="9" y1="1.5" x2="10" y2="4" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="6" y1="11" x2="7" y2="13" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </svg>
);

export const Quantize = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <line x1="3.5" y1="0.5" x2="3.5" y2="13.5" stroke={color} strokeWidth="0.75" opacity="0.3" />
    <line x1="7" y1="0.5" x2="7" y2="13.5" stroke={color} strokeWidth="0.75" opacity="0.3" />
    <line x1="10.5" y1="0.5" x2="10.5" y2="13.5" stroke={color} strokeWidth="0.75" opacity="0.3" />
    <path d="M1.5 4 L3.5 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5.5 7 L3.5 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 10 L10.5 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="3.5" cy="4" r="1.2" fill={color} />
    <circle cx="3.5" cy="7" r="1.2" fill={color} />
    <circle cx="10.5" cy="10" r="1.2" fill={color} />
  </svg>
);

// ─── Track Actions ───

export const Pencil = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M2 12 L1.5 12.5 L2.5 9.5 L10 2 L12 4 L4.5 11.5 Z" stroke={color} strokeWidth="1" fill="none" />
    <line x1="9" y1="3" x2="11" y2="5" stroke={color} strokeWidth="1" />
  </svg>
);

export const Duplicate = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="3" width="8" height="10" rx="1" stroke={color} strokeWidth="1.2" />
    <path d="M5 3 V1.5 A0.5 0.5 0 0 1 5.5 1 H12.5 A0.5 0.5 0 0 1 13 1.5 V10.5 A0.5 0.5 0 0 1 12.5 11 H10" stroke={color} strokeWidth="1.2" />
  </svg>
);

export const Palette = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M7 1 C3 1, 1 4, 1 7 C1 10, 3 13, 7 13 C8 13, 8.5 12.5, 8.5 12 C8.5 11.5, 8 11.3, 8 10.8 C8 10, 9 9.5, 10 9.5 H11 C12.5 9.5, 13 8.5, 13 7 C13 3.5, 10 1, 7 1Z" stroke={color} strokeWidth="1.2" fill="none" />
    <circle cx="4.5" cy="5.5" r="1" fill={color} />
    <circle cx="7" cy="4" r="1" fill={color} />
    <circle cx="9.5" cy="5.5" r="1" fill={color} />
    <circle cx="4.5" cy="8.5" r="1" fill={color} />
  </svg>
);

export const Trash = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M2.5 4 L3.2 12.5 A1 1 0 0 0 4.2 13.5 H9.8 A1 1 0 0 0 10.8 12.5 L11.5 4" stroke={color} strokeWidth="1.2" />
    <line x1="1" y1="4" x2="13" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5 4 V2.5 A0.5 0.5 0 0 1 5.5 2 H8.5 A0.5 0.5 0 0 1 9 2.5 V4" stroke={color} strokeWidth="1.2" />
    <line x1="5.5" y1="6" x2="5.5" y2="11.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <line x1="8.5" y1="6" x2="8.5" y2="11.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </svg>
);

export const Plus = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <line x1="7" y1="2" x2="7" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="7" x2="12" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── History Panel ───

export const Reorder = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M7 2 L4.5 4.5 H9.5 Z" fill={color} />
    <path d="M7 12 L4.5 9.5 H9.5 Z" fill={color} />
    <line x1="7" y1="4" x2="7" y2="10" stroke={color} strokeWidth="1.2" />
  </svg>
);

export const Mute = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M2 5 H4 L7.5 2 V12 L4 9 H2 Z" fill={color} />
    <line x1="9.5" y1="4.5" x2="13" y2="9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="13" y1="4.5" x2="9.5" y2="9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const Solo = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M2 5 H4 L7.5 2 V12 L4 9 H2 Z" fill={color} />
    <path d="M10 5 Q13 7, 10 9" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <path d="M11 3 Q15 7, 11 11" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

export const Volume = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M2 5 H4 L7.5 2 V12 L4 9 H2 Z" fill={color} />
    <path d="M10 5 Q12.5 7, 10 9" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

export const Pan = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <line x1="1" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M1 7 L3.5 5 V9 Z" fill={color} />
    <path d="M13 7 L10.5 5 V9 Z" fill={color} />
  </svg>
);

export const Clip = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="3" width="12" height="8" rx="1.5" stroke={color} strokeWidth="1.2" />
    <rect x="3" y="5" width="3" height="1.5" rx="0.5" fill={color} opacity="0.7" />
    <rect x="5" y="7.5" width="4" height="1.5" rx="0.5" fill={color} opacity="0.5" />
    <rect x="8" y="5" width="2" height="1.5" rx="0.5" fill={color} opacity="0.6" />
  </svg>
);

export const Scissors = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <circle cx="3.5" cy="3.5" r="2" stroke={color} strokeWidth="1.2" />
    <circle cx="3.5" cy="10.5" r="2" stroke={color} strokeWidth="1.2" />
    <line x1="5" y1="4.5" x2="12" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="9.5" x2="12" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const Automation = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <polyline points="1,10 4,4 7,7 10,2 13,5" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="4" cy="4" r="1" fill={color} />
    <circle cx="10" cy="2" r="1" fill={color} />
  </svg>
);

export const Clock = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
    <line x1="7" y1="4" x2="7" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="7" y1="7" x2="9.5" y2="8.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const Wrench = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M8.5 1.5 Q12 1.5, 12.5 5 L9.5 5 L8.5 6.5 L9.5 8 L12.5 8 Q12 11.5, 8.5 11.5 Q5 11.5, 3.5 8 L1.5 10 L1 9.5 L3 7.5 Q1.5 5, 3.5 3 L1.5 1 L2 0.5 L4 2.5 Q5.5 1.5, 8.5 1.5Z" stroke={color} strokeWidth="1" fill="none" />
  </svg>
);

export const Doc = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M3 1 H9 L11 3 V13 H3 Z" stroke={color} strokeWidth="1.2" />
    <line x1="5" y1="6" x2="9" y2="6" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
    <line x1="5" y1="8" x2="9" y2="8" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
    <line x1="5" y1="10" x2="8" y2="10" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

export const Filter = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M1 7 Q3 2, 7 7 Q11 12, 13 7" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <line x1="7" y1="3" x2="7" y2="11" stroke={color} strokeWidth="0.75" opacity="0.4" strokeDasharray="1 1" />
  </svg>
);

export const Reverb = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M1 7 Q2 4, 3.5 7 Q5 10, 6.5 7" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M5 7 Q6.5 4.5, 8 7 Q9.5 9.5, 11 7" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.55" />
    <path d="M9 7 Q10 5.5, 11 7 Q12 8.5, 13 7" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.3" />
  </svg>
);

export const Delay = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <rect x="1" y="4" width="3" height="7" rx="0.5" fill={color} />
    <rect x="5.5" y="6" width="3" height="5" rx="0.5" fill={color} opacity="0.6" />
    <rect x="10" y="8" width="3" height="3" rx="0.5" fill={color} opacity="0.3" />
  </svg>
);

export const Loop = ({ color = 'currentColor', size }: P) => (
  <svg viewBox="0 0 14 14" fill="none" style={d(size)}>
    <path d="M10 3 H4.5 A2.5 2.5 0 0 0 2 5.5 V6" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M4 11 H9.5 A2.5 2.5 0 0 0 12 8.5 V8" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M8.5 1 L10.5 3 L8.5 5" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 9 L3.5 11 L5.5 13" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);