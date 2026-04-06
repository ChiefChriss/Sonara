import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useDawStore from './state/dawStore';
import { initAudio, dispose, play as enginePlay, pause as enginePause } from './engine/TransportSync';
import { decodeAudioFile } from './utils/AudioUtils';
import { createProject, saveProject, getProject } from './api/projectApi';
import MenuBar from './components/MenuBar';
import Transport from './components/Transport';
import TrackRow from './components/TrackRow';
import Timeline from './components/Timeline';
import PianoRoll from './components/PianoRoll';
import HistoryPanel from './components/HistoryPanel';
import MixerPanel from './components/MixerPanel';

const TRACK_LIST_WIDTH = 280;
const AUTOMATION_LANE_HEIGHT = 60;

const DAW = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const projectName = useDawStore((s) => s.projectName);
  const pianoRollClipId = useDawStore((s) => s.pianoRollClipId);
  const tracks = useDawStore((s) => s.tracks);
  const serverProjectId = useDawStore((s) => s.serverProjectId);
  const addTrack = useDawStore((s) => s.addTrack);

  const [automationOpen, setAutomationOpen] = useState<Set<number>>(new Set());
  const [dragTrackIdx, setDragTrackIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [emptyDropHover, setEmptyDropHover] = useState(false);
  const reorderTrack = useDawStore((s) => s.reorderTrack);
  const addAudioClip = useDawStore((s) => s.addAudioClip);
  const bpm = useDawStore((s) => s.bpm);
  const zoom = useDawStore((s) => s.zoom);
  const timeSignature = useDawStore((s) => s.timeSignature);

  const handleEmptyAreaDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setEmptyDropHover(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const isMidi = file.name.match(/\.(mid|midi)$/i);

    if (isMidi) {
      // Import MIDI — create instrument tracks
      try {
        const { parseMidiFile, midiToClipNotes } = await import('./engine/MidiParser');
        const buffer = await file.arrayBuffer();
        const parsed = parseMidiFile(buffer);

        for (const midiTrack of parsed.tracks) {
          const { notes, durationBeats } = midiToClipNotes(midiTrack, parsed.ticksPerBeat);
          if (notes.length === 0) continue;

          addTrack('instrument');
          await new Promise((r) => setTimeout(r, 0));
          const state = useDawStore.getState();
          const newTrack = state.tracks[state.tracks.length - 1];
          if (newTrack && newTrack.type !== 'audio') {
            const clipName = midiTrack.name || file.name.replace(/\.(mid|midi)$/i, '');
            state.importMidiClip(newTrack.id, 0, clipName, notes, durationBeats);
          }
        }
      } catch (err) {
        console.error('MIDI import failed:', err);
      }
    } else if (file.type.startsWith('audio/')) {
      // Create a new audio track
      addTrack('audio');
      await new Promise((r) => setTimeout(r, 0));
      const state = useDawStore.getState();
      const newTrack = state.tracks[state.tracks.length - 1];
      if (!newTrack || newTrack.type !== 'audio') return;
      const data = await decodeAudioFile(file, bpm);
      state.addAudioClip(newTrack.id, 0, data.name, data.durationBeats, data.url, data.peaks);
    }
  };

  const toggleAutomation = (trackId: number) => {
    setAutomationOpen((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  useEffect(() => {
    document.title = `${projectName} | Sonara DAW`;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) navigate('/login');
  }, [navigate, projectName]);

  // Load project from server on mount, or reset for a fresh project
  useEffect(() => {
    const id = projectId ? parseInt(projectId) : null;
    if (id) {
      getProject(id).then((proj) => {
        useDawStore.getState().setServerProjectId(proj.id);
        useDawStore.getState().loadProjectData(proj.data);
      }).catch((err) => {
        console.error('Failed to load project:', err);
      });
    } else {
      // Full reset for new project — clear tracks, undo history, editing state
      const s = useDawStore.getState();
      s.setServerProjectId(null);
      s.loadProjectData({
        projectName: '[Untitled]',
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        musicalKey: 'C',
        tracks: [],
      });
    }
  }, [projectId]);

  // Save project
  const handleSaveProject = useCallback(async () => {
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
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, []);

  useEffect(() => { return () => dispose(); }, []);

  // Auto-scroll back when clips are deleted and viewport is past content
  const prevFurthestRef = useRef(0);
  useEffect(() => {
    const beatsPerBar = timeSignature.numerator;
    const pixelsPerBeat = 50 * zoom;
    const furthestBeat = tracks.reduce((max, t) =>
      t.clips.reduce((m, c) => Math.max(m, c.startBeat + c.duration), max), 0);

    // Only act when content shrinks (clip deleted)
    if (furthestBeat < prevFurthestRef.current) {
      const scrollEl = document.querySelector('[data-scroll-container]');
      if (scrollEl) {
        const newMaxPx = (furthestBeat + 4 * beatsPerBar) * pixelsPerBeat;
        if (scrollEl.scrollLeft > newMaxPx) {
          scrollEl.scrollTo({ left: Math.max(0, newMaxPx - scrollEl.clientWidth / 2), behavior: 'smooth' });
        }
      }
    }
    prevFurthestRef.current = furthestBeat;
  }, [tracks, zoom, timeSignature]);

  const handleUserGesture = async () => {
    await initAudio();
    document.removeEventListener('click', handleUserGesture);
  };

  useEffect(() => {
    document.addEventListener('click', handleUserGesture);
    return () => document.removeEventListener('click', handleUserGesture);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const state = useDawStore.getState();

      // Play/Pause
      if (e.key === ' ') {
        e.preventDefault();
        if (state.isPlaying) {
          enginePause();
        } else {
          initAudio().then(() => enginePlay());
        }
        state.togglePlay();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (state.pianoRollClipId && state.selectedNoteIds.size > 0) {
          state.copyNotes();
        } else {
          state.copyClip();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (state.pianoRollClipId) {
          state.pasteNotes();
        } else {
          state.pasteClip();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        state.duplicateClip();
      }
      // Zoom
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        state.setZoom(Math.min(4, state.zoom + 0.25));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        state.setZoom(Math.max(0.25, state.zoom - 0.25));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        state.setZoom(1);
      }
      // Snap toggle
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        state.toggleSnap();
      }
      // History panel toggle
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        state.toggleHistoryPanel();
      }
      // Mixer toggle
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        state.toggleMixer();
      }
      // Save project
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveProject();
      }
      // Delete: notes if selected in piano roll, otherwise selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.pianoRollClipId && state.selectedNoteIds.size > 0) {
          // PianoRoll handler will handle this
          return;
        }
        if (state.selectedClipId) {
          e.preventDefault();
          state.deleteClip(state.selectedClipId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showHistoryPanel = useDawStore((s) => s.showHistoryPanel);

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Main content column */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <MenuBar />
          <Transport />

          {/*
        Single scroll container for everything.
        - Scrolls both X (timeline) and Y (tracks).
        - Track list column is position:sticky left:0, so it stays
          pinned to the left while horizontal scroll moves the timeline.
        - Because there's only ONE scrollable div, vertical alignment
          between track list and timeline is guaranteed.
      */}
          <div style={styles.scrollContainer} data-scroll-container>
            <div style={styles.scrollContent}>

              {/* ═══ Header row ═══ */}
              <div style={styles.headerRow}>
                <div style={styles.trackListHeader}>
                  <button onClick={() => addTrack('instrument')} style={styles.addTrackButton}>+ Instrument</button>
                  <button onClick={() => addTrack('audio')} style={styles.addTrackButton}>+ Audio</button>
                </div>
                <div style={styles.timelineHeaderCell}>
                  <Timeline mode="header" />
                </div>
              </div>

              {/* ═══ Track rows ═══ */}
              {(() => {
                const hasSolo = tracks.some((t) => t.solo);
                return tracks.map((track, index) => {
                  const isGrayed = hasSolo && !track.solo;
                  const isDragging = dragTrackIdx === index;
                  // dropTargetIdx represents the insertion gap: "insert before this index"
                  // Show line above this row if dropTargetIdx === index
                  // Show line below last row if dropTargetIdx === tracks.length
                  const showLineAbove = dropTargetIdx === index
                    && dragTrackIdx !== null
                    && dragTrackIdx !== index
                    && dragTrackIdx !== index - 1;
                  const showLineBelow = index === tracks.length - 1
                    && dropTargetIdx === tracks.length
                    && dragTrackIdx !== null
                    && dragTrackIdx !== tracks.length - 1;

                  return (
                    <React.Fragment key={track.id}>
                      <div
                        style={{
                          ...styles.bodyRow,
                          height: automationOpen.has(track.id) ? `${80 + 60}px` : '80px',
                          opacity: isDragging ? 0.4 : isGrayed ? 0.35 : 1,
                          transition: 'opacity 0.15s',
                          position: 'relative',
                          borderBottom: '1px solid #2a2a4e',
                        }}
                        data-track-row={track.id}
                        onDragOver={(e) => {
                          if (dragTrackIdx === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          // Determine if cursor is in top or bottom half
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const half = rect.height / 2;
                          if (y < half) {
                            setDropTargetIdx(index); // insert before this row
                          } else {
                            setDropTargetIdx(index + 1); // insert after this row
                          }
                        }}
                        onDragLeave={(e) => {
                          // Only clear if actually leaving the row (not entering a child)
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDropTargetIdx(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragTrackIdx !== null && dropTargetIdx !== null) {
                            // Calculate actual target: if dragging down, account for removal
                            let targetIdx = dropTargetIdx;
                            if (dragTrackIdx < targetIdx) targetIdx -= 1;
                            if (dragTrackIdx !== targetIdx) {
                              reorderTrack(dragTrackIdx, targetIdx);
                            }
                          }
                          setDragTrackIdx(null);
                          setDropTargetIdx(null);
                        }}
                      >
                        {/* Insertion indicator — above */}
                        {showLineAbove && (
                          <div style={styles.dropIndicator} />
                        )}

                        <div style={{
                          ...styles.trackListCell,
                          height: automationOpen.has(track.id) ? `${80 + 60}px` : '80px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}>
                          <div style={{ height: '80px', display: 'flex' }}>
                            {/* Drag handle */}
                            <div
                              draggable
                              onDragStart={(e) => {
                                setDragTrackIdx(index);
                                e.dataTransfer.effectAllowed = 'move';
                                const ghost = document.createElement('div');
                                ghost.style.opacity = '0';
                                document.body.appendChild(ghost);
                                e.dataTransfer.setDragImage(ghost, 0, 0);
                                setTimeout(() => document.body.removeChild(ghost), 0);
                              }}
                              onDragEnd={() => {
                                setDragTrackIdx(null);
                                setDropTargetIdx(null);
                              }}
                              style={styles.dragHandle}
                              title="Drag to reorder"
                            >
                              ⠿
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <TrackRow
                                trackId={track.id}
                                automationOpen={automationOpen.has(track.id)}
                                onToggleAutomation={() => toggleAutomation(track.id)}
                              />
                            </div>
                          </div>
                          {automationOpen.has(track.id) && (
                            <div style={styles.automationLabel}>
                              <span style={styles.automationLabelText}>Vol</span>
                            </div>
                          )}
                        </div>
                        <div style={styles.timelineCell}>
                          <Timeline
                            mode="track"
                            trackId={track.id}
                            showAutomation={automationOpen.has(track.id)}
                          />
                        </div>

                        {/* Insertion indicator — below last track */}
                        {showLineBelow && (
                          <div style={{ ...styles.dropIndicator, top: 'auto', bottom: '-2px' }} />
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
              })()}

              {/* ═══ Empty area drop zone for audio files ═══ */}
              <div
                style={{
                  ...styles.emptyDropZone,
                  ...(emptyDropHover ? styles.emptyDropZoneActive : {}),
                }}
                onDragOver={(e) => {
                  // Only respond to file drags, not track reorder drags
                  if (dragTrackIdx !== null) return;
                  if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setEmptyDropHover(true);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setEmptyDropHover(false);
                  }
                }}
                onDrop={handleEmptyAreaDrop}
              >
                {emptyDropHover ? (
                  <span style={styles.emptyDropText}>Drop file to create new track</span>
                ) : (
                  <span style={styles.emptyDropHint}>Drag audio or MIDI files here to add tracks</span>
                )}
              </div>
            </div>
          </div>

          {pianoRollClipId && <PianoRoll />}
          <MixerPanel />
        </div>
        {/* History panel as flex sibling */}
        <HistoryPanel />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #3a3a5e; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #4a4a7e; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    width: '100%',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffffff',
    overflow: 'hidden',
  },
  scrollContainer: {
    flex: 1,
    overflow: 'auto',
    minHeight: 0,
    position: 'relative',
  },
  scrollContent: {
    display: 'inline-block',
    minWidth: '100%',
  },
  /* ─── Rows ─── */
  headerRow: {
    display: 'flex',
    height: '32px',
    position: 'sticky',
    top: 0,
    zIndex: 30,
  },
  bodyRow: {
    display: 'flex',
  },
  /* ─── Track list cells (sticky left) ─── */
  trackListHeader: {
    width: `${TRACK_LIST_WIDTH}px`,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    backgroundColor: '#252542',
    borderBottom: '1px solid #3a3a5e',
    borderRight: '1px solid #3a3a5e',
    position: 'sticky',
    left: 0,
    zIndex: 20,
  },
  trackListCell: {
    width: `${TRACK_LIST_WIDTH}px`,
    flexShrink: 0,
    backgroundColor: '#1e1e38',
    borderRight: '1px solid #3a3a5e',
    position: 'sticky',
    left: 0,
    zIndex: 10,
  },
  /* ─── Timeline cells ─── */
  timelineHeaderCell: {
    height: '32px',
    backgroundColor: '#252542',
    borderBottom: '1px solid #3a3a5e',
    position: 'relative',
  },
  timelineCell: {
    position: 'relative',
  },
  /* ─── Automation label ─── */
  automationLabel: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '42px',
    borderTop: '1px solid #252542',
    backgroundColor: '#151528',
  },
  automationLabelText: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#00d4ff',
    opacity: 0.6,
  },
  /* ─── Buttons ─── */
  addTrackButton: {
    background: 'none',
    border: 'none',
    color: '#00d4ff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  trackTools: { display: 'flex', gap: '8px' },
  toolButton: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#3a3a5e',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    color: '#555',
    fontSize: '14px',
    userSelect: 'none',
    flexShrink: 0,
    borderRight: '1px solid #2a2a4e',
  },
  dropIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '-2px',
    height: '3px',
    backgroundColor: '#00d4ff',
    borderRadius: '2px',
    zIndex: 50,
    boxShadow: '0 0 8px rgba(0, 212, 255, 0.5)',
    pointerEvents: 'none',
  },
  emptyDropZone: {
    minHeight: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderTop: '1px solid #2a2a4e',
    transition: 'all 0.2s',
  },
  emptyDropZoneActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    border: '2px dashed rgba(0, 212, 255, 0.4)',
    borderRadius: '8px',
    margin: '8px',
    minHeight: '100px',
  },
  emptyDropText: {
    color: '#00d4ff',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: "'Poppins', sans-serif",
  },
  emptyDropHint: {
    color: '#3a3a5e',
    fontSize: '13px',
    fontFamily: "'Poppins', sans-serif",
  },
};

export default DAW;