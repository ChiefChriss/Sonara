import React, { useState, useRef, useCallback, useEffect } from 'react';
import useDawStore from '../state/dawStore';
import { initAudio, play, pause, stop as engineStop, rewind as engineRewind, updateBpm } from '../engine/TransportSync';
import { decodeAudioFile } from '../utils/AudioUtils';
import * as Icons from './Icons';
import { PlayGlyph, PauseGlyph } from '../../components/MediaIcons';

const MIC_MIME = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_BPM = 20;
const MAX_BPM = 300;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

const Transport: React.FC = () => {
  const isPlaying = useDawStore((s) => s.isPlaying);
  const isRecording = useDawStore((s) => s.isRecording);
  const currentTime = useDawStore((s) => s.currentTime);
  const bpm = useDawStore((s) => s.bpm);
  const timeSignature = useDawStore((s) => s.timeSignature);
  const musicalKey = useDawStore((s) => s.musicalKey);
  const togglePlay = useDawStore((s) => s.togglePlay);
  const toggleRecord = useDawStore((s) => s.toggleRecord);
  const setBpm = useDawStore((s) => s.setBpm);
  const setMusicalKey = useDawStore((s) => s.setMusicalKey);
  const addAudioClip = useDawStore((s) => s.addAudioClip);
  const addTrack = useDawStore((s) => s.addTrack);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);

  const handleTogglePlay = async () => {
    await initAudio(); // Ensure audio context is started
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    togglePlay(); // Update store state
  };

  const handleStop = () => {
    engineStop();
    useDawStore.getState().stop(); // Reset store state
  };

  const handleRewind = () => {
    engineRewind();
    useDawStore.getState().rewind();
  };

  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    updateBpm(newBpm);
  };

  const startMicRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MIC_MIME });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: MIC_MIME });
        if (blob.size < 1000) return;

        const file = new File([blob], `Recording ${new Date().toLocaleTimeString()}`, { type: MIC_MIME });
        const curBpm = useDawStore.getState().bpm;
        const data = await decodeAudioFile(file, curBpm);

        const liveTracks = useDawStore.getState().tracks;
        const audioTracks = liveTracks.filter(t => t.type === 'audio');
        let targetTrackId: number;
        if (audioTracks.length > 0) {
          targetTrackId = audioTracks[audioTracks.length - 1].id;
        } else {
          addTrack('audio');
          const newTracks = useDawStore.getState().tracks;
          targetTrackId = newTracks[newTracks.length - 1].id;
        }

        const recordStartBeat = (recordStartTimeRef.current / 60) * curBpm;
        addAudioClip(targetTrackId, Math.max(0, recordStartBeat), data.name, data.durationBeats, data.url, data.peaks);
      };

      recordStartTimeRef.current = useDawStore.getState().currentTime;
      recorder.start(250);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Microphone access is required to record audio. Please allow mic access and try again.');
    }
  }, [addTrack, addAudioClip]);

  const stopMicRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const handleRecordToggle = async () => {
    await initAudio();
    if (isRecording) {
      stopMicRecording();
      toggleRecord();
    } else {
      if (!isPlaying) {
        play();
        togglePlay();
      }
      await startMicRecording();
      toggleRecord();
    }
  };

  const undo = useDawStore((s) => s.undo);
  const redo = useDawStore((s) => s.redo);
  const canUndo = useDawStore((s) => s.canUndo);
  const canRedo = useDawStore((s) => s.canRedo);
  const undoLabel = useDawStore((s) => s.undoLabel);
  const redoLabel = useDawStore((s) => s.redoLabel);
  const loopEnabled = useDawStore((s) => s.loopEnabled);
  const toggleLoop = useDawStore((s) => s.toggleLoop);

  return (
    <div className="daw-transport" style={styles.transportBar}>
      <div style={styles.transportLeft}>
        <button
          onClick={undo}
          style={{
            ...styles.transportIcon,
            color: canUndo ? '#ffffff' : '#555',
            cursor: canUndo ? 'pointer' : 'default',
          }}
          title={canUndo ? `Undo: ${undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
        >↶</button>
        <button
          onClick={redo}
          style={{
            ...styles.transportIcon,
            color: canRedo ? '#ffffff' : '#555',
            cursor: canRedo ? 'pointer' : 'default',
          }}
          title={canRedo ? `Redo: ${redoLabel} (Ctrl+Y)` : 'Nothing to redo'}
        >↷</button>
        <span style={styles.transportDivider}></span>
        <button
          onClick={toggleLoop}
          style={{
            ...styles.transportIcon,
            color: loopEnabled ? '#00d4ff' : '#ffffff',
            backgroundColor: loopEnabled ? 'rgba(0,212,255,0.15)' : 'transparent',
          }}
          title="Loop mode"
        ><Icons.Loop color={loopEnabled ? "#00d4ff" : "#ffffff"} size={16} /></button>
      </div>

      <div style={styles.transportCenter}>
        <button onClick={handleRewind} style={styles.transportButton}>
          ⏮
        </button>
        <button
          onClick={handleTogglePlay}
          style={{ ...styles.transportButton, ...styles.playButton }}
        >
          {isPlaying ? <PauseGlyph size={18} fill="#fff" /> : <PlayGlyph size={18} fill="#fff" />}
        </button>
        <button onClick={handleStop} style={styles.transportButton}>
          ⏭
        </button>
        <button
          onClick={handleRecordToggle}
          style={{
            ...styles.transportButton,
            ...styles.recordButton,
            ...(isRecording ? styles.recordButtonActive : {}),
          }}
          title={isRecording ? 'Stop recording' : 'Record mic to audio track'}
        >
          ●
        </button>
        <span style={styles.timeDisplay}>{formatTime(currentTime)}</span>
      </div>

      <div style={styles.transportRight}>
        <div style={styles.controlGroup}>
          <span style={styles.controlLabel}>{musicalKey}</span>
          <select
            value={musicalKey}
            onChange={(e) => setMusicalKey(e.target.value)}
            style={styles.controlSelect}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.controlGroup}>
          <BpmControl bpm={bpm} onChange={handleBpmChange} />
          <span style={styles.controlLabel}>bpm</span>
        </div>
        <div style={styles.controlGroup}>
          <span style={styles.controlLabel}>
            {timeSignature.numerator}/{timeSignature.denominator}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── BPM Control: drag to change, click to type ───

const BpmControl: React.FC<{ bpm: number; onChange: (bpm: number) => void }> = ({
  bpm,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0, startBpm: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Drag handling ───

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startBpm: bpm };
      setIsDragging(true);
    },
    [bpm, isEditing]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragRef.current.startY - e.clientY;
      // 2px = 1 BPM
      const deltaBpm = Math.round(deltaY / 2);
      const newBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, dragRef.current.startBpm + deltaBpm));
      onChange(newBpm);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange]);

  // ─── Text editing ───

  const startEditing = () => {
    setEditValue(String(bpm));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const parsed = parseInt(editValue, 10);
    if (isNaN(parsed) || editValue.trim() === '') {
      // Invalid — revert, don't set to 0
      return;
    }
    onChange(Math.max(MIN_BPM, Math.min(MAX_BPM, parsed)));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        style={styles.bpmInput}
        autoFocus
      />
    );
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={startEditing}
      style={{
        ...styles.bpmDisplay,
        cursor: isDragging ? 'ns-resize' : 'ns-resize',
      }}
    >
      {bpm}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  transportBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#252542',
    borderBottom: '1px solid #3a3a5e',
  },
  transportLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  transportCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  transportRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  transportIcon: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
  },
  transportDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: '#3a3a5e',
    margin: '0 8px',
  },
  transportButton: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '2px solid #3a3a5e',
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  playButton: {
    backgroundColor: '#1a1a2e',
  },
  recordButton: {
    color: '#e74c3c',
  },
  recordButtonActive: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    borderColor: '#e74c3c',
  },
  timeDisplay: {
    fontFamily: 'monospace',
    fontSize: '24px',
    fontWeight: 600,
    marginLeft: '16px',
    minWidth: '120px',
    color: '#ffffff',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  controlLabel: {
    fontSize: '14px',
    color: '#888',
  },
  controlSelect: {
    background: '#1a1a2e',
    border: '1px solid #3a3a5e',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  bpmDisplay: {
    width: '60px',
    background: '#1a1a2e',
    border: '1px solid #3a3a5e',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center' as const,
    fontFamily: "'Poppins', sans-serif",
    userSelect: 'none',
    fontWeight: 600,
  },
  bpmInput: {
    width: '60px',
    background: '#1a1a2e',
    border: '1px solid #00d4ff',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center' as const,
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
    fontWeight: 600,
  },
};

export default Transport;