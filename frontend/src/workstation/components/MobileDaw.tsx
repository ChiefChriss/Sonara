import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useDawStore from '../state/dawStore';
import { initAudio, play, pause, stop as engineStop, rewind as engineRewind, updateBpm, updateEffects, updateTrackParams } from '../engine/TransportSync';
import { createProject, saveProject } from '../api/ProjectApi';
import { getPreset, getPresetsByCategory, CATEGORIES } from '../models/Presets';
import { TrackEffects, DEFAULT_EFFECTS } from '../models/Types';
import { rebuildTrackSynth, previewNoteOn, previewNoteOffSingle, rebuildPreviewSynth } from '../engine/TransportSync';
import { decodeAudioFile } from '../utils/AudioUtils';
import PianoRoll from './PianoRoll';
import MixerPanel from './MixerPanel';

/* ── Helpers ───────────────────────────────────────── */

const fmt = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const sc = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}.${ms}`;
};

const TRACK_ICONS: Record<string, string> = { audio: '🎙', instrument: '🎹', drums: '🥁' };
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NEW_TRACK_OPTIONS: {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  badge?: string;
  storeType: 'audio' | 'instrument';
  trackName: string;
  instrumentId?: string;
  volume?: number;
  pan?: number;
  effects?: Partial<TrackEffects>;
}[] = [
  {
    id: 'voice',
    label: 'Voice / Audio',
    desc: 'Record with FX',
    icon: '🎙',
    color: '#e74c3c',
    storeType: 'audio',
    trackName: 'Voice',
    volume: 85,
    effects: { reverbMix: 12, filterEnabled: true, filterType: 'highpass', filterFreq: 120 },
  },
  {
    id: 'guitar',
    label: 'Guitar',
    desc: 'Jam with Amps + FX',
    icon: '🎸',
    color: '#1abc9c',
    storeType: 'audio',
    trackName: 'Guitar',
    volume: 82,
    pan: -10,
    effects: { delayMix: 18, delayTime: 0.18, delayFeedback: 28, reverbMix: 10 },
  },
  {
    id: 'bass',
    label: 'Bass',
    desc: 'Find your signature tone',
    icon: '🎸',
    color: '#3498db',
    storeType: 'instrument',
    trackName: 'Bassline',
    badge: 'MIDI',
    instrumentId: 'bass-electric',
    volume: 80,
    effects: { filterEnabled: true, filterType: 'lowpass', filterFreq: 1800 },
  },
  {
    id: 'looper',
    label: 'Looper',
    desc: 'Easily make complete tracks',
    icon: '🔁',
    color: '#e67e22',
    storeType: 'audio',
    trackName: 'Looper',
    volume: 80,
    effects: { delayMix: 20, delayTime: 0.25, delayFeedback: 32, reverbMix: 15 },
  },
  {
    id: 'instrument',
    label: 'Virtual Instruments',
    desc: 'Record keys, pads and more',
    icon: '🎹',
    color: '#2ecc71',
    badge: 'MIDI',
    storeType: 'instrument',
    trackName: 'Keys',
    instrumentId: 'salamander-piano',
    volume: 78,
  },
  {
    id: 'sampler',
    label: 'Sampler',
    desc: 'Turn any sound into an instrument',
    icon: '🎛',
    color: '#9b59b6',
    badge: 'MIDI',
    storeType: 'instrument',
    trackName: 'Sampler',
    instrumentId: 'guitar-acoustic',
    volume: 76,
  },
];

/* ── Isolated currentTime consumers (prevent full-tree re-renders at 60fps) ─── */

const PlayheadLine: React.FC<{ pxPerBeat: number; bpm: number }> = React.memo(({ pxPerBeat, bpm }) => {
  const currentTime = useDawStore((s) => s.currentTime);
  const x = (currentTime / 60) * bpm * pxPerBeat;
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, width: 2, left: 0,
      background: '#e74c3c', boxShadow: '0 0 8px rgba(231,76,60,0.5)',
      zIndex: 5, pointerEvents: 'none' as const,
      transform: `translateX(${x}px)`, willChange: 'transform' as const,
    }} />
  );
});

const TimeDisplay: React.FC<{ style: React.CSSProperties }> = React.memo(({ style }) => {
  const currentTime = useDawStore((s) => s.currentTime);
  return <span style={style}>{fmt(currentTime)}</span>;
});

const RecordingClipView: React.FC<{
  recordStartTime: number; bpm: number; pxPerBeat: number;
}> = React.memo(({ recordStartTime, bpm, pxPerBeat }) => {
  const currentTime = useDawStore((s) => s.currentTime);
  const startBeat = Math.max(0, (recordStartTime / 60) * bpm);
  const nowBeat = Math.max(startBeat + 0.25, (currentTime / 60) * bpm);
  const left = startBeat * pxPerBeat;
  const width = Math.max((nowBeat - startBeat) * pxPerBeat, 8);
  return (
    <div style={{
      position: 'absolute', left, width, top: 1, bottom: 1, borderRadius: 6, overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(231,76,60,0.9), rgba(231,76,60,0.55))',
      border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 1px 8px rgba(231,76,60,0.35)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 2px, transparent 2px 6px)' }} />
      <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.2, color: '#fff', padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', zIndex: 1 }}>Recording...</span>
    </div>
  );
});

const ClipItem = React.memo(({ clip, trackColor, trackType, trackId, pxPerBeat, openClipEdit }: any) => {
  const left = clip.startBeat * pxPerBeat;
  const width = Math.max(clip.duration * pxPerBeat, 8);
  const isAudio = !!(clip.waveformPeaks && clip.waveformPeaks.length > 0);
  const isMidi = !!(clip.notes && clip.notes.length > 0 && !isAudio);

  return (
    <div
      onClick={() => { if (trackType !== 'audio') openClipEdit(trackId, clip.id); }}
      style={{
        position: 'absolute', left, width, top: 1, bottom: 1,
        borderRadius: 6, overflow: 'hidden',
        background: isAudio
          ? `linear-gradient(135deg, ${trackColor}dd, ${trackColor}88)`
          : trackColor,
        opacity: isAudio ? 1 : 0.85,
        border: isAudio ? `1px solid ${trackColor}` : 'none',
        boxShadow: isAudio ? `0 1px 6px ${trackColor}44` : 'none',
      }}
    >
      {isAudio && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.1) 100%)',
          }} />
          <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id={`wg-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
              </linearGradient>
            </defs>
            {(() => {
              const peaks = clip.waveformPeaks!;
              const barCount = Math.min(peaks.length, Math.floor(width / 2));
              const step = peaks.length / barCount;
              const gap = 0.6;
              const barW = Math.max((100 / barCount) - gap, 0.3);
              return Array.from({ length: barCount }, (_, i) => {
                const idx = Math.floor(i * step);
                const peak = peaks[idx] || 0;
                const h = Math.max(peak * 80, 4);
                const x = (i / barCount) * 100;
                return (
                  <rect
                    key={i}
                    x={`${x}%`}
                    y={`${50 - h / 2}%`}
                    width={`${barW}%`}
                    height={`${h}%`}
                    rx="0.8"
                    fill={`url(#wg-${clip.id})`}
                  />
                );
              });
            })()}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
          </svg>
        </>
      )}

      {isMidi && (
        <svg width="100%" height="100%" viewBox={`0 0 ${clip.duration} 24`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          {(() => {
            const pitches = clip.notes!.map((n: any) => n.pitch);
            const minP = Math.min(...pitches);
            const range = Math.max(Math.max(...pitches) - minP, 1);
            return clip.notes!.map((n: any) => (
              <rect
                key={n.id}
                x={n.startBeat}
                y={24 - ((n.pitch - minP) / range) * 20 - 2}
                width={Math.max(n.duration, 0.15)}
                height={2}
                fill="rgba(255,255,255,0.7)"
                rx={0.3}
              />
            ));
          })()}
        </svg>
      )}

      <span style={{
        fontSize: 8, fontWeight: 600, letterSpacing: 0.2, color: '#fff',
        padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden',
        position: 'relative', zIndex: 1,
        textShadow: isAudio ? '0 1px 2px rgba(0,0,0,0.6)' : 'none',
      }}>{clip.name}</span>
    </div>
  );
});

/* ── Component ─────────────────────────────────────── */

const MobileDaw: React.FC = () => {
  const navigate = useNavigate();

  // Store selectors
  const tracks = useDawStore((s) => s.tracks);
  const isPlaying = useDawStore((s) => s.isPlaying);
  const isRecording = useDawStore((s) => s.isRecording);
  const bpm = useDawStore((s) => s.bpm);
  const projectName = useDawStore((s) => s.projectName);
  const setProjectName = useDawStore((s) => s.setProjectName);
  const togglePlay = useDawStore((s) => s.togglePlay);
  const toggleRecord = useDawStore((s) => s.toggleRecord);
  const addTrack = useDawStore((s) => s.addTrack);
  const deleteTrack = useDawStore((s) => s.deleteTrack);
  const renameTrack = useDawStore((s) => s.renameTrack);
  const toggleMute = useDawStore((s) => s.toggleMute);
  const toggleSolo = useDawStore((s) => s.toggleSolo);
  const setTrackVolume = useDawStore((s) => s.setTrackVolume);
  const setTrackPan = useDawStore((s) => s.setTrackPan);
  const setTrackColor = useDawStore((s) => s.setTrackColor);
  const setTrackEffects = useDawStore((s) => s.setTrackEffects);
  const setTrackInstrument = useDawStore((s) => s.setTrackInstrument);
  const pianoRollClipId = useDawStore((s) => s.pianoRollClipId);
  const showMixer = useDawStore((s) => s.showMixer);
  const toggleMixer = useDawStore((s) => s.toggleMixer);
  const undo = useDawStore((s) => s.undo);
  const redo = useDawStore((s) => s.redo);
  const canUndo = useDawStore((s) => s.canUndo);
  const canRedo = useDawStore((s) => s.canRedo);
  const loopEnabled = useDawStore((s) => s.loopEnabled);
  const toggleLoop = useDawStore((s) => s.toggleLoop);
  const selectClip = useDawStore((s) => s.selectClip);
  const openPianoRoll = useDawStore((s) => s.openPianoRoll);
  const timeSignature = useDawStore((s) => s.timeSignature);
  const musicalKey = useDawStore((s) => s.musicalKey);
  const setBpm = useDawStore((s) => s.setBpm);
  const setMusicalKey = useDawStore((s) => s.setMusicalKey);
  const zoom = useDawStore((s) => s.zoom);
  const pushUndoSnapshot = useDawStore((s) => s.pushUndoSnapshot);
  const addAudioClip = useDawStore((s) => s.addAudioClip);
  const addClip = useDawStore((s) => s.addClip);
  const addNote = useDawStore((s) => s.addNote);

  // Local UI state
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [menuTrackId, setMenuTrackId] = useState<number | null>(null);
  const [renamingTrackId, setRenamingTrackId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewTrackSheet, setShowNewTrackSheet] = useState(false);
  const [instrumentPickerTrackId, setInstrumentPickerTrackId] = useState<number | null>(null);
  const [instrumentFilterCat, setInstrumentFilterCat] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFxPanel, setShowFxPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topBarMode, setTopBarMode] = useState<'arrange' | 'edit' | 'settings'>('arrange');
  const [audioImportTrackId, setAudioImportTrackId] = useState<number | null>(null);

  const renameRef = useRef<HTMLInputElement>(null);
  const audioImportInputRef = useRef<HTMLInputElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const clipScrollRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isSyncingScrollRef = useRef(false);

  const syncScroll = useCallback((source: HTMLElement) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const left = source.scrollLeft;
    if (rulerScrollRef.current && rulerScrollRef.current !== source) {
      rulerScrollRef.current.scrollLeft = left;
    }
    clipScrollRefs.current.forEach((el) => {
      if (el !== source) el.scrollLeft = left;
    });
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, []);

  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const [recordingTrackId, setRecordingTrackIdState] = useState<number | null>(null);
  const recordingTrackIdRef = useRef<number | null>(null);
  const setRecordingTrackId = useCallback((id: number | null) => {
    recordingTrackIdRef.current = id;
    setRecordingTrackIdState(id);
  }, []);
  const [keyboardTrackId, setKeyboardTrackId] = useState<number | null>(null);
  const [keyboardClipId, setKeyboardClipId] = useState<number | null>(null);
  const [kbOctave, setKbOctave] = useState(3);
  const [kbActiveKeys, setKbActiveKeys] = useState<Set<number>>(new Set());
  const kbNoteStarts = useRef<Map<number, number>>(new Map());

  useEffect(() => { if (renamingTrackId && renameRef.current) renameRef.current.focus(); }, [renamingTrackId]);

  /* ── Transport handlers ─── */
  const handleTogglePlay = () => {
    // Read isPlaying live from the store so rapid taps don't race on stale
    // React state.
    const wasPlaying = useDawStore.getState().isPlaying;
    const run = async () => {
      await initAudio();
      if (wasPlaying) pause(); else await play();
      togglePlay();
    };
    run();
  };

  const handleRewind = () => {
    if (isRecording) { stopMicRecording(); toggleRecord(); }
    setRecordingTrackId(null);
    engineStop(); useDawStore.getState().stop(); engineRewind(); useDawStore.getState().rewind();
  };

  /* ── Mic recording ─── */
  const startMicRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          setRecordingTrackId(null);
          return;
        }

        const file = new File([blob], `Recording ${new Date().toLocaleTimeString()}`, { type: mimeType });
        const curBpm = useDawStore.getState().bpm;
        const data = await decodeAudioFile(file, curBpm);

        let targetTrackId = recordingTrackIdRef.current;
        if (!targetTrackId) {
          const audioTracks = useDawStore.getState().tracks.filter(t => t.type === 'audio');
          if (audioTracks.length > 0) {
            targetTrackId = audioTracks[audioTracks.length - 1].id;
          } else {
            addTrack('audio');
            const newTracks = useDawStore.getState().tracks;
            targetTrackId = newTracks[newTracks.length - 1].id;
          }
        }

        const recordStartBeat = (recordStartTimeRef.current / 60) * curBpm;
        addAudioClip(targetTrackId, Math.max(0, recordStartBeat), data.name, data.durationBeats, data.url, data.peaks);
        setRecordingTrackId(null);
      };

      recordStartTimeRef.current = useDawStore.getState().currentTime;

      // Find or select a target audio track (read live store — tracks closure may be stale)
      const liveTracks = useDawStore.getState().tracks;
      const sel = selectedTrackId;
      const selTrack = sel ? liveTracks.find(t => t.id === sel) : null;
      if (selTrack && selTrack.type === 'audio') {
        setRecordingTrackId(sel);
      } else {
        const audioTracks = liveTracks.filter(t => t.type === 'audio');
        if (audioTracks.length > 0) {
          setRecordingTrackId(audioTracks[audioTracks.length - 1].id);
        } else {
          addTrack('audio');
          const newTracks = useDawStore.getState().tracks;
          const newTrack = newTracks[newTracks.length - 1];
          setRecordingTrackId(newTrack?.id ?? null);
          if (newTrack?.id) setSelectedTrackId(newTrack.id);
        }
      }

      recorder.start(250);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Microphone access is required to record audio. Please allow mic access and try again.');
    }
  }, [selectedTrackId, addTrack, addAudioClip, setRecordingTrackId]);

  const stopMicRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const handleRecordToggle = async () => {
    await initAudio();
    // Read live store state to avoid races from stale React closures.
    const s = useDawStore.getState();
    const wasRecording = s.isRecording;
    const wasPlaying = s.isPlaying;
    if (wasRecording) {
      stopMicRecording();
      if (wasPlaying) { pause(); togglePlay(); }
      toggleRecord();
      setRecordingTrackId(null);
    } else {
      if (keyboardTrackId) {
        toggleRecord();
        if (!wasPlaying) { await play(); togglePlay(); }
      } else {
        await startMicRecording();
        toggleRecord();
        if (!wasPlaying) { await play(); togglePlay(); }
      }
    }
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    const state = useDawStore.getState();
    const data = state.getProjectData();
    try {
      if (state.serverProjectId) {
        await saveProject(state.serverProjectId, state.projectName, data);
      } else {
        const proj = await createProject(state.projectName, data);
        state.setServerProjectId(proj.id);
        window.history.replaceState(null, '', `/workstation/${proj.id}`);
      }
      useDawStore.setState({ lastSavedAt: new Date().toISOString() });
    } catch (err) { console.error('Save failed:', err); }
    setSaving(false);
  }, []);

  const openClipEdit = useCallback((trackId: number, clipId: number) => {
    const liveTracks = useDawStore.getState().tracks;
    const trk = liveTracks.find(t => t.id === trackId);
    if (trk && trk.type !== 'audio') {
      setKeyboardTrackId(trackId);
      setKeyboardClipId(clipId);
      setSelectedTrackId(trackId);
      rebuildPreviewSynth(trk.instrument);
    }
  }, []);

  const openFullPianoRoll = (trackId: number, clipId: number) => {
    selectClip(clipId);
    openPianoRoll(clipId, trackId);
    setKeyboardTrackId(null);
    setKeyboardClipId(null);
  };

  const handleRenameSubmit = (trackId: number) => {
    if (renameValue.trim()) renameTrack(trackId, renameValue.trim());
    setRenamingTrackId(null);
  };

  const openAudioImport = useCallback((trackId: number) => {
    setAudioImportTrackId(trackId);
    audioImportInputRef.current?.click();
  }, []);

  const handleAudioImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetTrackId = audioImportTrackId;
    setAudioImportTrackId(null);

    if (!file || !targetTrackId) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please choose an audio file.');
      return;
    }

    try {
      const curBpm = useDawStore.getState().bpm;
      const currentBeat = (useDawStore.getState().currentTime / 60) * curBpm;
      const data = await decodeAudioFile(file, curBpm);
      addAudioClip(targetTrackId, Math.max(0, currentBeat), data.name, data.durationBeats, data.url, data.peaks);
    } catch (err) {
      console.error('Audio import failed:', err);
      alert('Could not import that audio file.');
    }
  }, [audioImportTrackId, addAudioClip]);

  const openKeyboard = useCallback((trackId: number) => {
    const track = useDawStore.getState().tracks.find(t => t.id === trackId);
    if (!track || track.type === 'audio') return;
    let clip = track.clips[0];
    if (!clip) {
      addClip(trackId, 0);
      const updated = useDawStore.getState().tracks.find(t => t.id === trackId);
      clip = updated?.clips[0]!;
      if (!clip) return;
    }
    setKeyboardTrackId(trackId);
    setKeyboardClipId(clip.id);
    setSelectedTrackId(trackId);
    rebuildPreviewSynth(track.instrument);
  }, [addClip]);

  const kbNoteOn = useCallback((pitch: number) => {
    setKbActiveKeys(prev => new Set(prev).add(pitch));
    previewNoteOn(pitch, 100);
    if (isPlaying && isRecording && keyboardClipId) {
      const beat = (useDawStore.getState().currentTime / 60) * bpm;
      const s = useDawStore.getState();
      const trk = s.tracks.find(t => t.id === keyboardTrackId);
      const cl = trk?.clips.find(c => c.id === keyboardClipId);
      if (cl) kbNoteStarts.current.set(pitch, beat - cl.startBeat);
    }
  }, [isPlaying, isRecording, keyboardClipId, keyboardTrackId, bpm]);

  const kbNoteOff = useCallback((pitch: number) => {
    setKbActiveKeys(prev => { const n = new Set(prev); n.delete(pitch); return n; });
    previewNoteOffSingle(pitch);
    if (isRecording && keyboardClipId && kbNoteStarts.current.has(pitch)) {
      const startBeat = kbNoteStarts.current.get(pitch)!;
      const s = useDawStore.getState();
      const beat = (s.currentTime / 60) * bpm;
      const trk = s.tracks.find(t => t.id === keyboardTrackId);
      const cl = trk?.clips.find(c => c.id === keyboardClipId);
      if (cl) {
        const dur = Math.max(0.25, (beat - cl.startBeat) - startBeat);
        addNote(keyboardClipId, { pitch, startBeat: Math.round(startBeat * 4) / 4, duration: Math.round(dur * 4) / 4, velocity: 100 });
      }
      kbNoteStarts.current.delete(pitch);
    }
  }, [isRecording, keyboardClipId, keyboardTrackId, bpm, addNote]);

  const handleInstrumentChange = useCallback((trackId: number, presetId: string) => {
    setTrackInstrument(trackId, presetId as any);
    const track = useDawStore.getState().tracks.find(t => t.id === trackId);
    if (track) rebuildTrackSynth({ ...track, instrument: presetId as any });
    rebuildPreviewSynth(presetId);
    setInstrumentPickerTrackId(null);
  }, [setTrackInstrument]);

  const createTrackFromOption = useCallback((opt: (typeof NEW_TRACK_OPTIONS)[number]) => {
    const stateBefore = useDawStore.getState();
    const existingIds = new Set(stateBefore.tracks.map(t => t.id));

    addTrack(opt.storeType);

    const stateAfter = useDawStore.getState();
    const createdTrack =
      stateAfter.tracks.find(t => !existingIds.has(t.id)) ||
      stateAfter.tracks[stateAfter.tracks.length - 1];
    if (!createdTrack) return;

    renameTrack(createdTrack.id, opt.trackName);
    setTrackColor(createdTrack.id, opt.color);
    if (typeof opt.volume === 'number') setTrackVolume(createdTrack.id, opt.volume);
    if (typeof opt.pan === 'number') setTrackPan(createdTrack.id, opt.pan);

    if (opt.instrumentId && createdTrack.type !== 'audio') {
      setTrackInstrument(createdTrack.id, opt.instrumentId as any);
      rebuildTrackSynth({ ...createdTrack, instrument: opt.instrumentId as any });
      rebuildPreviewSynth(opt.instrumentId);
    }

    if (opt.effects) {
      setTrackEffects(createdTrack.id, opt.effects);
      const updatedTrack = useDawStore.getState().tracks.find(t => t.id === createdTrack.id);
      if (updatedTrack) {
        updateEffects({
          ...updatedTrack,
          effects: { ...(updatedTrack.effects || DEFAULT_EFFECTS), ...opt.effects },
        });
      }
    }

    const withParams = useDawStore.getState().tracks.find(t => t.id === createdTrack.id);
    if (withParams) updateTrackParams(withParams);

    setSelectedTrackId(createdTrack.id);
    setMenuTrackId(null);
    setShowNewTrackSheet(false);
  }, [
    addTrack,
    renameTrack,
    setTrackColor,
    setTrackVolume,
    setTrackPan,
    setTrackInstrument,
    setTrackEffects,
  ]);

  const handleFxUpdate = useCallback((trackId: number, changes: Partial<TrackEffects>) => {
    setTrackEffects(trackId, changes);
    const track = useDawStore.getState().tracks.find(t => t.id === trackId);
    if (track) updateEffects({ ...track, effects: { ...(track.effects || DEFAULT_EFFECTS), ...changes } });
  }, [setTrackEffects]);

  useEffect(() => {
    // Initialize AudioContext on the first user interaction. Use pointerdown
    // (fires before click) and touchend (for iOS Safari quirks) to maximize
    // the chance we catch the gesture. Once running, subsequent play() calls
    // don't need a gesture.
    const h = () => {
      initAudio();
      document.removeEventListener('pointerdown', h);
      document.removeEventListener('touchend', h);
      document.removeEventListener('click', h);
    };
    document.addEventListener('pointerdown', h);
    document.addEventListener('touchend', h);
    document.addEventListener('click', h);
    return () => {
      document.removeEventListener('pointerdown', h);
      document.removeEventListener('touchend', h);
      document.removeEventListener('click', h);
    };
  }, []);

  /* ── Layout math ─── */
  const beatsPerBar = timeSignature.numerator;
  const pxPerBeat = 12 * zoom;
  const furthest = tracks.reduce((max, t) => t.clips.reduce((m, c) => Math.max(m, c.startBeat + c.duration), max), 0);
  const totalBars = Math.max(16, Math.ceil(furthest / beatsPerBar) + 4);
  const rulerW = totalBars * beatsPerBar * pxPerBeat;
  const selectedTrack = tracks.find(t => t.id === selectedTrackId) || null;
  const fxTrack = selectedTrack;
  const fx = fxTrack?.effects || DEFAULT_EFFECTS;
  const hasSolo = tracks.some(t => t.solo);

  /* ── Render ─── */
  return (
    <div className="sonara-mobile-daw" style={st.container}>
      <input
        ref={audioImportInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioImport}
        style={{ display: 'none' }}
      />

      {/* ══════ TOP BAR ══════ */}
      <div style={st.topBar}>
        <button style={st.topBtn} onClick={() => navigate('/create')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>

        {/* Center pill: Arrange / Edit / Settings icons */}
        <div style={st.pill}>
          <button
            style={{ ...st.pillBtn, ...(topBarMode === 'arrange' ? st.pillActive : {}) }}
            onClick={() => { setTopBarMode('arrange'); setShowSettings(false); setShowFxPanel(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button
            style={{ ...st.pillBtn, ...(topBarMode === 'edit' ? st.pillActive : {}) }}
            onClick={() => { setTopBarMode('edit'); setShowSettings(false); setShowFxPanel(!showFxPanel); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button
            style={{ ...st.pillBtn, ...(topBarMode === 'settings' ? st.pillActive : {}) }}
            onClick={() => { setTopBarMode('settings'); setShowFxPanel(false); setShowSettings(!showSettings); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>

        <button style={{ ...st.topBtn, opacity: saving ? 0.5 : 1 }} onClick={handleSave} disabled={saving}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div style={st.recIndicator}>
          <span style={st.recDot} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Recording</span>
          <TimeDisplay style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }} />
          {recordingTrackId && (() => {
            const rt = tracks.find(t => t.id === recordingTrackId);
            return rt ? <span style={{ fontSize: 11, color: rt.color, marginLeft: 'auto' }}>→ {rt.name}</span> : null;
          })()}
        </div>
      )}

      {/* ══════ TIMELINE RULER ══════ */}
      <div style={st.rulerWrap}>
        <div
          style={st.rulerScroll}
          ref={rulerScrollRef}
          onScroll={(e) => syncScroll(e.currentTarget)}
        >
          <div style={{ width: rulerW, height: '100%', position: 'relative' }}>
            {Array.from({ length: totalBars + 1 }, (_, i) => (
              <span key={i} style={{ ...st.barMark, left: i * beatsPerBar * pxPerBeat }}>{i + 1}</span>
            ))}
            <PlayheadLine pxPerBeat={pxPerBeat} bpm={bpm} />
          </div>
        </div>
      </div>

      {/* ══════ TRACK LIST ══════ */}
      <div style={st.trackList}>
        {tracks.map((track) => {
          const preset = getPreset(track.instrument);
          const dimmed = hasSolo && !track.solo;
          const selected = selectedTrackId === track.id;
          const trackFx = track.effects || DEFAULT_EFFECTS;
          const hasActiveFx = trackFx.reverbMix > 0 || trackFx.delayMix > 0 || trackFx.filterEnabled;

          return (
            <div
              key={track.id}
              style={{
                ...st.trackRow,
                opacity: dimmed ? 0.4 : track.muted ? 0.5 : 1,
                borderLeft: selected ? `3px solid ${track.color}` : '3px solid transparent',
                background: selected ? 'rgba(167,139,250,0.06)' : 'transparent',
              }}
            >
              {/* Track info row */}
              <div style={st.trackInfo} onClick={() => {
                if (track.type !== 'audio') {
                  if (keyboardTrackId === track.id) {
                    setKeyboardTrackId(null);
                    setKeyboardClipId(null);
                    setSelectedTrackId(null);
                  } else {
                    openKeyboard(track.id);
                  }
                } else {
                  setSelectedTrackId(selected ? null : track.id);
                }
                setMenuTrackId(null);
              }}>
                <div style={{ ...st.trackIcon, background: track.color }}>{TRACK_ICONS[track.type] || '🎵'}</div>
                <div style={st.trackMeta}>
                  {renamingTrackId === track.id ? (
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(track.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(track.id); if (e.key === 'Escape') setRenamingTrackId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      style={st.renameInput}
                    />
                  ) : (
                    <span style={st.trackName}>{track.name}</span>
                  )}
                  <span
                    style={{ ...st.trackPreset, ...(track.type !== 'audio' ? { cursor: 'pointer' } : {}) }}
                    onClick={(e) => {
                      if (track.type !== 'audio') {
                        e.stopPropagation();
                        setInstrumentPickerTrackId(track.id);
                        setInstrumentFilterCat(null);
                      }
                    }}
                  >
                    {track.effects && hasActiveFx && <span style={{ color: '#a78bfa', marginRight: 4 }}>FX</span>}
                    {track.type === 'audio' ? 'Audio' : (
                      <>{preset?.name || track.instrument} <span style={{ color: '#a78bfa', fontSize: 9 }}>▼</span></>
                    )}
                  </span>
                </div>
                {/* Mute / Solo / Menu quick buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    style={{ ...st.microBtn, color: track.muted ? '#f87171' : 'rgba(255,255,255,0.4)' }}
                    onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                  >M</button>
                  <button
                    style={{ ...st.microBtn, color: track.solo ? '#facc15' : 'rgba(255,255,255,0.4)' }}
                    onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                  >S</button>
                  <button
                    style={st.microBtn}
                    onClick={(e) => { e.stopPropagation(); setMenuTrackId(menuTrackId === track.id ? null : track.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" stroke="none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                </div>
              </div>

              {/* Clip previews */}
              <div
                style={st.clipArea}
                ref={(el) => {
                  if (el) clipScrollRefs.current.set(track.id, el);
                  else clipScrollRefs.current.delete(track.id);
                }}
                onScroll={(e) => syncScroll(e.currentTarget)}
              >
                <div style={{ width: rulerW, height: '100%', position: 'relative' }}>
                  {track.clips.map((clip) => (
                    <ClipItem
                      key={clip.id}
                      clip={clip}
                      trackColor={track.color}
                      trackType={track.type}
                      trackId={track.id}
                      pxPerBeat={pxPerBeat}
                      openClipEdit={openClipEdit}
                    />
                  ))}
                  {isRecording && !keyboardTrackId && recordingTrackId === track.id && (
                    <RecordingClipView recordStartTime={recordStartTimeRef.current} bpm={bpm} pxPerBeat={pxPerBeat} />
                  )}
                  <PlayheadLine pxPerBeat={pxPerBeat} bpm={bpm} />
                </div>
              </div>

              {/* Context menu */}
              {menuTrackId === track.id && (
                <div style={st.trackMenu}>
                  <button style={st.tmBtn} onClick={() => { setRenameValue(track.name); setRenamingTrackId(track.id); setMenuTrackId(null); }}>
                    Rename
                  </button>
                  {track.clips[0] && track.type !== 'audio' && (
                    <>
                      <button style={st.tmBtn} onClick={() => { openClipEdit(track.id, track.clips[0].id); setMenuTrackId(null); }}>
                        Keyboard
                      </button>
                      <button style={st.tmBtn} onClick={() => { openFullPianoRoll(track.id, track.clips[0].id); setMenuTrackId(null); }}>
                        MIDI Editor
                      </button>
                    </>
                  )}
                  <button style={st.tmBtn} onClick={() => { setSelectedTrackId(track.id); setShowFxPanel(true); setTopBarMode('edit'); setMenuTrackId(null); }}>
                    FX &amp; Mix
                  </button>
                  {track.type === 'audio' && (
                    <button style={st.tmBtn} onClick={() => { openAudioImport(track.id); setMenuTrackId(null); }}>
                      Import Audio
                    </button>
                  )}
                  <button style={{ ...st.tmBtn, color: '#f87171' }} onClick={() => {
                    deleteTrack(track.id);
                    setMenuTrackId(null);
                    if (selectedTrackId === track.id) setSelectedTrackId(null);
                    if (keyboardTrackId === track.id) { setKeyboardTrackId(null); setKeyboardClipId(null); }
                    if (recordingTrackIdRef.current === track.id) setRecordingTrackId(null);
                  }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add track button */}
        <div style={st.addSection}>
          <button style={st.addBtn} onClick={() => setShowNewTrackSheet(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ marginLeft: 8 }}>Add Track</span>
          </button>
        </div>
      </div>

      {/* ══════ UNDO / TIME / REDO BAR ══════ */}
      <div style={st.undoBar}>
        <button style={{ ...st.undoBtn, opacity: canUndo ? 1 : 0.3 }} onClick={undo} disabled={!canUndo}>Undo</button>
        <TimeDisplay style={st.undoTime} />
        <button style={{ ...st.undoBtn, opacity: canRedo ? 1 : 0.3 }} onClick={redo} disabled={!canRedo}>Redo</button>
      </div>

      {/* ══════ BOTTOM TRANSPORT ══════ */}
      <div style={st.transport}>
        <button style={{ ...st.trBtn, color: showMixer ? '#a78bfa' : '#888' }} onClick={toggleMixer}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        </button>
        <button style={st.trBtn} onClick={handleRewind}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="11 19 2 12 11 5"/><polygon points="22 19 13 12 22 5"/></svg>
        </button>
        <button style={{ ...st.recBtn, ...(isRecording ? { borderColor: '#fff', background: 'rgba(231,76,60,0.3)' } : {}) }} onClick={handleRecordToggle}>
          <div style={{ width: 20, height: 20, borderRadius: isRecording ? 4 : '50%', background: isRecording ? '#fff' : '#e74c3c', transition: 'border-radius 0.15s' }} />
        </button>
        <button style={st.playBtn} onClick={handleTogglePlay}>
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="5 3 19 12 5 21"/></svg>
          )}
        </button>
        <button style={{ ...st.trBtn, color: loopEnabled ? '#00d4ff' : '#888' }} onClick={toggleLoop}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
        </button>
        <button style={st.trBtn} onClick={() => setShowMoreMenu(!showMoreMenu)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#888" stroke="none"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>

      {/* ══════ FX / MIX BOTTOM SHEET ══════ */}
      {showFxPanel && fxTrack && (
        <div style={st.overlay} onClick={() => setShowFxPanel(false)}>
          <div style={st.fxSheet} onClick={(e) => e.stopPropagation()}>
            <div style={st.fxHeader}>
              <div style={{ ...st.trackIcon, background: fxTrack.color, width: 28, height: 28, fontSize: 14, borderRadius: 6 }}>{TRACK_ICONS[fxTrack.type] || '🎵'}</div>
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{fxTrack.name}</span>
              <button style={st.fxClose} onClick={() => setShowFxPanel(false)}>✕</button>
            </div>

            {/* Volume */}
            <div style={st.fxRow}>
              <span style={st.fxLabel}>Volume</span>
              <input
                type="range" min={0} max={100} value={fxTrack.volume}
                onTouchStart={() => pushUndoSnapshot('Volume')}
                onMouseDown={() => pushUndoSnapshot('Volume')}
                onChange={(e) => { setTrackVolume(fxTrack.id, +e.target.value); updateTrackParams(useDawStore.getState().tracks.find(t => t.id === fxTrack.id)!); }}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fxTrack.volume}</span>
            </div>

            {/* Pan */}
            <div style={st.fxRow}>
              <span style={st.fxLabel}>Pan</span>
              <input
                type="range" min={-100} max={100} value={fxTrack.pan}
                onTouchStart={() => pushUndoSnapshot('Pan')}
                onMouseDown={() => pushUndoSnapshot('Pan')}
                onChange={(e) => { setTrackPan(fxTrack.id, +e.target.value); updateTrackParams(useDawStore.getState().tracks.find(t => t.id === fxTrack.id)!); }}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fxTrack.pan > 0 ? `${fxTrack.pan}R` : fxTrack.pan < 0 ? `${Math.abs(fxTrack.pan)}L` : 'C'}</span>
            </div>

            <div style={st.fxDivider} />

            {/* Reverb */}
            <div style={st.fxRow}>
              <span style={st.fxLabel}>🌊 Reverb</span>
              <input
                type="range" min={0} max={100} value={fx.reverbMix}
                onTouchStart={() => pushUndoSnapshot('Reverb')}
                onChange={(e) => handleFxUpdate(fxTrack.id, { reverbMix: +e.target.value })}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fx.reverbMix}%</span>
            </div>
            <div style={st.fxRow}>
              <span style={{ ...st.fxLabel, paddingLeft: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Decay</span>
              <input
                type="range" min={1} max={100} value={fx.reverbDecay * 10}
                onTouchStart={() => pushUndoSnapshot('Reverb Decay')}
                onMouseDown={() => pushUndoSnapshot('Reverb Decay')}
                onChange={(e) => handleFxUpdate(fxTrack.id, { reverbDecay: +e.target.value / 10 })}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fx.reverbDecay.toFixed(1)}s</span>
            </div>

            {/* Delay */}
            <div style={st.fxRow}>
              <span style={st.fxLabel}>⏱ Delay</span>
              <input
                type="range" min={0} max={100} value={fx.delayMix}
                onTouchStart={() => pushUndoSnapshot('Delay')}
                onChange={(e) => handleFxUpdate(fxTrack.id, { delayMix: +e.target.value })}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fx.delayMix}%</span>
            </div>
            <div style={st.fxRow}>
              <span style={{ ...st.fxLabel, paddingLeft: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Time</span>
              <input
                type="range" min={1} max={100} value={fx.delayTime * 100}
                onTouchStart={() => pushUndoSnapshot('Delay Time')}
                onMouseDown={() => pushUndoSnapshot('Delay Time')}
                onChange={(e) => handleFxUpdate(fxTrack.id, { delayTime: +e.target.value / 100 })}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{(fx.delayTime * 1000).toFixed(0)}ms</span>
            </div>
            <div style={st.fxRow}>
              <span style={{ ...st.fxLabel, paddingLeft: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Feedback</span>
              <input
                type="range" min={0} max={90} value={fx.delayFeedback}
                onTouchStart={() => pushUndoSnapshot('Delay Feedback')}
                onMouseDown={() => pushUndoSnapshot('Delay Feedback')}
                onChange={(e) => handleFxUpdate(fxTrack.id, { delayFeedback: +e.target.value })}
                style={st.fxSlider}
              />
              <span style={st.fxVal}>{fx.delayFeedback}%</span>
            </div>

            {/* Filter */}
            <div style={st.fxRow}>
              <span style={st.fxLabel}>🎛 Filter</span>
              <button
                style={{ ...st.filterToggle, background: fx.filterEnabled ? '#a78bfa' : 'rgba(255,255,255,0.08)' }}
                onClick={() => handleFxUpdate(fxTrack.id, { filterEnabled: !fx.filterEnabled })}
              >{fx.filterEnabled ? 'ON' : 'OFF'}</button>
            </div>
            {fx.filterEnabled && (
              <>
                <div style={st.fxRow}>
                  <span style={{ ...st.fxLabel, paddingLeft: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Type</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['lowpass', 'highpass', 'bandpass'] as const).map(ft => (
                      <button
                        key={ft}
                        style={{ ...st.filterTypeBtn, background: fx.filterType === ft ? '#a78bfa' : 'rgba(255,255,255,0.08)' }}
                        onClick={() => handleFxUpdate(fxTrack.id, { filterType: ft })}
                      >{ft.charAt(0).toUpperCase() + ft.slice(1, 3)}</button>
                    ))}
                  </div>
                </div>
                <div style={st.fxRow}>
                  <span style={{ ...st.fxLabel, paddingLeft: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Freq</span>
                  <input
                    type="range" min={20} max={20000} value={fx.filterFreq}
                    onTouchStart={() => pushUndoSnapshot('Filter Freq')}
                    onMouseDown={() => pushUndoSnapshot('Filter Freq')}
                    onChange={(e) => handleFxUpdate(fxTrack.id, { filterFreq: +e.target.value })}
                    style={st.fxSlider}
                  />
                  <span style={st.fxVal}>{fx.filterFreq >= 1000 ? `${(fx.filterFreq / 1000).toFixed(1)}k` : fx.filterFreq}Hz</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════ SETTINGS PANEL ══════ */}
      {showSettings && (
        <div style={st.overlay} onClick={() => setShowSettings(false)}>
          <div style={st.settingsSheet} onClick={(e) => e.stopPropagation()}>
            <div style={st.fxHeader}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Project Settings</span>
              <button style={st.fxClose} onClick={() => setShowSettings(false)}>✕</button>
            </div>

            {/* Project name */}
            <div style={st.settRow}>
              <span style={st.settLabel}>Name</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={st.settInput}
              />
            </div>

            {/* BPM */}
            <div style={st.settRow}>
              <span style={st.settLabel}>BPM</span>
              <input
                type="range" min={40} max={240} value={bpm}
                onTouchStart={() => pushUndoSnapshot('BPM')}
                onMouseDown={() => pushUndoSnapshot('BPM')}
                onChange={(e) => { setBpm(+e.target.value); updateBpm(+e.target.value); }}
                style={st.fxSlider}
              />
              <span style={st.settVal}>{bpm}</span>
            </div>

            {/* Key */}
            <div style={st.settRow}>
              <span style={st.settLabel}>Key</span>
              <div style={st.keyGrid}>
                {KEYS.map(k => (
                  <button
                    key={k}
                    style={{ ...st.keyBtn, background: musicalKey === k ? '#a78bfa' : 'rgba(255,255,255,0.06)', color: musicalKey === k ? '#fff' : 'rgba(255,255,255,0.6)' }}
                    onClick={() => setMusicalKey(k)}
                  >{k}</button>
                ))}
              </div>
            </div>

            {/* Time Signature */}
            <div style={st.settRow}>
              <span style={st.settLabel}>Time Sig</span>
              <span style={st.settVal}>{timeSignature.numerator}/{timeSignature.denominator}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MORE MENU ══════ */}
      {showMoreMenu && (
        <div style={st.overlay} onClick={() => setShowMoreMenu(false)}>
          <div style={st.morePanel} onClick={(e) => e.stopPropagation()}>
            <button style={st.morePanelItem} onClick={() => { handleSave(); setShowMoreMenu(false); }}>💾 Save Project</button>
            <button
              style={{ ...st.morePanelItem, opacity: 0.4, cursor: 'not-allowed' }}
              disabled
            >📤 Export (desktop only)</button>
            <button style={st.morePanelItem} onClick={() => { setShowMoreMenu(false); navigate('/create'); }}>↩ Exit to Dashboard</button>
          </div>
        </div>
      )}

      {/* ══════ NEW TRACK SHEET ══════ */}
      {showNewTrackSheet && (
        <div style={st.overlay} onClick={() => setShowNewTrackSheet(false)}>
          <div style={st.newTrackSheet} onClick={(e) => e.stopPropagation()}>
            <div style={st.sheetHandle} />
            <h3 style={st.newTrackTitle}>New Track</h3>
            {NEW_TRACK_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                style={st.newTrackRow}
                onClick={() => createTrackFromOption(opt)}
              >
                <div style={{ ...st.newTrackIcon, background: opt.color }}>{opt.icon}</div>
                <div style={st.newTrackMeta}>
                  <span style={st.newTrackLabel}>
                    {opt.label}
                    {opt.badge && <span style={st.newTrackBadge}>{opt.badge}</span>}
                  </span>
                  <span style={st.newTrackDesc}>{opt.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════ INSTRUMENT PICKER ══════ */}
      {instrumentPickerTrackId && (() => {
        const pickerTrack = tracks.find(t => t.id === instrumentPickerTrackId);
        if (!pickerTrack) return null;
        const catMap = getPresetsByCategory();
        const currentPreset = getPreset(pickerTrack.instrument);
        return (
          <div style={st.overlay} onClick={() => setInstrumentPickerTrackId(null)}>
            <div style={st.instrSheet} onClick={(e) => e.stopPropagation()}>
              <div style={st.sheetHandle} />
              <div style={st.fxHeader}>
                <div style={{ ...st.trackIcon, background: pickerTrack.color, width: 28, height: 28, fontSize: 14, borderRadius: 6 }}>
                  {TRACK_ICONS[pickerTrack.type] || '🎵'}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{pickerTrack.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    Current: {currentPreset?.name || pickerTrack.instrument}
                  </span>
                </div>
                <button style={st.fxClose} onClick={() => setInstrumentPickerTrackId(null)}>✕</button>
              </div>

              {/* Category filter tabs */}
              <div style={st.instrCatRow}>
                <button
                  style={{ ...st.instrCatBtn, ...(instrumentFilterCat === null ? st.instrCatActive : {}) }}
                  onClick={() => setInstrumentFilterCat(null)}
                >All</button>
                {CATEGORIES.map(cat => {
                  if (!catMap.has(cat)) return null;
                  return (
                    <button
                      key={cat}
                      style={{ ...st.instrCatBtn, ...(instrumentFilterCat === cat ? st.instrCatActive : {}) }}
                      onClick={() => setInstrumentFilterCat(cat)}
                    >{cat}</button>
                  );
                })}
              </div>

              {/* Preset list */}
              <div style={st.instrList}>
                {Array.from(catMap).filter(([cat]) => !instrumentFilterCat || cat === instrumentFilterCat).map(([cat, presets]) => (
                  <div key={cat}>
                    <div style={st.instrCatLabel}>{cat}</div>
                    {presets.map(p => (
                      <button
                        key={p.id}
                        style={{
                          ...st.instrRow,
                          background: pickerTrack.instrument === p.id ? 'rgba(167,139,250,0.12)' : 'transparent',
                        }}
                        onClick={() => handleInstrumentChange(instrumentPickerTrackId, p.id)}
                      >
                        <span style={st.instrDot}>
                          {pickerTrack.instrument === p.id && <span style={{ color: '#a78bfa' }}>✓</span>}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: pickerTrack.instrument === p.id ? 700 : 500, color: pickerTrack.instrument === p.id ? '#a78bfa' : '#fff' }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                          {p.type === 'sampler' ? 'Sample' : 'Synth'}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════ PIANO ROLL OVERLAY ══════ */}
      {pianoRollClipId && (
        <div style={st.pianoOverlay}>
          <PianoRoll />
        </div>
      )}

      {/* ══════ KEYBOARD OVERLAY ══════ */}
      {keyboardTrackId && keyboardClipId && !pianoRollClipId && (() => {
        const kbTrack = tracks.find(t => t.id === keyboardTrackId);
        if (!kbTrack) return null;
        const kbPreset = getPreset(kbTrack.instrument);

        const NOTE_NAMES_KB = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const startPitch = (kbOctave + 1) * 12;
        const numKeys = 25;
        const whites: { pitch: number; idx: number }[] = [];
        const blacks: { pitch: number; afterWhite: number }[] = [];
        let wi = 0;
        for (let i = 0; i < numKeys; i++) {
          const p = startPitch + i;
          if (p > 108) break;
          if ([1,3,6,8,10].includes(p % 12)) {
            blacks.push({ pitch: p, afterWhite: wi });
          } else {
            whites.push({ pitch: p, idx: wi });
            wi++;
          }
        }
        const ww = 100 / whites.length;

        return (
          <div style={st.keyboardOverlay}>
            {/* Header bar */}
            <div style={st.kbHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Instrument</span>
                <button
                  style={st.kbInstrBtn}
                  onClick={() => setInstrumentPickerTrackId(keyboardTrackId)}
                >
                  {kbPreset?.name || kbTrack.instrument}
                  <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.5 }}>▼</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button style={st.kbOctBtn} onClick={() => setKbOctave(o => Math.max(1, o - 1))}>‹</button>
                <span style={st.kbOctLabel}>Oct {kbOctave}</span>
                <button style={st.kbOctBtn} onClick={() => setKbOctave(o => Math.min(6, o + 1))}>›</button>
              </div>

              <button
                style={st.kbEditBtn}
                onClick={() => { openFullPianoRoll(keyboardTrackId, keyboardClipId); }}
                title="MIDI Editor"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>

              <button style={st.kbCloseBtn} onClick={() => { setKeyboardTrackId(null); setKeyboardClipId(null); }}>✕</button>
            </div>

            {/* Mini transport for quick recording */}
            <div style={st.kbTransport}>
              <button
                style={{ ...st.kbTransBtn, color: isRecording && isPlaying ? '#e74c3c' : 'rgba(255,255,255,0.4)' }}
                onClick={handleRecordToggle}
              >
                <div style={{
                  width: 10, height: 10,
                  borderRadius: isRecording ? 2 : '50%',
                  background: isRecording ? '#fff' : '#e74c3c',
                  transition: 'border-radius 0.15s',
                }} />
              </button>

              <button
                style={{ ...st.kbTransBtn, color: isPlaying ? '#a78bfa' : 'rgba(255,255,255,0.5)' }}
                onClick={handleTogglePlay}
              >
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                }
              </button>

              <button style={st.kbTransBtn} onClick={handleRewind}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><rect x="3" y="5" width="4" height="14" rx="1"/><polygon points="20,5 9,12 20,19"/></svg>
              </button>

              <div style={{ flex: 1 }} />

              {isRecording && isPlaying ? (
                <span style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e74c3c', animation: 'pulse-rec 1s infinite' }} />
                  REC
                </span>
              ) : (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                  Tap ● then play keys
                </span>
              )}
            </div>

            {/* Piano keys */}
            <div style={st.kbPiano}>
              {whites.map((wk) => {
                const active = kbActiveKeys.has(wk.pitch);
                const isC = wk.pitch % 12 === 0;
                const noteName = NOTE_NAMES_KB[wk.pitch % 12] + Math.floor(wk.pitch / 12 - 1);
                return (
                  <div
                    key={wk.pitch}
                    onTouchStart={(e) => { e.preventDefault(); kbNoteOn(wk.pitch); }}
                    onTouchEnd={(e) => { e.preventDefault(); kbNoteOff(wk.pitch); }}
                    onTouchCancel={(e) => { e.preventDefault(); kbNoteOff(wk.pitch); }}
                    onMouseDown={() => kbNoteOn(wk.pitch)}
                    onMouseUp={() => kbNoteOff(wk.pitch)}
                    onMouseLeave={() => { if (kbActiveKeys.has(wk.pitch)) kbNoteOff(wk.pitch); }}
                    style={{
                      width: `${ww}%`, height: '100%',
                      background: active
                        ? 'linear-gradient(180deg, #a78bfa 0%, #7c5cbf 100%)'
                        : 'linear-gradient(180deg, #fff 0%, #e8e4ef 100%)',
                      borderRight: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: '0 0 5px 5px',
                      display: 'flex', flexDirection: 'column',
                      justifyContent: 'flex-end', alignItems: 'center',
                      paddingBottom: 6, userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'background 0.06s',
                      position: 'relative',
                    }}
                  >
                    {isC && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: active ? '#fff' : '#999', pointerEvents: 'none' }}>
                        {noteName}
                      </span>
                    )}
                  </div>
                );
              })}

              {blacks.map((bk) => {
                const active = kbActiveKeys.has(bk.pitch);
                let whitesBefore = 0;
                for (let p = startPitch; p < bk.pitch; p++) {
                  if (![1,3,6,8,10].includes(p % 12)) whitesBefore++;
                }
                const leftPct = (whitesBefore - 0.3) * ww;
                return (
                  <div
                    key={bk.pitch}
                    onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); kbNoteOn(bk.pitch); }}
                    onTouchEnd={(e) => { e.preventDefault(); kbNoteOff(bk.pitch); }}
                    onTouchCancel={(e) => { e.preventDefault(); kbNoteOff(bk.pitch); }}
                    onMouseDown={(e) => { e.stopPropagation(); kbNoteOn(bk.pitch); }}
                    onMouseUp={() => kbNoteOff(bk.pitch)}
                    onMouseLeave={() => { if (kbActiveKeys.has(bk.pitch)) kbNoteOff(bk.pitch); }}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`, width: `${ww * 0.6}%`,
                      height: '60%', top: 0,
                      background: active
                        ? 'linear-gradient(180deg, #a78bfa 0%, #6b46c1 100%)'
                        : 'linear-gradient(180deg, #2a2a3e 0%, #111 100%)',
                      borderRadius: '0 0 4px 4px',
                      boxShadow: active ? '0 2px 8px rgba(167,139,250,0.4)' : '0 3px 6px rgba(0,0,0,0.5)',
                      zIndex: 10, userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'background 0.06s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══════ MIXER BOTTOM SHEET ══════ */}
      {showMixer && (
        <div style={st.mixerSheet}>
          <MixerPanel />
        </div>
      )}

      <style>{`
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        /* Dynamic viewport height: overrides the 100vh inline fallback on
           browsers that support dvh so the transport never hides under
           mobile browser chrome. */
        @supports (height: 100dvh) {
          .sonara-mobile-daw { height: 100dvh !important; }
        }
        /* Prevent overscroll/pull-to-refresh from exposing background */
        html, body { overscroll-behavior: none; }
      `}</style>
    </div>
  );
};

/* ── Styles ──────────────────────────────────────────── */

const st: Record<string, React.CSSProperties> = {
  container: {
    // 100vh as baseline; @supports rule in the injected <style> overrides with
    // 100dvh on browsers that support dynamic viewport units.
    height: '100vh',
    width: '100%', display: 'flex', flexDirection: 'column',
    background: '#0d0d1a', fontFamily: "'Poppins', sans-serif", color: '#fff', overflow: 'hidden',
    position: 'relative',
  },

  /* Top bar */
  topBar: {
    minHeight: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 8px', background: '#1a1a2e', borderBottom: '1px solid #2a2a4a', zIndex: 50,
    paddingTop: 'env(safe-area-inset-top)',
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 8, border: 'none', background: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  pill: {
    display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3,
  },
  pillBtn: {
    width: 34, height: 30, borderRadius: 8, border: 'none', background: 'none',
    color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s',
  },
  pillActive: {
    background: '#a78bfa', color: '#fff', boxShadow: '0 1px 6px rgba(167,139,250,0.4)',
  },

  /* Recording indicator */
  recIndicator: {
    height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 12px', background: 'rgba(231,76,60,0.15)', borderBottom: '1px solid rgba(231,76,60,0.3)',
    color: '#fff', fontSize: 12,
  },
  recDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#e74c3c',
    animation: 'pulse-rec 1s infinite',
    boxShadow: '0 0 6px rgba(231,76,60,0.6)',
  },

  projectNameBtn: {
    background: 'none', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
    fontFamily: "'Poppins', sans-serif", cursor: 'pointer', maxWidth: 180, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  nameInput: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid #a78bfa', borderRadius: 6,
    color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
    padding: '4px 10px', textAlign: 'center', width: 180, outline: 'none',
  },

  /* Ruler */
  rulerWrap: {
    height: 26, flexShrink: 0, display: 'flex', alignItems: 'center',
    background: '#1a1a2e', borderBottom: '1px solid #2a2a4a', overflow: 'hidden',
  },
  timeLabel: {
    width: 66, flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#a78bfa',
    textAlign: 'center', fontFamily: 'monospace', letterSpacing: 0.5,
  },
  rulerScroll: { flex: 1, overflowX: 'auto', overflowY: 'hidden', height: '100%', touchAction: 'pan-x' as const },
  barMark: {
    position: 'absolute', top: 2, fontSize: 9, color: 'rgba(255,255,255,0.3)',
    fontFamily: 'monospace', transform: 'translateX(2px)',
  },
  playhead: {
    position: 'absolute', top: 0, bottom: 0, width: 2, background: '#e74c3c',
    boxShadow: '0 0 8px rgba(231,76,60,0.5)', zIndex: 5, pointerEvents: 'none',
  },

  /* Track list */
  trackList: { flex: 1, overflowY: 'auto', overflowX: 'hidden' },
  trackRow: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', minHeight: 56,
    borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative',
    transition: 'all 0.15s',
  },
  trackInfo: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 4px',
    width: '100%', cursor: 'pointer',
  },
  trackIcon: {
    width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14, flexShrink: 0,
  },
  trackMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  trackName: { fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  trackPreset: { fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  renameInput: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid #a78bfa', borderRadius: 4,
    color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
    padding: '2px 6px', outline: 'none', width: '100%',
  },
  microBtn: {
    width: 24, height: 24, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.04)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
    fontFamily: "'Poppins', sans-serif", WebkitTapHighlightColor: 'transparent',
  },
  clipArea: {
    width: '100%', height: 38, overflowX: 'auto', overflowY: 'hidden',
    padding: '0 0 4px', position: 'relative', touchAction: 'pan-x' as const,
  },
  clipLabel: {
    fontSize: 8, fontWeight: 600, letterSpacing: 0.2,
    color: '#fff', padding: '2px 5px',
    whiteSpace: 'nowrap', overflow: 'hidden',
    position: 'relative', zIndex: 1,
  },

  /* Track context menu */
  trackMenu: {
    display: 'flex', gap: 6, padding: '4px 10px 8px', width: '100%', flexWrap: 'wrap',
  },
  tmBtn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent',
  },

  /* Add track */
  addSection: { padding: '10px 14px' },
  addBtn: {
    width: '100%', padding: '10px 0', borderRadius: 10,
    border: '1.5px dashed rgba(167,139,250,0.35)', background: 'none',
    color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Poppins', sans-serif", WebkitTapHighlightColor: 'transparent',
  },

  /* Undo bar */
  undoBar: {
    height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', background: '#141428', borderTop: '1px solid #2a2a4a',
  },
  undoBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12,
    fontWeight: 600, fontFamily: "'Poppins', sans-serif", cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', padding: '4px 8px',
  },
  undoTime: { fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },

  /* Transport */
  transport: {
    height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    background: '#1a1a2e', borderTop: '1px solid #2a2a4a', zIndex: 50,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  trBtn: {
    width: 40, height: 40, borderRadius: 10, border: 'none', background: 'none',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  recBtn: {
    width: 52, height: 52, borderRadius: '50%', border: '3px solid #e74c3c',
    background: 'rgba(231,76,60,0.1)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  playBtn: {
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 2px 12px rgba(167,139,250,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },

  /* Overlays */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  morePanel: {
    width: '100%', maxWidth: 400, background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
    borderRadius: '16px 16px 0 0', padding: '12px 0 calc(12px + env(safe-area-inset-bottom))',
    display: 'flex', flexDirection: 'column',
  },
  morePanelItem: {
    padding: '14px 24px', background: 'none', border: 'none', color: '#fff',
    fontSize: 15, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif", WebkitTapHighlightColor: 'transparent',
  },

  /* FX Sheet */
  fxSheet: {
    width: '100%', maxWidth: 420, maxHeight: '65vh', overflowY: 'auto',
    background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
    borderRadius: '16px 16px 0 0', padding: '0 0 calc(12px + env(safe-area-inset-bottom))',
  },
  fxHeader: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0,
    background: '#1a1a2e', zIndex: 5,
  },
  fxClose: {
    width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
  },
  fxRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', minHeight: 36,
  },
  fxLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', width: 70, flexShrink: 0 },
  fxSlider: { flex: 1, height: 4, accentColor: '#a78bfa', cursor: 'pointer' },
  fxVal: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', width: 46, textAlign: 'right', flexShrink: 0 },
  fxDivider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 16px' },
  filterToggle: {
    padding: '4px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700,
    color: '#fff', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent',
  },
  filterTypeBtn: {
    padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600,
    color: '#fff', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent',
  },

  /* Settings sheet */
  settingsSheet: {
    width: '100%', maxWidth: 420, maxHeight: '60vh', overflowY: 'auto',
    background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
    borderRadius: '16px 16px 0 0', padding: '0 0 calc(12px + env(safe-area-inset-bottom))',
  },
  settRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap',
  },
  settLabel: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', width: 60, flexShrink: 0 },
  settVal: { fontSize: 14, fontWeight: 700, color: '#a78bfa', minWidth: 40, textAlign: 'right' },
  settInput: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600,
    fontFamily: "'Poppins', sans-serif", padding: '6px 10px', outline: 'none',
  },
  keyGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1,
  },
  keyBtn: {
    width: 36, height: 30, borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  /* Piano roll overlay */
  pianoOverlay: {
    position: 'fixed', inset: 0, zIndex: 300, background: '#0d0d1a',
    display: 'flex', flexDirection: 'column',
  },

  /* Mixer bottom sheet */
  mixerSheet: {
    position: 'fixed', left: 0, right: 0,
    bottom: 'calc(84px + env(safe-area-inset-bottom))',
    zIndex: 100,
    maxHeight: '40vh', overflowY: 'auto',
  },

  /* New Track sheet */
  newTrackSheet: {
    width: '100%', maxWidth: 420, background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
    borderRadius: '16px 16px 0 0', padding: '0 0 calc(16px + env(safe-area-inset-bottom))',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)',
    margin: '10px auto 0',
  },
  newTrackTitle: {
    fontSize: 17, fontWeight: 700, color: '#fff', padding: '14px 20px 8px',
    fontFamily: "'Poppins', sans-serif", margin: 0,
  },
  newTrackRow: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', textAlign: 'left',
  },
  newTrackIcon: {
    width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 20, flexShrink: 0,
  },
  newTrackMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  newTrackLabel: {
    fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: "'Poppins', sans-serif",
    display: 'flex', alignItems: 'center', gap: 6,
  },
  newTrackBadge: {
    fontSize: 9, fontWeight: 700, color: '#a78bfa', letterSpacing: 0.5,
    padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(167,139,250,0.4)',
  },
  newTrackDesc: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'Poppins', sans-serif",
    marginTop: 1,
  },

  /* Instrument picker sheet */
  instrSheet: {
    width: '100%', maxWidth: 420, maxHeight: '75vh', display: 'flex', flexDirection: 'column',
    background: '#1a1a2e', borderTop: '1px solid #2a2a4a',
    borderRadius: '16px 16px 0 0', overflow: 'hidden',
  },
  instrCatRow: {
    display: 'flex', gap: 4, padding: '8px 12px', overflowX: 'auto', flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  instrCatBtn: {
    padding: '5px 12px', borderRadius: 14, border: 'none', fontSize: 11, fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
    whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent', flexShrink: 0,
  },
  instrCatActive: {
    background: '#a78bfa', color: '#fff',
  },
  instrList: {
    flex: 1, overflowY: 'auto', padding: '0 0 calc(12px + env(safe-area-inset-bottom))',
  },
  instrCatLabel: {
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1,
    textTransform: 'uppercase', padding: '10px 16px 4px',
  },
  instrRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%',
    border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
    WebkitTapHighlightColor: 'transparent', textAlign: 'left',
  },
  instrDot: {
    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, flexShrink: 0,
  },

  /* Keyboard overlay */
  keyboardOverlay: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250,
    display: 'flex', flexDirection: 'column',
    background: '#0d0d1a',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px 14px 0 0',
    boxShadow: '0 -6px 40px rgba(0,0,0,0.6)',
  },
  kbHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
  },
  kbInstrBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
    color: '#a78bfa', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    display: 'flex', alignItems: 'center',
  },
  kbOctBtn: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  kbOctLabel: {
    fontSize: 12, fontWeight: 600, color: '#fff', padding: '0 6px',
    minWidth: 40, textAlign: 'center' as const,
  },
  kbEditBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    color: '#a78bfa',
  },
  kbCloseBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    WebkitTapHighlightColor: 'transparent',
  },
  kbTransport: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
    background: 'rgba(255,255,255,0.02)',
  },
  kbTransBtn: {
    width: 32, height: 28, borderRadius: 6, border: 'none',
    background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    color: 'rgba(255,255,255,0.5)',
  },
  kbPiano: {
    position: 'relative', display: 'flex', height: 200, padding: 0,
    background: '#000', touchAction: 'none',
  },
};

export default MobileDaw;
