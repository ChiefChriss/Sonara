import React, { useState, useEffect, useRef, useCallback } from 'react';
import useDawStore from '../state/dawStore';
import { previewNoteOn, previewNoteOff, previewNoteOffSingle, rebuildTrackSynth, setPreviewRelease, rebuildPreviewSynth } from '../engine/TransportSync';
import { getPresetsByCategory, getPreset } from '../models/presets';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Computer keyboard → note offset mapping (two rows = ~2 octaves)
// Bottom row: A-L,;,' for lower octave white keys
// Top row: Q-P for upper octave white keys
// Black keys: W,E,T,Y,U (upper) and S,D,G,H,J (lower)

const LOWER_ROW_MAP: Record<string, number> = {
  'a': 0,   // C
  'w': 1,   // C#
  's': 2,   // D
  'e': 3,   // D#
  'd': 4,   // E
  'f': 5,   // F
  't': 6,   // F#
  'g': 7,   // G
  'y': 8,   // G#
  'h': 9,   // A
  'u': 10,  // A#
  'j': 11,  // B
  'k': 12,  // C (next octave)
  'o': 13,  // C#
  'l': 14,  // D
  'p': 15,  // D#
  ';': 16,  // E
  "'": 17,  // F
};

const KEY_LABELS: Record<string, string> = {
  'a': 'A', 'w': 'W', 's': 'S', 'e': 'E', 'd': 'D', 'f': 'F',
  't': 'T', 'g': 'G', 'y': 'Y', 'h': 'H', 'u': 'U', 'j': 'J',
  'k': 'K', 'o': 'O', 'l': 'L', 'p': 'P', ';': ';', "'": "'",
};


interface KeyboardProps {
  clipId: number;
  trackId: number;
}

const Keyboard: React.FC<KeyboardProps> = ({ clipId, trackId }) => {
  const [octave, setOctave] = useState(4);
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);
  const tracks = useDawStore((s) => s.tracks);
  const isPlaying = useDawStore((s) => s.isPlaying);
  const isRecording = useDawStore((s) => s.isRecording);
  const currentTime = useDawStore((s) => s.currentTime);
  const bpm = useDawStore((s) => s.bpm);
  const setTrackInstrument = useDawStore((s) => s.setTrackInstrument);
  const addNote = useDawStore((s) => s.addNote);

  const track = tracks.find((t) => t.id === trackId);
  const clip = track?.clips.find((c) => c.id === clipId);

  // Track active note start times for recording
  const noteStartTimes = useRef<Map<number, number>>(new Map());
  // Track which computer keys are held and what pitch they triggered
  const heldKeys = useRef<Map<string, number>>(new Map());

  if (!track || !clip) return null;

  const getCurrentBeat = () => {
    return (currentTime / 60) * bpm;
  };

  const getBeatInClip = () => {
    return getCurrentBeat() - clip.startBeat;
  };

  // Track sustain release timers
  const sustainTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const SUSTAIN_HOLD_MS = 1200; // How long sustain extends the note

  // ─── Note On/Off ───

  const handleNoteOn = useCallback((pitch: number) => {
    // If there's a pending sustain release for this pitch, cancel it
    const existingTimer = sustainTimers.current.get(pitch);
    if (existingTimer) {
      clearTimeout(existingTimer);
      sustainTimers.current.delete(pitch);
    }

    // If note is already sounding (e.g. held by sustain), re-trigger it for tremolo
    if (activeKeys.has(pitch)) {
      previewNoteOffSingle(pitch);
    }

    setActiveKeys((prev) => new Set(prev).add(pitch));
    previewNoteOn(pitch, 100);

    // If recording, mark start time
    if (isPlaying && isRecording) {
      noteStartTimes.current.set(pitch, getBeatInClip());
    }
  }, [isPlaying, isRecording, currentTime, bpm, clip?.startBeat, activeKeys]);

  const releaseNote = useCallback((pitch: number) => {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(pitch);
      return next;
    });
    previewNoteOffSingle(pitch);

    // If recording, write the note
    if (isRecording && noteStartTimes.current.has(pitch)) {
      const startBeat = noteStartTimes.current.get(pitch)!;
      const endBeat = getBeatInClip();
      const duration = Math.max(0.25, endBeat - startBeat);
      noteStartTimes.current.delete(pitch);

      if (startBeat >= 0 && startBeat < (clip?.duration || 0)) {
        addNote(clipId, {
          pitch,
          startBeat: Math.round(startBeat * 4) / 4,
          duration: Math.round(duration * 4) / 4,
          velocity: 100,
        });
      }
    }
  }, [isRecording, currentTime, bpm, clip?.startBeat, clip?.duration, clipId, addNote]);

  const handleNoteOff = useCallback((pitch: number) => {
    if (sustain) {
      // Release the audio immediately — the long release envelope handles the fade
      previewNoteOffSingle(pitch);

      // Record the note if recording
      if (isRecording && noteStartTimes.current.has(pitch)) {
        const startBeat = noteStartTimes.current.get(pitch)!;
        const endBeat = getBeatInClip();
        const duration = Math.max(0.25, endBeat - startBeat);
        noteStartTimes.current.delete(pitch);

        if (startBeat >= 0 && startBeat < (clip?.duration || 0)) {
          addNote(clipId, {
            pitch,
            startBeat: Math.round(startBeat * 4) / 4,
            duration: Math.round(duration * 4) / 4,
            velocity: 100,
          });
        }
      }

      // Keep the visual highlight briefly then remove it
      const timer = setTimeout(() => {
        sustainTimers.current.delete(pitch);
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(pitch);
          return next;
        });
      }, 600);
      sustainTimers.current.set(pitch, timer);
      return;
    }

    releaseNote(pitch);
  }, [sustain, releaseNote, isRecording, currentTime, bpm, clip?.startBeat, clip?.duration, clipId, addNote]);

  // Rebuild preview synth when track/instrument changes (including switching clips)
  useEffect(() => {
    if (track) rebuildPreviewSynth(track.instrument);
  }, [trackId, track?.instrument]);

  // Clean up sustain timers on unmount
  useEffect(() => {
    return () => {
      sustainTimers.current.forEach((timer) => clearTimeout(timer));
      setPreviewRelease(0.6); // Reset to normal on unmount
    };
  }, []);

  // Update synth release time when sustain toggles
  useEffect(() => {
    setPreviewRelease(sustain ? 2.5 : 0.6);
  }, [sustain]);

  // ─── Keyboard input ───

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.repeat) return;

      // Shift hold = sustain on
      if (e.key === 'Shift') { setSustain(true); return; }

      const key = e.key.toLowerCase();

      // Octave controls (z/x or -/=)
      if (key === 'z' || (key === '-' && !e.ctrlKey && !e.metaKey)) { setOctave((o) => Math.max(1, o - 1)); return; }
      if (key === 'x' || (key === '=' && !e.ctrlKey && !e.metaKey)) { setOctave((o) => Math.min(7, o + 1)); return; }

      // Note mapping
      const offset = LOWER_ROW_MAP[key];
      if (offset !== undefined) {
        e.preventDefault();
        const pitch = (octave + 1) * 12 + offset; // +1 because MIDI octave starts at -1
        if (pitch >= 21 && pitch <= 108 && !heldKeys.current.has(key)) {
          heldKeys.current.set(key, pitch);
          handleNoteOn(pitch);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Shift release = sustain off
      if (e.key === 'Shift') { setSustain(false); return; }

      const key = e.key.toLowerCase();
      const heldPitch = heldKeys.current.get(key);
      if (heldPitch !== undefined) {
        heldKeys.current.delete(key);
        handleNoteOff(heldPitch);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octave, handleNoteOn, handleNoteOff]);

  // ─── Instrument change ───

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInstrument = e.target.value;
    setTrackInstrument(track.id, newInstrument);
    rebuildTrackSynth({ ...track, instrument: newInstrument });
    rebuildPreviewSynth(newInstrument);
    // Blur so keyboard keys don't interact with the dropdown
    e.target.blur();
  };

  // ─── Render piano keys ───

  const startPitch = (octave + 1) * 12; // C of current octave
  const numKeys = 25; // 2 octaves + 1

  const whiteKeys: { pitch: number; index: number }[] = [];
  const blackKeys: { pitch: number; leftPercent: number }[] = [];

  let whiteIndex = 0;
  for (let i = 0; i < numKeys; i++) {
    const pitch = startPitch + i;
    if (pitch > 108) break;
    const noteInOctave = pitch % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);

    if (isBlack) {
      // Position black key between white keys
      const leftPct = ((whiteIndex - 0.35) / Math.max(whiteKeys.length + 5, 15)) * 100;
      blackKeys.push({ pitch, leftPercent: leftPct });
    } else {
      whiteKeys.push({ pitch, index: whiteIndex });
      whiteIndex++;
    }
  }

  const whiteKeyWidth = 100 / whiteKeys.length;

  // Find keyboard labels for each pitch
  const getPitchKeyLabel = (pitch: number): string => {
    const offset = pitch - startPitch;
    for (const [key, off] of Object.entries(LOWER_ROW_MAP)) {
      if (off === offset) return KEY_LABELS[key] || '';
    }
    return '';
  };

  const isRecordingActive = isPlaying && isRecording;

  return (
    <div style={styles.container}>
      {/* ─── Top bar ─── */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.label}>Instrument</span>
          <select
            value={track.instrument}
            onChange={handleInstrumentChange}
            style={styles.instrumentSelect}
          >
            {Array.from(getPresetsByCategory()).map(([category, presets]) => (
              <optgroup key={category} label={category}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={styles.topBarCenter}>
          {isRecordingActive && (
            <span style={styles.recordingBadge}>● RECORDING</span>
          )}
        </div>

        <div style={styles.topBarRight}>
          <span style={styles.label}>Octave</span>
          <button
            onClick={() => setOctave((o) => Math.max(1, o - 1))}
            style={styles.octaveBtn}
          >
            −
          </button>
          <span style={styles.octaveDisplay}>{octave}</span>
          <button
            onClick={() => setOctave((o) => Math.min(7, o + 1))}
            style={styles.octaveBtn}
          >
            +
          </button>
          <button
            onMouseDown={() => setSustain(true)}
            onMouseUp={() => setSustain(false)}
            onMouseLeave={() => setSustain(false)}
            style={{
              ...styles.sustainBtn,
              backgroundColor: sustain ? '#00d4ff' : '#3a3a5e',
              color: sustain ? '#000' : '#fff',
            }}
          >
            Sustain
            <span style={{
              ...styles.shortcutHint,
              color: sustain ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.35)',
            }}>
              ⇧ Shift
            </span>
          </button>
        </div>
      </div>

      {/* ─── Piano ─── */}
      <div style={styles.pianoContainer}>
        {/* White keys */}
        {whiteKeys.map((wk, i) => {
          const active = activeKeys.has(wk.pitch);
          const isC = wk.pitch % 12 === 0;
          const label = getPitchKeyLabel(wk.pitch);
          const noteName = NOTE_NAMES[wk.pitch % 12] + Math.floor(wk.pitch / 12 - 1);

          return (
            <div
              key={wk.pitch}
              onMouseDown={() => handleNoteOn(wk.pitch)}
              onMouseUp={() => handleNoteOff(wk.pitch)}
              onMouseLeave={() => { if (activeKeys.has(wk.pitch)) handleNoteOff(wk.pitch); }}
              style={{
                ...styles.whiteKey,
                width: `${whiteKeyWidth}%`,
                backgroundColor: active ? '#00d4ff' : '#e8e8e8',
                borderLeft: i === 0 ? '1px solid #999' : 'none',
              }}
            >
              {isC && <span style={styles.cLabel}>{noteName}</span>}
              {label && (
                <span style={{
                  ...styles.keyLabel,
                  color: active ? '#000' : '#888',
                }}>
                  {label}
                </span>
              )}
            </div>
          );
        })}

        {/* Black keys */}
        {blackKeys.map((bk) => {
          const active = activeKeys.has(bk.pitch);
          const label = getPitchKeyLabel(bk.pitch);

          // Calculate position based on surrounding white keys
          const noteInOctave = bk.pitch % 12;
          // Find which white key index this black key sits after
          let whitesBefore = 0;
          for (let p = startPitch; p < bk.pitch; p++) {
            if (![1, 3, 6, 8, 10].includes(p % 12)) whitesBefore++;
          }
          const leftPct = (whitesBefore - 0.3) * whiteKeyWidth;

          return (
            <div
              key={bk.pitch}
              onMouseDown={(e) => { e.stopPropagation(); handleNoteOn(bk.pitch); }}
              onMouseUp={() => handleNoteOff(bk.pitch)}
              onMouseLeave={() => { if (activeKeys.has(bk.pitch)) handleNoteOff(bk.pitch); }}
              style={{
                ...styles.blackKey,
                left: `${leftPct}%`,
                width: `${whiteKeyWidth * 0.6}%`,
                backgroundColor: active ? '#00d4ff' : '#1a1a2e',
              }}
            >
              {label && (
                <span style={{
                  ...styles.blackKeyLabel,
                  color: active ? '#000' : '#888',
                }}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Bottom hint ─── */}
      <div style={styles.hint}>
        Use keyboard keys A-L for notes · Z/X to shift octave · Press Record + Play to capture notes
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#1a1a2e',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    backgroundColor: '#252542',
    borderBottom: '1px solid #3a3a5e',
    height: '38px',
    flexShrink: 0,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  topBarCenter: {
    display: 'flex',
    alignItems: 'center',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#888',
    fontWeight: 500,
  },
  instrumentSelect: {
    background: '#1a1a2e',
    border: '1px solid #3a3a5e',
    color: '#ffffff',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  recordingBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e74c3c',
    animation: 'none',
    letterSpacing: '1px',
  },
  octaveBtn: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '1px solid #3a3a5e',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  octaveDisplay: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    width: '20px',
    textAlign: 'center',
  },
  sustainBtn: {
    padding: '3px 10px',
    borderRadius: '4px',
    border: '1px solid #3a3a5e',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    marginLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    userSelect: 'none',
  },
  shortcutHint: {
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.3px',
  },
  pianoContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    padding: '8px 4px',
    minHeight: 0,
  },
  whiteKey: {
    height: '100%',
    borderRight: '1px solid #999',
    borderBottom: '1px solid #999',
    borderRadius: '0 0 4px 4px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: '8px',
    userSelect: 'none',
    transition: 'background-color 0.05s',
    position: 'relative',
  },
  blackKey: {
    position: 'absolute',
    height: '58%',
    top: '8px',
    borderRadius: '0 0 3px 3px',
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: '8px',
    userSelect: 'none',
    transition: 'background-color 0.05s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  cLabel: {
    position: 'absolute',
    top: '58%',
    fontSize: '10px',
    color: '#666',
    fontWeight: 500,
    pointerEvents: 'none',
  },
  keyLabel: {
    fontSize: '11px',
    fontWeight: 600,
    pointerEvents: 'none',
  },
  blackKeyLabel: {
    fontSize: '10px',
    fontWeight: 600,
    pointerEvents: 'none',
  },
  hint: {
    padding: '4px 16px',
    fontSize: '10px',
    color: '#555',
    textAlign: 'center',
    flexShrink: 0,
  },
};

export default Keyboard;