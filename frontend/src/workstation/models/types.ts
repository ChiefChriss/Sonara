export interface MidiNote {
  id: number;
  pitch: number;     // MIDI note number (0-127), e.g. 60 = C4
  startBeat: number; // Position within the clip (relative to clip start)
  duration: number;  // Length in beats
  velocity: number;  // 0-127
}

export interface Clip {
  id: number;
  name: string;
  startBeat: number;
  duration: number;
  // For instrument/drum tracks
  notes: MidiNote[];
  // For audio tracks
  audioFileUrl?: string;
  audioBuffer?: ArrayBuffer;
  waveformPeaks?: number[];    // normalized 0-1 peaks for drawing
  audioOffset?: number;         // beats trimmed from start of audio file
  audioDurationBeats?: number;  // total duration of the original audio in beats
}

export type InstrumentPreset = 'triangle' | 'sawtooth' | 'square' | 'sine' | 'fm' | 'am' | 'fat' | 'membrane' | 'metal' | 'pluck';

export interface TrackEffects {
  reverbMix: number;      // 0-100 (dry/wet)
  reverbDecay: number;    // 0.1-10 seconds
  delayMix: number;       // 0-100
  delayTime: number;      // 0.01-1 seconds
  delayFeedback: number;  // 0-90 percent
  filterFreq: number;     // 20-20000 Hz
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  filterEnabled: boolean;
}

export const DEFAULT_EFFECTS: TrackEffects = {
  reverbMix: 0,
  reverbDecay: 2,
  delayMix: 0,
  delayTime: 0.25,
  delayFeedback: 30,
  filterFreq: 20000,
  filterType: 'lowpass',
  filterEnabled: false,
};

export interface AutomationPoint {
  beat: number;   // absolute beat position
  value: number;  // 0-100
}

export interface Track {
  id: number;
  name: string;
  type: 'audio' | 'instrument' | 'drums';
  instrument: InstrumentPreset;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  clips: Clip[];
  effects: TrackEffects;
  volumeAutomation: AutomationPoint[];
}