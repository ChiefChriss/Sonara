import { create } from 'zustand';
import { Track, Clip, MidiNote, InstrumentPreset, TrackEffects, DEFAULT_EFFECTS, AutomationPoint } from '../models/types';

const TRACK_COLORS = ['#e74c3c', '#9b59b6', '#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#1abc9c'];

const DEFAULT_TRACKS: Track[] = [
  {
    id: 1, name: 'Main Vocals', type: 'audio', instrument: 'triangle',
    color: '#e74c3c', muted: false, solo: false, volume: 80, pan: 0,
    clips: [{ id: 1, name: 'Vocal Take 1', startBeat: 0, duration: 16, notes: [] }],
    effects: { ...DEFAULT_EFFECTS }, volumeAutomation: [],
  },
  {
    id: 2, name: 'Keys', type: 'instrument', instrument: 'triangle',
    color: '#9b59b6', muted: false, solo: false, volume: 75, pan: -20,
    clips: [
      {
        id: 2, name: 'Chord Progression', startBeat: 4, duration: 8, notes: [
          { id: 201, pitch: 60, startBeat: 0, duration: 2, velocity: 80 },
          { id: 202, pitch: 64, startBeat: 0, duration: 2, velocity: 75 },
          { id: 203, pitch: 67, startBeat: 0, duration: 2, velocity: 75 },
          { id: 204, pitch: 62, startBeat: 2, duration: 2, velocity: 80 },
          { id: 205, pitch: 65, startBeat: 2, duration: 2, velocity: 75 },
          { id: 206, pitch: 69, startBeat: 2, duration: 2, velocity: 75 },
          { id: 207, pitch: 64, startBeat: 4, duration: 2, velocity: 80 },
          { id: 208, pitch: 67, startBeat: 4, duration: 2, velocity: 75 },
          { id: 209, pitch: 71, startBeat: 4, duration: 2, velocity: 75 },
          { id: 210, pitch: 60, startBeat: 6, duration: 2, velocity: 80 },
          { id: 211, pitch: 64, startBeat: 6, duration: 2, velocity: 75 },
          { id: 212, pitch: 67, startBeat: 6, duration: 2, velocity: 75 },
        ]
      },
      {
        id: 3, name: 'Melody', startBeat: 14, duration: 6, notes: [
          { id: 301, pitch: 72, startBeat: 0, duration: 1, velocity: 90 },
          { id: 302, pitch: 74, startBeat: 1, duration: 0.5, velocity: 85 },
          { id: 303, pitch: 76, startBeat: 1.5, duration: 1.5, velocity: 85 },
          { id: 304, pitch: 74, startBeat: 3, duration: 1, velocity: 80 },
          { id: 305, pitch: 72, startBeat: 4, duration: 2, velocity: 90 },
        ]
      },
    ],
  },
  {
    id: 3, name: 'Synth Line', type: 'instrument', instrument: 'saw-lead',
    color: '#f1c40f', muted: false, solo: false, volume: 70, pan: 30,
    clips: [{
      id: 4, name: 'Synth Line', startBeat: 8, duration: 12, notes: [
        { id: 401, pitch: 48, startBeat: 0, duration: 3, velocity: 90 },
        { id: 402, pitch: 48, startBeat: 4, duration: 2, velocity: 85 },
        { id: 403, pitch: 50, startBeat: 7, duration: 3, velocity: 85 },
        { id: 404, pitch: 48, startBeat: 10, duration: 2, velocity: 90 },
      ]
    }],
    effects: { ...DEFAULT_EFFECTS }, volumeAutomation: [],
  },
  {
    id: 4, name: 'Drums', type: 'drums', instrument: 'membrane',
    color: '#3498db', muted: false, solo: false, volume: 85, pan: 0,
    clips: [{
      id: 5, name: 'Beat', startBeat: 12, duration: 10, notes: [
        { id: 501, pitch: 36, startBeat: 0, duration: 0.5, velocity: 100 },
        { id: 502, pitch: 38, startBeat: 1, duration: 0.5, velocity: 90 },
        { id: 503, pitch: 36, startBeat: 2, duration: 0.5, velocity: 100 },
        { id: 504, pitch: 38, startBeat: 3, duration: 0.5, velocity: 90 },
        { id: 505, pitch: 42, startBeat: 0, duration: 0.25, velocity: 70 },
        { id: 506, pitch: 42, startBeat: 0.5, duration: 0.25, velocity: 60 },
        { id: 507, pitch: 42, startBeat: 1, duration: 0.25, velocity: 70 },
        { id: 508, pitch: 42, startBeat: 1.5, duration: 0.25, velocity: 60 },
        { id: 509, pitch: 42, startBeat: 2, duration: 0.25, velocity: 70 },
        { id: 510, pitch: 42, startBeat: 2.5, duration: 0.25, velocity: 60 },
        { id: 511, pitch: 42, startBeat: 3, duration: 0.25, velocity: 70 },
        { id: 512, pitch: 42, startBeat: 3.5, duration: 0.25, velocity: 60 },
        { id: 513, pitch: 36, startBeat: 4, duration: 0.5, velocity: 100 },
        { id: 514, pitch: 36, startBeat: 4.5, duration: 0.5, velocity: 80 },
        { id: 515, pitch: 38, startBeat: 5, duration: 0.5, velocity: 90 },
        { id: 516, pitch: 36, startBeat: 6, duration: 0.5, velocity: 100 },
        { id: 517, pitch: 38, startBeat: 7, duration: 0.5, velocity: 90 },
        { id: 518, pitch: 36, startBeat: 8, duration: 1, velocity: 100 },
      ]
    }],
    effects: { ...DEFAULT_EFFECTS }, volumeAutomation: [],
  },
];

// ─── Undo/Redo History ───

const MAX_HISTORY = 100;
interface HistoryEntry { tracks: Track[]; label: string }
let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
const cloneTracks = (tracks: Track[]): Track[] => JSON.parse(JSON.stringify(tracks));
const pushUndo = (tracks: Track[], label: string) => {
  undoStack.push({ tracks: cloneTracks(tracks), label });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
};

// ─── Store Interface ───

interface DawStore {
  projectName: string;
  setProjectName: (name: string) => void;
  serverProjectId: number | null;
  setServerProjectId: (id: number | null) => void;
  lastSavedAt: string | null;

  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  musicalKey: string;
  togglePlay: () => void;
  toggleRecord: () => void;
  setCurrentTime: (time: number) => void;
  setBpm: (bpm: number) => void;
  setMusicalKey: (key: string) => void;
  rewind: () => void;
  stop: () => void;

  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  toggleLoop: () => void;
  setLoopRegion: (start: number, end: number) => void;

  tracks: Track[];
  addTrack: (type?: 'audio' | 'instrument') => void;
  deleteTrack: (trackId: number) => void;
  renameTrack: (trackId: number, name: string) => void;
  reorderTrack: (fromIndex: number, toIndex: number) => void;
  duplicateTrack: (trackId: number) => void;
  setTrackColor: (trackId: number, color: string) => void;
  toggleMute: (trackId: number) => void;
  toggleSolo: (trackId: number) => void;
  setTrackVolume: (trackId: number, volume: number) => void;
  setTrackPan: (trackId: number, pan: number) => void;
  showMixer: boolean;
  toggleMixer: () => void;
  setTrackInstrument: (trackId: number, instrument: InstrumentPreset) => void;
  setTrackEffects: (trackId: number, effects: Partial<TrackEffects>) => void;
  pushUndoSnapshot: (label: string) => void;
  setVolumeAutomation: (trackId: number, points: AutomationPoint[]) => void;
  addAutomationPoint: (trackId: number, point: AutomationPoint) => void;
  removeAutomationPoint: (trackId: number, index: number) => void;

  selectedClipId: number | null;
  selectClip: (clipId: number | null) => void;
  addClip: (trackId: number, startBeat: number) => void;
  addAudioClip: (trackId: number, startBeat: number, name: string, durationBeats: number, audioFileUrl: string, waveformPeaks: number[]) => void;
  importMidiClip: (trackId: number, startBeat: number, name: string, notes: { pitch: number; startBeat: number; duration: number; velocity: number }[], durationBeats: number) => void;
  moveClip: (clipId: number, newStartBeat: number, newTrackId?: number) => void;
  resizeClip: (clipId: number, newDuration: number, fromLeft?: boolean) => void;
  deleteClip: (clipId: number) => void;
  renameClip: (clipId: number, name: string) => void;
  snapToBeat: (beat: number) => number;

  pianoRollClipId: number | null;
  pianoRollTrackId: number | null;
  selectedNoteIds: Set<number>;
  openPianoRoll: (clipId: number, trackId: number) => void;
  closePianoRoll: () => void;
  selectNote: (noteId: number | null, addToSelection?: boolean) => void;
  selectNotes: (noteIds: number[]) => void;
  clearNoteSelection: () => void;
  addNote: (clipId: number, note: { pitch: number; startBeat: number; duration: number; velocity: number }) => void;
  moveNote: (clipId: number, noteId: number, newPitch: number, newStartBeat: number) => void;
  moveSelectedNotes: (clipId: number, deltaPitch: number, deltaBeat: number) => void;
  resizeNote: (clipId: number, noteId: number, newDuration: number) => void;
  deleteNote: (clipId: number, noteId: number) => void;
  deleteSelectedNotes: (clipId: number) => void;
  setNoteVelocity: (clipId: number, noteId: number, velocity: number) => void;
  setNotesVelocity: (clipId: number, noteIds: number[], velocity: number) => void;
  humanizeNotes: (clipId: number, noteIds: number[], timingAmount: number, velocityAmount: number) => void;
  quantizeNotes: (clipId: number, noteIds: number[], gridSize: number, strength: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  undoVersion: number;
  // History panel
  showHistoryPanel: boolean;
  toggleHistoryPanel: () => void;
  getHistoryList: () => { labels: string[]; currentIndex: number };
  jumpToHistory: (index: number) => void;

  // Clipboard
  clipboardClip: Clip | null;
  clipboardNotes: MidiNote[] | null;
  copyClip: () => void;
  pasteClip: () => void;
  copyNotes: () => void;
  pasteNotes: () => void;
  duplicateClip: (clipId?: number) => void;

  zoom: number;
  setZoom: (zoom: number) => void;
  snapEnabled: boolean;
  toggleSnap: () => void;
  getProjectData: () => any;
  loadProjectData: (data: any) => void;
}

// Helper: wraps a tracks mutation with undo
const withUndo = (
  set: (fn: (s: DawStore) => Partial<DawStore>) => void,
  label: string,
  fn: (s: DawStore) => Partial<DawStore>
) => {
  set((s) => {
    pushUndo(s.tracks, label);
    return { ...fn(s), canUndo: true, canRedo: false, undoLabel: label, redoLabel: '' };
  });
};

const useDawStore = create<DawStore>((set, get) => ({
  projectName: 'Untitled Project',
  setProjectName: (projectName) => set({ projectName }),
  serverProjectId: null,
  setServerProjectId: (id) => set({ serverProjectId: id }),
  lastSavedAt: null,

  isPlaying: false,
  isRecording: false,
  currentTime: 0,
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: 'C',
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  toggleRecord: () => set((s) => ({ isRecording: !s.isRecording })),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setBpm: (bpm) => set({ bpm }),
  setMusicalKey: (musicalKey) => set({ musicalKey }),
  rewind: () => set({ currentTime: 0 }),
  stop: () => set({ isPlaying: false, currentTime: 0 }),

  // Loop
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,
  toggleLoop: () =>
    set((s) => {
      if (!s.loopEnabled) {
        let start = s.loopStart;
        let end = s.loopEnd;
        if (start === 0 && end === 0) {
          let lastBeat = 0;
          s.tracks.forEach((t) =>
            t.clips.forEach((c) => {
              const clipEnd = c.startBeat + c.duration;
              if (clipEnd > lastBeat) lastBeat = clipEnd;
            })
          );
          end = lastBeat > 0 ? lastBeat : 16;
        }
        return { loopEnabled: true, loopStart: start, loopEnd: end };
      }
      return { loopEnabled: false };
    }),
  setLoopRegion: (start, end) =>
    set({ loopStart: Math.min(start, end), loopEnd: Math.max(start, end) }),

  // Tracks
  tracks: DEFAULT_TRACKS,
  addTrack: (type = 'instrument' as 'audio' | 'instrument') => withUndo(set, 'Add Track', (s) => ({
    tracks: [...s.tracks, {
      id: Date.now(), name: type === 'audio' ? `Audio ${s.tracks.filter(t => t.type === 'audio').length + 1}` : `Track ${s.tracks.length + 1}`,
      type: type as 'audio' | 'instrument',
      instrument: 'triangle' as const,
      color: TRACK_COLORS[s.tracks.length % TRACK_COLORS.length],
      muted: false, solo: false, volume: 75, pan: 0, clips: [],
      effects: { ...DEFAULT_EFFECTS }, volumeAutomation: [],
    }],
  })),
  deleteTrack: (trackId) => withUndo(set, 'Delete Track', (s) => {
    const trackToDelete = s.tracks.find((t) => t.id === trackId);
    const clipIds = trackToDelete ? trackToDelete.clips.map((c) => c.id) : [];
    return {
      tracks: s.tracks.filter((t) => t.id !== trackId),
      // Clear selection if it was on this track
      selectedClipId: clipIds.includes(s.selectedClipId as number) ? null : s.selectedClipId,
      // Close piano roll if it was on this track
      pianoRollClipId: s.pianoRollTrackId === trackId ? null : s.pianoRollClipId,
      pianoRollTrackId: s.pianoRollTrackId === trackId ? null : s.pianoRollTrackId,
    };
  }),
  renameTrack: (trackId, name) => withUndo(set, 'Rename Track', (s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, name } : t),
  })),
  reorderTrack: (fromIndex, toIndex) => withUndo(set, 'Reorder Track', (s) => {
    if (fromIndex === toIndex) return {};
    const newTracks = [...s.tracks];
    const [moved] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, moved);
    return { tracks: newTracks };
  }),
  duplicateTrack: (trackId) => withUndo(set, 'Duplicate Track', (s) => {
    const source = s.tracks.find((t) => t.id === trackId);
    if (!source) return {};
    const newId = Date.now();
    const cloned: Track = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (copy)`,
      clips: source.clips.map((c) => ({
        ...JSON.parse(JSON.stringify(c)),
        id: Date.now() + Math.floor(Math.random() * 10000),
      })),
    };
    const idx = s.tracks.findIndex((t) => t.id === trackId);
    const newTracks = [...s.tracks];
    newTracks.splice(idx + 1, 0, cloned);
    return { tracks: newTracks };
  }),
  setTrackColor: (trackId, color) => withUndo(set, 'Change Color', (s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, color } : t),
  })),
  toggleMute: (trackId) => withUndo(set, 'Toggle Mute', (s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t),
  })),
  toggleSolo: (trackId) => withUndo(set, 'Toggle Solo', (s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, solo: !t.solo } : t),
  })),
  setTrackVolume: (trackId, volume) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, volume } : t),
  })),
  setTrackPan: (trackId, pan) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, pan: Math.max(-100, Math.min(100, pan)) } : t),
  })),
  showMixer: false,
  toggleMixer: () => set((s) => ({ showMixer: !s.showMixer })),
  setTrackInstrument: (trackId, instrument) => withUndo(set, 'Change Instrument', (s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, instrument } : t),
  })),
  setTrackEffects: (trackId, effects) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId
      ? { ...t, effects: { ...(t.effects || DEFAULT_EFFECTS), ...effects } }
      : t),
  })),
  setVolumeAutomation: (trackId, points) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? { ...t, volumeAutomation: points } : t),
  })),
  addAutomationPoint: (trackId, point) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? {
      ...t,
      volumeAutomation: [...(t.volumeAutomation || []), point].sort((a, b) => a.beat - b.beat),
    } : t),
  })),
  removeAutomationPoint: (trackId, index) => set((s) => ({
    tracks: s.tracks.map((t) => t.id === trackId ? {
      ...t,
      volumeAutomation: (t.volumeAutomation || []).filter((_, i) => i !== index),
    } : t),
  })),

  // Clips
  selectedClipId: null,
  selectClip: (clipId) => set({ selectedClipId: clipId, selectedNoteIds: new Set() }),
  addClip: (trackId, startBeat) => withUndo(set, 'Add Clip', (s) => {
    // Prevent adding MIDI clips to audio tracks
    const track = s.tracks.find((t) => t.id === trackId);
    if (track?.type === 'audio') return {};
    const snap = s.snapEnabled ? s.snapToBeat(startBeat) : startBeat;
    const newClipId = Date.now() + Math.floor(Math.random() * 1000);
    return {
      tracks: s.tracks.map((t) => t.id === trackId ? {
        ...t,
        clips: [...t.clips, {
          id: newClipId, name: t.type === 'drums' ? 'Beat' : 'New Clip',
          startBeat: Math.max(0, snap), duration: 4, notes: [],
        }],
      } : t),
      selectedClipId: newClipId,
    };
  }),
  addAudioClip: (trackId, startBeat, name, durationBeats, audioFileUrl, waveformPeaks) =>
    withUndo(set, 'Add Audio Clip', (s) => {
      const track = s.tracks.find((t) => t.id === trackId);
      if (track?.type !== 'audio') return {};
      const newClipId = Date.now() + Math.floor(Math.random() * 1000);
      return {
        tracks: s.tracks.map((t) => t.id === trackId ? {
          ...t,
          clips: [...t.clips, {
            id: newClipId, name,
            startBeat: Math.max(0, startBeat), duration: durationBeats,
            notes: [], audioFileUrl, waveformPeaks,
            audioOffset: 0, audioDurationBeats: durationBeats,
          }],
        } : t),
        selectedClipId: newClipId,
      };
    }),
  importMidiClip: (trackId, startBeat, name, notes, durationBeats) =>
    withUndo(set, 'Import MIDI', (s) => {
      const track = s.tracks.find((t) => t.id === trackId);
      if (!track || track.type === 'audio') return {};
      const newClipId = Date.now() + Math.floor(Math.random() * 1000);
      const midiNotes = notes.map((n, i) => ({
        id: newClipId * 1000 + i,
        pitch: n.pitch,
        startBeat: n.startBeat,
        duration: n.duration,
        velocity: n.velocity,
      }));
      return {
        tracks: s.tracks.map((t) => t.id === trackId ? {
          ...t,
          clips: [...t.clips, {
            id: newClipId,
            name,
            startBeat: Math.max(0, startBeat),
            duration: Math.max(1, durationBeats),
            notes: midiNotes,
          }],
        } : t),
        selectedClipId: newClipId,
      };
    }),
  moveClip: (clipId, newStartBeat, newTrackId) => set((s) => {
    const snap = s.snapEnabled ? s.snapToBeat(newStartBeat) : newStartBeat;
    const clampedBeat = Math.max(0, snap);
    if (newTrackId !== undefined) {
      // Find source and target tracks
      const sourceTrack = s.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      const targetTrack = s.tracks.find((t) => t.id === newTrackId);
      // Prevent moving between audio and instrument tracks
      if (sourceTrack && targetTrack) {
        const sourceIsAudio = sourceTrack.type === 'audio';
        const targetIsAudio = targetTrack.type === 'audio';
        if (sourceIsAudio !== targetIsAudio) return {}; // block cross-type move
      }

      let movedClip: typeof s.tracks[0]['clips'][0] | null = null;
      const tracksWithoutClip = s.tracks.map((t) => {
        const clip = t.clips.find((c) => c.id === clipId);
        if (clip) {
          movedClip = { ...clip, startBeat: clampedBeat };
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
        }
        return t;
      });
      if (movedClip) {
        return {
          tracks: tracksWithoutClip.map((t) =>
            t.id === newTrackId ? { ...t, clips: [...t.clips, movedClip!] } : t
          ),
        };
      }
    }
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, startBeat: clampedBeat } : c),
      })),
    };
  }),
  resizeClip: (clipId, newDuration, fromLeft = false) => set((s) => {
    const clampedDuration = Math.max(1, newDuration);
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => {
          if (c.id !== clipId) return c;
          if (fromLeft) {
            const delta = c.duration - clampedDuration;
            const newStart = Math.max(0, c.startBeat + delta);
            const actualDelta = newStart - c.startBeat;
            // For audio clips, track how much of the start is trimmed
            if (c.audioFileUrl && c.audioOffset !== undefined) {
              const newOffset = Math.max(0, (c.audioOffset || 0) + actualDelta);
              return { ...c, startBeat: newStart, duration: clampedDuration, audioOffset: newOffset };
            }
            return { ...c, startBeat: newStart, duration: clampedDuration };
          }
          // Resize from right — for audio clips, don't exceed original audio length
          if (c.audioFileUrl && c.audioDurationBeats) {
            const maxDuration = c.audioDurationBeats - (c.audioOffset || 0);
            return { ...c, duration: Math.min(clampedDuration, maxDuration) };
          }
          return { ...c, duration: clampedDuration };
        }),
      })),
    };
  }),
  deleteClip: (clipId) => withUndo(set, 'Delete Clip', (s) => ({
    selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    pianoRollClipId: s.pianoRollClipId === clipId ? null : s.pianoRollClipId,
    pianoRollTrackId: s.pianoRollClipId === clipId ? null : s.pianoRollTrackId,
    tracks: s.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
  })),
  renameClip: (clipId, name) => withUndo(set, 'Rename Clip', (s) => ({
    tracks: s.tracks.map((t) => ({
      ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, name } : c),
    })),
  })),
  snapToBeat: (beat: number) => Math.round(beat),

  // Piano Roll
  pianoRollClipId: null,
  pianoRollTrackId: null,
  selectedNoteIds: new Set<number>(),
  openPianoRoll: (clipId, trackId) =>
    set({ pianoRollClipId: clipId, pianoRollTrackId: trackId, selectedNoteIds: new Set() }),
  closePianoRoll: () =>
    set({ pianoRollClipId: null, pianoRollTrackId: null, selectedNoteIds: new Set() }),
  selectNote: (noteId, addToSelection = false) => set((s) => {
    if (noteId === null) return { selectedNoteIds: new Set() };
    if (addToSelection) {
      const next = new Set(s.selectedNoteIds);
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId);
      return { selectedNoteIds: next };
    }
    return { selectedNoteIds: new Set([noteId]) };
  }),
  selectNotes: (noteIds) => set({ selectedNoteIds: new Set(noteIds) }),
  clearNoteSelection: () => set({ selectedNoteIds: new Set() }),
  addNote: (clipId, note) => withUndo(set, 'Add Note', (s) => ({
    tracks: s.tracks.map((t) => ({
      ...t, clips: t.clips.map((c) => c.id === clipId ? {
        ...c, notes: [...c.notes, { id: Date.now() + Math.random(), ...note }],
      } : c),
    })),
  })),
  moveNote: (clipId, noteId, newPitch, newStartBeat) => set((s) => {
    const snap = s.snapEnabled ? Math.round(newStartBeat * 4) / 4 : newStartBeat;
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => n.id === noteId
            ? { ...n, pitch: Math.max(0, Math.min(127, Math.round(newPitch))), startBeat: Math.max(0, snap) }
            : n),
        } : c),
      })),
    };
  }),
  moveSelectedNotes: (clipId, deltaPitch, deltaBeat) => set((s) => {
    const snapBeat = s.snapEnabled ? Math.round(deltaBeat * 4) / 4 : deltaBeat;
    const roundedPitch = Math.round(deltaPitch);
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => s.selectedNoteIds.has(n.id) ? {
            ...n,
            pitch: Math.max(0, Math.min(127, n.pitch + roundedPitch)),
            startBeat: Math.max(0, n.startBeat + snapBeat),
          } : n),
        } : c),
      })),
    };
  }),
  resizeNote: (clipId, noteId, newDuration) => set((s) => {
    const snap = s.snapEnabled ? Math.round(newDuration * 4) / 4 : newDuration;
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => n.id === noteId ? { ...n, duration: Math.max(0.25, snap) } : n),
        } : c),
      })),
    };
  }),
  deleteNote: (clipId, noteId) => withUndo(set, 'Delete Note', (s) => {
    const next = new Set(s.selectedNoteIds); next.delete(noteId);
    return {
      selectedNoteIds: next,
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId
          ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c),
      })),
    };
  }),
  deleteSelectedNotes: (clipId) => withUndo(set, 'Delete Notes', (s) => ({
    selectedNoteIds: new Set(),
    tracks: s.tracks.map((t) => ({
      ...t, clips: t.clips.map((c) => c.id === clipId
        ? { ...c, notes: c.notes.filter((n) => !s.selectedNoteIds.has(n.id)) } : c),
    })),
  })),
  setNoteVelocity: (clipId, noteId, velocity) => withUndo(set, 'Change Velocity', (s) => ({
    tracks: s.tracks.map((t) => ({
      ...t, clips: t.clips.map((c) => c.id === clipId ? {
        ...c, notes: c.notes.map((n) => n.id === noteId
          ? { ...n, velocity: Math.max(1, Math.min(127, velocity)) } : n),
      } : c),
    })),
  })),

  setNotesVelocity: (clipId, noteIds, velocity) => withUndo(set, 'Change Velocity', (s) => {
    const idSet = new Set(noteIds);
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => idSet.has(n.id)
            ? { ...n, velocity: Math.max(1, Math.min(127, velocity)) } : n),
        } : c),
      })),
    };
  }),

  humanizeNotes: (clipId, noteIds, timingAmount, velocityAmount) => withUndo(set, 'Humanize', (s) => {
    const idSet = new Set(noteIds);
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => {
            if (!idSet.has(n.id)) return n;
            // Random timing offset: up to ±timingAmount beats (e.g. 0.05 = 5% of a beat)
            const timeShift = (Math.random() - 0.5) * 2 * timingAmount;
            const newStart = Math.max(0, n.startBeat + timeShift);
            // Random velocity offset: up to ±velocityAmount
            const velShift = Math.round((Math.random() - 0.5) * 2 * velocityAmount);
            const newVel = Math.max(1, Math.min(127, n.velocity + velShift));
            return { ...n, startBeat: newStart, velocity: newVel };
          }),
        } : c),
      })),
    };
  }),

  quantizeNotes: (clipId, noteIds, gridSize, strength) => withUndo(set, 'Quantize', (s) => {
    const idSet = new Set(noteIds);
    // strength: 0 = no change, 1 = full snap
    const str = Math.max(0, Math.min(1, strength));
    return {
      tracks: s.tracks.map((t) => ({
        ...t, clips: t.clips.map((c) => c.id === clipId ? {
          ...c, notes: c.notes.map((n) => {
            if (!idSet.has(n.id)) return n;
            const nearest = Math.round(n.startBeat / gridSize) * gridSize;
            const newStart = n.startBeat + (nearest - n.startBeat) * str;
            return { ...n, startBeat: Math.max(0, newStart) };
          }),
        } : c),
      })),
    };
  }),

  // Undo/Redo
  pushUndoSnapshot: (label: string) => {
    const { tracks, undoVersion } = get();
    pushUndo(tracks, label);
    set({ canUndo: true, canRedo: false, undoLabel: label, redoLabel: '', undoVersion: undoVersion + 1 });
  },
  undo: () => {
    if (undoStack.length === 0) return;
    const current = get();
    const entry = undoStack.pop()!;
    redoStack.push({ tracks: cloneTracks(current.tracks), label: entry.label });
    const prevLabel = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : '';
    set({
      tracks: entry.tracks,
      canUndo: undoStack.length > 0,
      canRedo: true,
      undoLabel: prevLabel,
      redoLabel: entry.label,
      undoVersion: current.undoVersion + 1,
    });
  },
  redo: () => {
    if (redoStack.length === 0) return;
    const current = get();
    const entry = redoStack.pop()!;
    undoStack.push({ tracks: cloneTracks(current.tracks), label: entry.label });
    const nextLabel = redoStack.length > 0 ? redoStack[redoStack.length - 1].label : '';
    set({
      tracks: entry.tracks,
      canUndo: true,
      canRedo: redoStack.length > 0,
      undoLabel: entry.label,
      redoLabel: nextLabel,
      undoVersion: current.undoVersion + 1,
    });
  },
  canUndo: false,
  canRedo: false,
  undoLabel: '',
  redoLabel: '',
  undoVersion: 0,

  // History panel
  showHistoryPanel: false,
  toggleHistoryPanel: () => set((s) => ({ showHistoryPanel: !s.showHistoryPanel })),

  getHistoryList: () => {
    // Build a combined list: [undo entries..., CURRENT, redo entries (reversed)]
    // Current state is at undoStack.length
    const labels: string[] = [];
    labels.push('Initial State');
    for (const entry of undoStack) {
      labels.push(entry.label);
    }
    // Redo stack is in reverse order (last popped = first to redo)
    for (let i = redoStack.length - 1; i >= 0; i--) {
      labels.push(redoStack[i].label);
    }
    return { labels, currentIndex: undoStack.length };
  },

  jumpToHistory: (targetIndex: number) => {
    const currentIndex = undoStack.length;
    if (targetIndex === currentIndex) return;

    if (targetIndex < currentIndex) {
      // Undo multiple times
      const steps = currentIndex - targetIndex;
      for (let i = 0; i < steps; i++) {
        const current = get();
        if (undoStack.length === 0) break;
        const entry = undoStack.pop()!;
        redoStack.push({ tracks: cloneTracks(current.tracks), label: entry.label });
        set({ tracks: entry.tracks });
      }
    } else {
      // Redo multiple times
      const steps = targetIndex - currentIndex;
      for (let i = 0; i < steps; i++) {
        const current = get();
        if (redoStack.length === 0) break;
        const entry = redoStack.pop()!;
        undoStack.push({ tracks: cloneTracks(current.tracks), label: entry.label });
        set({ tracks: entry.tracks });
      }
    }

    const prevLabel = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : '';
    const nextLabel = redoStack.length > 0 ? redoStack[redoStack.length - 1].label : '';
    set({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: prevLabel,
      redoLabel: nextLabel,
      undoVersion: get().undoVersion + 1,
    });
  },

  // Clipboard
  clipboardClip: null,
  clipboardNotes: null,

  copyClip: () => {
    const { selectedClipId, tracks } = get();
    if (!selectedClipId) return;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        set({ clipboardClip: { ...clip, notes: clip.notes.map((n) => ({ ...n })) } });
        return;
      }
    }
  },

  pasteClip: () => {
    const state = get();
    const { clipboardClip, currentTime, bpm, tracks } = state;
    if (!clipboardClip) return;

    // Find which track the original clip was on, or use the track of the currently selected clip
    let targetTrackId: number | null = null;
    if (state.selectedClipId) {
      for (const track of tracks) {
        if (track.clips.some((c) => c.id === state.selectedClipId)) {
          targetTrackId = track.id;
          break;
        }
      }
    }
    if (!targetTrackId) {
      // Find a compatible track
      const isAudio = !!clipboardClip.audioFileUrl;
      const compatible = tracks.find((t) => isAudio ? t.type === 'audio' : t.type !== 'audio');
      if (compatible) targetTrackId = compatible.id;
    }
    if (!targetTrackId) return;

    const pasteBeat = (currentTime * bpm) / 60;
    const newClipId = Date.now() + Math.floor(Math.random() * 1000);

    withUndo(set, 'Paste Clip', (s) => ({
      tracks: s.tracks.map((t) => t.id === targetTrackId ? {
        ...t,
        clips: [...t.clips, {
          ...clipboardClip,
          id: newClipId,
          startBeat: Math.max(0, Math.round(pasteBeat)),
          notes: clipboardClip.notes.map((n) => ({
            ...n,
            id: Date.now() + Math.floor(Math.random() * 10000) + n.id,
          })),
        }],
      } : t),
      selectedClipId: newClipId,
    }));
  },

  copyNotes: () => {
    const { pianoRollClipId, selectedNoteIds, tracks } = get();
    if (!pianoRollClipId || selectedNoteIds.size === 0) return;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === pianoRollClipId);
      if (clip) {
        const notes = clip.notes.filter((n) => selectedNoteIds.has(n.id)).map((n) => ({ ...n }));
        if (notes.length > 0) set({ clipboardNotes: notes });
        return;
      }
    }
  },

  pasteNotes: () => {
    const state = get();
    const { clipboardNotes, pianoRollClipId, currentTime, bpm } = state;
    if (!clipboardNotes || !pianoRollClipId || clipboardNotes.length === 0) return;

    // Find the clip and its start beat
    let clipStartBeat = 0;
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === pianoRollClipId);
      if (clip) { clipStartBeat = clip.startBeat; break; }
    }

    // Calculate paste position relative to clip start
    const playheadBeat = (currentTime * bpm) / 60;
    const pasteOffsetBeat = Math.max(0, playheadBeat - clipStartBeat);

    // Find earliest note in clipboard to use as reference
    const earliestBeat = Math.min(...clipboardNotes.map((n) => n.startBeat));
    const beatShift = pasteOffsetBeat - earliestBeat;

    const newNoteIds: number[] = [];

    withUndo(set, 'Paste Notes', (s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== pianoRollClipId) return c;
          const pastedNotes = clipboardNotes.map((n) => {
            const newId = Date.now() + Math.floor(Math.random() * 10000) + n.id;
            newNoteIds.push(newId);
            return {
              ...n,
              id: newId,
              startBeat: n.startBeat + beatShift,
            };
          });
          return { ...c, notes: [...c.notes, ...pastedNotes] };
        }),
      })),
      selectedNoteIds: new Set(newNoteIds),
    }));
  },

  // Duplicate selected clip (place right after it)
  duplicateClip: (clipId?: number) => {
    const state = get();
    const id = clipId || state.selectedClipId;
    if (!id) return;

    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === id);
      if (clip) {
        const newClipId = Date.now() + Math.floor(Math.random() * 1000);
        withUndo(set, 'Duplicate Clip', (s) => ({
          tracks: s.tracks.map((t) => t.id === track.id ? {
            ...t,
            clips: [...t.clips, {
              ...clip,
              id: newClipId,
              startBeat: clip.startBeat + clip.duration,
              notes: clip.notes.map((n) => ({
                ...n,
                id: Date.now() + Math.floor(Math.random() * 10000) + n.id,
              })),
            }],
          } : t),
          selectedClipId: newClipId,
        }));
        return;
      }
    }
  },

  zoom: 1,
  setZoom: (zoom) => set({ zoom }),
  snapEnabled: true,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  // ─── Project save/load ───
  getProjectData: () => {
    const s = get();
    return {
      projectName: s.projectName,
      bpm: s.bpm,
      timeSignature: s.timeSignature,
      musicalKey: s.musicalKey,
      tracks: s.tracks
        .filter((t) => t.type !== 'audio') // Only save instrument/drum tracks
        .map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          instrument: t.instrument,
          color: t.color,
          muted: t.muted,
          solo: t.solo,
          volume: t.volume,
          pan: t.pan,
          effects: t.effects,
          volumeAutomation: t.volumeAutomation,
          clips: t.clips.map((c) => ({
            id: c.id,
            name: c.name,
            startBeat: c.startBeat,
            duration: c.duration,
            notes: c.notes,
          })),
        })),
    };
  },
  loadProjectData: (data: any) => {
    if (!data) return;
    set({
      projectName: data.projectName || 'Untitled Project',
      bpm: data.bpm || 120,
      timeSignature: data.timeSignature || { numerator: 4, denominator: 4 },
      musicalKey: data.musicalKey || 'C',
      tracks: data.tracks || [],
      // Reset editing state
      selectedClipId: null,
      pianoRollClipId: null,
      pianoRollTrackId: null,
      selectedNoteIds: new Set(),
      lastSavedAt: new Date().toISOString(),
    });
    // Clear undo history for loaded project
    undoStack = [];
    redoStack = [];
  },
}));

export default useDawStore;