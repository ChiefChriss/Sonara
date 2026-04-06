import React, { useRef, useCallback, useEffect, useState } from 'react';
import useDawStore from '../state/dawStore';
import { Clip } from '../models/types';
import { seek as seekTo } from '../engine/TransportSync';
import { decodeAudioFile } from '../utils/AudioUtils';
import { parseMidiFile, midiToClipNotes } from '../engine/MidiParser';
import AutomationLane from './AutomationLane';

const MIN_BARS = 32;
const RESIZE_HANDLE_WIDTH = 8;
const AUTOMATION_LANE_HEIGHT = 60;

// Waveform renderer for audio clips — smooth, colored, zoom-aware
const WaveformPreview: React.FC<{
  peaks: number[];
  color: string;
  widthPx: number;
  audioOffset?: number;       // beats trimmed from start
  audioDurationBeats?: number; // total original duration in beats
  clipDurationBeats: number;  // current visible duration
}> = ({ peaks, color, widthPx, audioOffset = 0, audioDurationBeats, clipDurationBeats }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || peaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 4;
    const w = Math.max(1, widthPx - padding * 2);
    const h = 54;
    const dpr = window.devicePixelRatio || 2;
    // Browser canvas size limit — cap to prevent silent failure
    const maxCanvasSize = 8192;
    const scale = Math.min(dpr, maxCanvasSize / w, maxCanvasSize / h);
    canvas.width = Math.floor(w * scale);
    canvas.height = Math.floor(h * scale);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, w, h);

    // Calculate which portion of peaks to show
    const totalBeats = audioDurationBeats || clipDurationBeats;
    const startFraction = audioOffset / totalBeats;
    const endFraction = (audioOffset + clipDurationBeats) / totalBeats;
    const startIdx = Math.floor(startFraction * peaks.length);
    const endIdx = Math.min(peaks.length, Math.ceil(endFraction * peaks.length));
    const visiblePeaks = peaks.slice(startIdx, endIdx);


    const mid = h / 2;

    // Interpolate peaks to pixel width for smooth rendering at any zoom
    const numPoints = Math.max(visiblePeaks.length, Math.floor(w));
    const interpolated: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const srcIdx = (i / numPoints) * visiblePeaks.length;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, visiblePeaks.length - 1);
      const t = srcIdx - lo;
      interpolated.push(visiblePeaks[lo] * (1 - t) + visiblePeaks[hi] * t);
    }

    // Waveform colors — use dark overlay + white highlights for contrast on any clip color
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
    fillGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.15)');
    fillGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    fillGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
    fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0.02)');

    // Upper half fill
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * w;
      const amp = interpolated[i] * mid * 0.85;
      ctx.lineTo(x, mid - amp);
    }
    ctx.lineTo(w, mid);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Lower half fill (mirror)
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * w;
      const amp = interpolated[i] * mid * 0.85;
      ctx.lineTo(x, mid + amp);
    }
    ctx.lineTo(w, mid);
    ctx.closePath();
    ctx.fill();

    // White outline strokes for definition
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 0.8;

    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * w;
      ctx.lineTo(x, mid - interpolated[i] * mid * 0.85);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      const x = (i / numPoints) * w;
      ctx.lineTo(x, mid + interpolated[i] * mid * 0.85);
    }
    ctx.stroke();

    // Subtle center line
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

  }, [peaks, color, widthPx, audioOffset, audioDurationBeats, clipDurationBeats]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: '12px',
        left: '4px',
        pointerEvents: 'none',
      }}
    />
  );
};

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

interface DragState {
  mode: DragMode;
  clipId: number;
  sourceTrackId: number;
  startMouseX: number;
  startMouseY: number;
  originalStartBeat: number;
  originalDuration: number;
}

interface TimelineProps {
  mode: 'header' | 'track';
  trackId?: number;
  showAutomation?: boolean;
}

const Timeline: React.FC<TimelineProps> = ({ mode, trackId, showAutomation }) => {
  const tracks = useDawStore((s) => s.tracks);
  const currentTime = useDawStore((s) => s.currentTime);
  const bpm = useDawStore((s) => s.bpm);
  const timeSignature = useDawStore((s) => s.timeSignature);
  const zoom = useDawStore((s) => s.zoom);
  const selectedClipId = useDawStore((s) => s.selectedClipId);
  const selectClip = useDawStore((s) => s.selectClip);
  const moveClip = useDawStore((s) => s.moveClip);
  const resizeClip = useDawStore((s) => s.resizeClip);
  const deleteClip = useDawStore((s) => s.deleteClip);
  const addClip = useDawStore((s) => s.addClip);
  const snapEnabled = useDawStore((s) => s.snapEnabled);
  const openPianoRoll = useDawStore((s) => s.openPianoRoll);
  const pianoRollClipId = useDawStore((s) => s.pianoRollClipId);

  const [dragState, setDragState] = useState<DragState | null>(null);

  const beatsPerBar = timeSignature.numerator;
  const pixelsPerBeat = 50 * zoom;
  const trackHeight = 80;
  const furthestBeat = tracks.reduce((max, t) =>
    t.clips.reduce((m, c) => Math.max(m, c.startBeat + c.duration), max), 0);
  const totalBars = Math.max(MIN_BARS, Math.ceil(furthestBeat / beatsPerBar) + 8);
  const totalWidth = totalBars * beatsPerBar * pixelsPerBeat;

  const playheadX = (currentTime / 60) * bpm * pixelsPerBeat;

  // ═══════════════════════════════════════════
  // HEADER MODE — bar numbers + playhead
  // ═══════════════════════════════════════════
  const loopEnabled = useDawStore((s) => s.loopEnabled);
  const loopStart = useDawStore((s) => s.loopStart);
  const loopEnd = useDawStore((s) => s.loopEnd);
  const setLoopRegion = useDawStore((s) => s.setLoopRegion);

  if (mode === 'header') {
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startBeat = startX / pixelsPerBeat;
      let didDrag = false;

      const handleMouseMove = (me: MouseEvent) => {
        const currentX = me.clientX - rect.left;
        const currentBeat = currentX / pixelsPerBeat;
        if (Math.abs(currentX - startX) > 5) {
          didDrag = true;
          setLoopRegion(
            Math.round(Math.min(startBeat, currentBeat)),
            Math.round(Math.max(startBeat, currentBeat))
          );
        }
      };

      const handleMouseUp = (me: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        if (!didDrag) {
          // Simple click — seek
          const x = me.clientX - rect.left;
          const beat = x / pixelsPerBeat;
          seekTo((beat / bpm) * 60);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const loopLeftPx = loopStart * pixelsPerBeat;
    const loopWidthPx = (loopEnd - loopStart) * pixelsPerBeat;

    return (
      <div
        style={{ width: `${totalWidth}px`, height: '100%', position: 'relative', cursor: 'pointer' }}
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Loop region highlight */}
        {loopEnabled && loopEnd > loopStart && (
          <div style={{
            position: 'absolute',
            left: `${loopLeftPx}px`,
            width: `${loopWidthPx}px`,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,212,255,0.15)',
            borderLeft: '2px solid #00d4ff',
            borderRight: '2px solid #00d4ff',
            pointerEvents: 'none',
            zIndex: 5,
          }} />
        )}
        {/* Playhead */}
        <div style={{ ...styles.playhead, left: `${playheadX}px` }} />
        {/* Bar markers */}
        {Array.from({ length: totalBars + 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.barMarker,
              left: `${i * beatsPerBar * pixelsPerBeat}px`,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // TRACK MODE — single track's clips
  // ═══════════════════════════════════════════

  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;

  const getCursorForPosition = (e: React.MouseEvent, clip: Clip): string => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const clipWidth = clip.duration * pixelsPerBeat;
    if (localX < RESIZE_HANDLE_WIDTH) return 'ew-resize';
    if (localX > clipWidth - RESIZE_HANDLE_WIDTH) return 'ew-resize';
    return 'grab';
  };

  const getDragMode = (e: React.MouseEvent, clip: Clip): DragMode => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const clipWidth = clip.duration * pixelsPerBeat;
    if (localX < RESIZE_HANDLE_WIDTH) return 'resize-left';
    if (localX > clipWidth - RESIZE_HANDLE_WIDTH) return 'resize-right';
    return 'move';
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clip.id);
    const dragMode = getDragMode(e, clip);
    setDragState({
      mode: dragMode,
      clipId: clip.id,
      sourceTrackId: track.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      originalStartBeat: clip.startBeat,
      originalDuration: clip.duration,
    });
  };

  const handleLaneClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectClip(null);
      // Seek playhead to click position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const beat = x / pixelsPerBeat;
      const timeInSeconds = (beat / bpm) * 60;
      seekTo(timeInSeconds);
    }
  };

  const handleLaneDoubleClick = (e: React.MouseEvent) => {
    if (track.type === 'audio') return; // audio clips added via import
    if (e.target === e.currentTarget) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      addClip(track.id, x / pixelsPerBeat);
    }
  };

  const addAudioClip = useDawStore((s) => s.addAudioClip);

  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    const hasFiles = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dropBeat = Math.max(0, snapEnabled ? Math.round(x / pixelsPerBeat) : x / pixelsPerBeat);

    const isMidi = file.name.match(/\.(mid|midi)$/i);

    if (isMidi && track.type !== 'audio') {
      // Import MIDI to instrument/drums track
      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseMidiFile(buffer);
        if (parsed.tracks.length > 0) {
          const midiTrack = parsed.tracks[0]; // Use first track with notes
          const { notes, durationBeats } = midiToClipNotes(midiTrack, parsed.ticksPerBeat);
          if (notes.length > 0) {
            const clipName = midiTrack.name || file.name.replace(/\.(mid|midi)$/i, '');
            useDawStore.getState().importMidiClip(track.id, dropBeat, clipName, notes, durationBeats);
          }
        }
      } catch (err) {
        console.error('MIDI import failed:', err);
      }
    } else if (!isMidi && track.type === 'audio' && file.type.startsWith('audio/')) {
      // Import audio to audio track
      const data = await decodeAudioFile(file, bpm);
      addAudioClip(track.id, dropBeat, data.name, data.durationBeats, data.url, data.peaks);
    }
  };

  const totalHeight = showAutomation ? 80 + AUTOMATION_LANE_HEIGHT : 80;

  return (
    <div
      style={{
        width: `${totalWidth}px`,
        height: `${totalHeight}px`,
        position: 'relative',
        opacity: track.muted ? 0.5 : 1,
      }}
    >
      {/* Playhead — spans full height including automation */}
      <div style={{ ...styles.playhead, left: `${playheadX}px` }} />

      {/* Clips area — 80px */}
      <div
        style={{
          position: 'relative',
          height: '80px',
          overflow: 'hidden',
          backgroundColor: dragOver ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
          outline: dragOver ? '2px dashed #00d4ff' : 'none',
          outlineOffset: '-2px',
          transition: 'background-color 0.15s',
        }}
        onClick={handleLaneClick}
        onDoubleClick={handleLaneDoubleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >

      {/* Clips */}
      {track.clips.map((clip) => {
        const isSelected = selectedClipId === clip.id;
        const isDragging = dragState?.clipId === clip.id;
        const isEditing = pianoRollClipId === clip.id;

        return (
          <div
            key={clip.id}
            onMouseDown={(e) => handleClipMouseDown(e, clip)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (track.type === 'instrument' || track.type === 'drums') {
                openPianoRoll(clip.id, track.id);
              }
            }}
            onMouseMove={(e) => {
              if (!dragState) {
                (e.currentTarget as HTMLElement).style.cursor = getCursorForPosition(e, clip);
              }
            }}
            style={{
              ...styles.clip,
              backgroundColor: track.color,
              left: `${clip.startBeat * pixelsPerBeat}px`,
              width: `${clip.duration * pixelsPerBeat}px`,
              boxShadow: isEditing
                ? 'inset 0 0 0 2px #ff4444, 0 0 8px rgba(255,68,68,0.4)'
                : isSelected
                ? 'inset 0 0 0 2px #ffffff'
                : isDragging
                ? '0 4px 16px rgba(0,0,0,0.4)'
                : 'none',
              opacity: isDragging ? 0.85 : 1,
              zIndex: isDragging ? 50 : isEditing ? 6 : isSelected ? 5 : 1,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            <div style={styles.resizeHandleLeft} />
            <span style={styles.clipName}>{clip.name}</span>

            {/* Mini note preview (MIDI clips) */}
            {clip.notes.length > 0 && (() => {
              const pitches = clip.notes.map((n) => n.pitch);
              const minPitch = Math.min(...pitches) - 1;
              const maxPitch = Math.max(...pitches) + 1;
              const pitchRange = Math.max(maxPitch - minPitch, 1);
              return (
                <div style={styles.notePreviewContainer}>
                  {clip.notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        position: 'absolute',
                        left: `${(note.startBeat / clip.duration) * 100}%`,
                        width: `${Math.max((note.duration / clip.duration) * 100, 0.5)}%`,
                        top: `${((maxPitch - note.pitch) / pitchRange) * 100}%`,
                        height: `${Math.max(100 / pitchRange, 2)}%`,
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        borderRadius: '1px',
                        minWidth: '2px',
                        minHeight: '2px',
                      }}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Waveform preview (audio clips) */}
            {clip.waveformPeaks && clip.waveformPeaks.length > 0 && (
              <WaveformPreview
                peaks={clip.waveformPeaks}
                color={track.color}
                widthPx={clip.duration * pixelsPerBeat}
                audioOffset={clip.audioOffset || 0}
                audioDurationBeats={clip.audioDurationBeats}
                clipDurationBeats={clip.duration}
              />
            )}

            {clip.notes.length === 0 && !clip.waveformPeaks && (
              <div style={styles.emptyClipLabel}>
                {track.type === 'audio' ? '♪ Audio' : 'Empty'}
              </div>
            )}

            <div style={styles.resizeHandleRight} />
          </div>
        );
      })}
      </div>

      {/* Automation lane — same container as playhead */}
      {showAutomation && (
        <div style={{ height: `${AUTOMATION_LANE_HEIGHT}px`, borderTop: '1px solid #252542' }}>
          <AutomationLane trackId={track.id} />
        </div>
      )}

      {/* Global drag handler */}
      <TimelineDragHandler
        dragState={dragState}
        setDragState={setDragState}
        pixelsPerBeat={pixelsPerBeat}
        trackHeight={trackHeight}
        snapEnabled={snapEnabled}
        pianoRollClipId={pianoRollClipId}
      />
    </div>
  );
};

// Separate component for global drag + keyboard handlers to avoid hooks-in-conditional issues
const TimelineDragHandler: React.FC<{
  dragState: DragState | null;
  setDragState: (s: DragState | null) => void;
  pixelsPerBeat: number;
  trackHeight: number;
  snapEnabled: boolean;
  pianoRollClipId: number | null;
}> = ({ dragState, setDragState, pixelsPerBeat, trackHeight, snapEnabled, pianoRollClipId }) => {
  const tracks = useDawStore((s) => s.tracks);
  const moveClip = useDawStore((s) => s.moveClip);
  const resizeClip = useDawStore((s) => s.resizeClip);
  const deleteClip = useDawStore((s) => s.deleteClip);
  const selectedClipId = useDawStore((s) => s.selectedClipId);
  const pushUndoSnapshot = useDawStore((s) => s.pushUndoSnapshot);
  const undoVersionRef = useRef(-1);

  // Reset undo version tracking when drag starts
  useEffect(() => {
    if (dragState) undoVersionRef.current = -1;
  }, [dragState?.clipId]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startMouseX;
      const deltaY = e.clientY - dragState.startMouseY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Don't start moving until past threshold
      if (dist < 5) return;

      // Push undo snapshot on first real movement, or again if undo happened mid-drag
      const currentVersion = useDawStore.getState().undoVersion;
      if (undoVersionRef.current !== currentVersion) {
        const label = dragState.mode === 'move' ? 'Move Clip' : 'Resize Clip';
        pushUndoSnapshot(label);
        undoVersionRef.current = useDawStore.getState().undoVersion;
      }

      const deltaBeat = deltaX / pixelsPerBeat;

      if (dragState.mode === 'move') {
        let newStartBeat = dragState.originalStartBeat + deltaBeat;
        if (snapEnabled) newStartBeat = Math.round(newStartBeat);
        newStartBeat = Math.max(0, newStartBeat);

        // Find which track row we're hovering over
        const scrollContainer = document.querySelector('[data-scroll-container]');
        if (scrollContainer) {
          const rows = scrollContainer.querySelectorAll('[data-track-row]');
          for (let i = 0; i < rows.length; i++) {
            const rect = rows[i].getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY < rect.bottom) {
              const tid = Number(rows[i].getAttribute('data-track-row'));
              if (tid) moveClip(dragState.clipId, newStartBeat, tid);
              break;
            }
          }
        }
      } else if (dragState.mode === 'resize-right') {
        let newDuration = dragState.originalDuration + deltaBeat;
        if (snapEnabled) newDuration = Math.round(newDuration);
        resizeClip(dragState.clipId, Math.max(1, newDuration), false);
      } else if (dragState.mode === 'resize-left') {
        let newDuration = dragState.originalDuration - deltaBeat;
        if (snapEnabled) newDuration = Math.round(newDuration);
        resizeClip(dragState.clipId, Math.max(1, newDuration), true);
      }
    },
    [dragState, pixelsPerBeat, snapEnabled, tracks, moveClip, resizeClip, pushUndoSnapshot]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState) setDragState(null);
  }, [dragState, setDragState]);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pianoRollClipId !== null) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId !== null) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        deleteClip(selectedClipId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, deleteClip, pianoRollClipId]);

  return null; // Render nothing, just manages effects
};

const styles: { [key: string]: React.CSSProperties } = {
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#00d4ff',
    zIndex: 20,
    pointerEvents: 'none',
  },
  barMarker: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '12px',
    color: '#888',
  },
  clip: {
    position: 'absolute',
    top: '8px',
    height: 'calc(100% - 16px)',
    borderRadius: '6px',
    overflow: 'hidden',
    transition: 'box-shadow 0.15s, outline 0.15s',
    userSelect: 'none',
  },
  resizeHandleLeft: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: `${RESIZE_HANDLE_WIDTH}px`,
    cursor: 'ew-resize',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  resizeHandleRight: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: `${RESIZE_HANDLE_WIDTH}px`,
    cursor: 'ew-resize',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  clipName: {
    position: 'absolute',
    top: '3px', left: '10px',
    fontSize: '10px', fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    pointerEvents: 'none', zIndex: 3,
    letterSpacing: '0.2px',
  },
  notePreviewContainer: {
    position: 'absolute',
    top: '18px', bottom: '4px', left: '6px', right: '6px',
    pointerEvents: 'none', zIndex: 1,
  },
  emptyClipLabel: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
    pointerEvents: 'none',
  },
};

export default Timeline;