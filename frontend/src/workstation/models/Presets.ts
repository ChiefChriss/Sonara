// Instrument preset definitions organized by category
// Sampled instruments use Tone.Sampler loaded from CDN on-demand
// Synth presets use Tone.js built-in synthesis

export type PresetType = 'sampler' | 'synth';

export interface InstrumentPresetDef {
  id: string;
  name: string;
  category: string;
  type: PresetType;
  // For samplers: URLs and base URL for Tone.Sampler
  samplerConfig?: {
    urls: Record<string, string>;
    baseUrl: string;
    release?: number;
  };
  // For synths: synthesis config
  synthConfig?: {
    synthType: string; // 'Synth' | 'FMSynth' | 'AMSynth' | 'MembraneSynth' | 'MetalSynth'
    options: Record<string, any>;
  };
}

// ─── Categories ───

export const CATEGORIES = [
  'Keys',
  'Strings',
  'Brass',
  'Woodwinds',
  'Guitar',
  'Bass',
  'Percussion',
  'Synth Lead',
  'Synth Pad',
  'Synth Bass',
  'Synth Pluck',
  'FX & Other',
];

// ─── Sample URL helpers ───
// tonejs-instruments: https://nbrosowsky.github.io/tonejs-instruments/samples/{instrument}/
// Salamander piano: https://tonejs.github.io/audio/salamander/

const TONEJS_INSTRUMENTS_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';

// Salamander piano — fewer samples for faster loading
// Tone.Sampler pitch-shifts between these, sounds good up to ~3 semitones
const PIANO_URLS: Record<string, string> = {
  'A1': 'A1.mp3', 'A2': 'A2.mp3',
  'A3': 'A3.mp3', 'A4': 'A4.mp3',
  'A5': 'A5.mp3', 'A6': 'A6.mp3',
  'C1': 'C1.mp3', 'C2': 'C2.mp3',
  'C3': 'C3.mp3', 'C4': 'C4.mp3',
  'C5': 'C5.mp3', 'C6': 'C6.mp3',
  'C7': 'C7.mp3',
};

// tonejs-instruments use natural note names: A3.mp3, C4.mp3, E2.mp3 etc.
// Not all notes exist for all instruments — our per-sample loader skips 404s gracefully.
// Cast a wide net so at least some notes load; Tone.Sampler pitch-shifts between them.
function wideUrls(notes: string[]): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const n of notes) {
    urls[n] = n + '.mp3';
  }
  return urls;
}

// Natural notes across a wide range — good coverage, 404s are handled gracefully
const WIDE_RANGE = ['A1', 'C2', 'E2', 'A2', 'C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'];
const LOW_RANGE = ['E1', 'A1', 'C2', 'E2', 'A2', 'C3', 'E3'];
const HIGH_RANGE = ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6', 'E6'];

// ─── Presets ───

export const PRESETS: InstrumentPresetDef[] = [
  // ─── Keys ───
  {
    id: 'salamander-piano', name: 'Grand Piano', category: 'Keys', type: 'sampler',
    samplerConfig: { urls: PIANO_URLS, baseUrl: SALAMANDER_BASE, release: 4 },
  },
  {
    id: 'organ', name: 'Organ', category: 'Keys', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'organ/', release: 1 },
  },
  {
    id: 'harmonium', name: 'Harmonium', category: 'Keys', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'harmonium/', release: 1 },
  },

  // ─── Strings ───
  {
    id: 'violin', name: 'Violin', category: 'Strings', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'violin/', release: 1 },
  },
  {
    id: 'cello', name: 'Cello', category: 'Strings', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'cello/', release: 1 },
  },
  {
    id: 'contrabass', name: 'Contrabass', category: 'Strings', type: 'sampler',
    samplerConfig: { urls: wideUrls(LOW_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'contrabass/', release: 1 },
  },
  {
    id: 'harp', name: 'Harp', category: 'Strings', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'harp/', release: 2 },
  },

  // ─── Brass ───
  {
    id: 'trumpet', name: 'Trumpet', category: 'Brass', type: 'sampler',
    samplerConfig: { urls: wideUrls(HIGH_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'trumpet/', release: 0.5 },
  },
  {
    id: 'trombone', name: 'Trombone', category: 'Brass', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'trombone/', release: 0.5 },
  },
  {
    id: 'french-horn', name: 'French Horn', category: 'Brass', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'french-horn/', release: 0.8 },
  },
  {
    id: 'tuba', name: 'Tuba', category: 'Brass', type: 'sampler',
    samplerConfig: { urls: wideUrls(LOW_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'tuba/', release: 0.5 },
  },

  // ─── Woodwinds ───
  {
    id: 'flute', name: 'Flute', category: 'Woodwinds', type: 'sampler',
    samplerConfig: { urls: wideUrls(HIGH_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'flute/', release: 0.5 },
  },
  {
    id: 'clarinet', name: 'Clarinet', category: 'Woodwinds', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'clarinet/', release: 0.3 },
  },
  {
    id: 'bassoon', name: 'Bassoon', category: 'Woodwinds', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'bassoon/', release: 0.5 },
  },
  {
    id: 'saxophone', name: 'Saxophone', category: 'Woodwinds', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'saxophone/', release: 0.3 },
  },

  // ─── Guitar ───
  {
    id: 'guitar-acoustic', name: 'Acoustic Guitar', category: 'Guitar', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'guitar-acoustic/', release: 1 },
  },
  {
    id: 'guitar-electric', name: 'Electric Guitar', category: 'Guitar', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'guitar-electric/', release: 1 },
  },
  {
    id: 'guitar-nylon', name: 'Nylon Guitar', category: 'Guitar', type: 'sampler',
    samplerConfig: { urls: wideUrls(WIDE_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'guitar-nylon/', release: 1 },
  },

  // ─── Bass ───
  {
    id: 'bass-electric', name: 'Electric Bass', category: 'Bass', type: 'sampler',
    samplerConfig: { urls: wideUrls(LOW_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'bass-electric/', release: 0.5 },
  },

  // ─── Percussion ───
  {
    id: 'xylophone', name: 'Xylophone', category: 'Percussion', type: 'sampler',
    samplerConfig: { urls: wideUrls(HIGH_RANGE), baseUrl: TONEJS_INSTRUMENTS_BASE + 'xylophone/', release: 1 },
  },
  {
    id: 'membrane', name: 'Kick Drum', category: 'Percussion', type: 'synth',
    synthConfig: { synthType: 'MembraneSynth', options: { envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } } },
  },
  {
    id: 'metal', name: 'Hi-Hat / Cymbal', category: 'Percussion', type: 'synth',
    synthConfig: { synthType: 'MetalSynth', options: { envelope: { attack: 0.001, decay: 0.4, release: 0.2 } } },
  },

  // ─── Synth Lead ───
  {
    id: 'saw-lead', name: 'Saw Lead', category: 'Synth Lead', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
    }},
  },
  {
    id: 'square-lead', name: 'Square Lead', category: 'Synth Lead', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.3 },
    }},
  },
  {
    id: 'fm-lead', name: 'FM Bell Lead', category: 'Synth Lead', type: 'synth',
    synthConfig: { synthType: 'FMSynth', options: {
      modulationIndex: 6,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
      modulation: { type: 'square' },
    }},
  },
  {
    id: 'fat-lead', name: 'Fat Unison', category: 'Synth Lead', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 30, count: 3 },
      envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.5 },
    }},
  },
  {
    id: 'pwm-lead', name: 'PWM Lead', category: 'Synth Lead', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'pwm', modulationFrequency: 0.5 },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.4 },
    }},
  },

  // ─── Synth Pad ───
  {
    id: 'warm-pad', name: 'Warm Pad', category: 'Synth Pad', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 40, count: 3 },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 2 },
    }},
  },
  {
    id: 'string-pad', name: 'String Pad', category: 'Synth Pad', type: 'synth',
    synthConfig: { synthType: 'FMSynth', options: {
      modulationIndex: 2,
      envelope: { attack: 0.8, decay: 0.4, sustain: 0.9, release: 2.5 },
      modulation: { type: 'sine' },
    }},
  },
  {
    id: 'glass-pad', name: 'Glass Pad', category: 'Synth Pad', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.5, sustain: 0.7, release: 3 },
    }},
  },
  {
    id: 'am-pad', name: 'AM Shimmer', category: 'Synth Pad', type: 'synth',
    synthConfig: { synthType: 'AMSynth', options: {
      envelope: { attack: 0.6, decay: 0.3, sustain: 0.8, release: 2 },
    }},
  },

  // ─── Synth Bass ───
  {
    id: 'sub-bass', name: 'Sub Bass', category: 'Synth Bass', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.2 },
    }},
  },
  {
    id: 'saw-bass', name: 'Saw Bass', category: 'Synth Bass', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.2 },
    }},
  },
  {
    id: 'fm-bass', name: 'FM Bass', category: 'Synth Bass', type: 'synth',
    synthConfig: { synthType: 'FMSynth', options: {
      modulationIndex: 8,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
      modulation: { type: 'square' },
    }},
  },
  {
    id: 'reese-bass', name: 'Reese Bass', category: 'Synth Bass', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'fatsawtooth', spread: 20, count: 2 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
    }},
  },

  // ─── Synth Pluck ───
  {
    id: 'pluck', name: 'Pluck', category: 'Synth Pluck', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
    }},
  },
  {
    id: 'fm-pluck', name: 'FM Pluck', category: 'Synth Pluck', type: 'synth',
    synthConfig: { synthType: 'FMSynth', options: {
      modulationIndex: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
      modulation: { type: 'sine' },
    }},
  },
  {
    id: 'kalimba', name: 'Kalimba', category: 'Synth Pluck', type: 'synth',
    synthConfig: { synthType: 'FMSynth', options: {
      modulationIndex: 3.5,
      envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.3 },
      modulation: { type: 'sine' },
      harmonicity: 8,
    }},
  },

  // ─── FX & Other ───
  {
    id: 'sine', name: 'Pure Sine', category: 'FX & Other', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.8 },
    }},
  },
  {
    id: 'triangle', name: 'Triangle Wave', category: 'FX & Other', type: 'synth',
    synthConfig: { synthType: 'Synth', options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
    }},
  },
];

// ─── Helpers ───

export function getPreset(id: string): InstrumentPresetDef | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function getPresetsByCategory(): Map<string, InstrumentPresetDef[]> {
  const map = new Map<string, InstrumentPresetDef[]>();
  for (const cat of CATEGORIES) {
    const presets = PRESETS.filter((p) => p.category === cat);
    if (presets.length > 0) map.set(cat, presets);
  }
  return map;
}

// Default preset for new instrument tracks
export const DEFAULT_PRESET_ID = 'triangle';
// Default preset for drum tracks
export const DEFAULT_DRUM_PRESET_ID = 'membrane';