import React, { useCallback, useRef, useState, useEffect } from 'react';
import useDawStore from '../state/dawStore';
import * as Icons from './Icons';
import { updateTrackParams } from '../engine/TransportSync';

// ─── Pan Knob ───

const PanKnob: React.FC<{
  value: number; // -100 to 100
  onChange: (v: number) => void;
  onDragStart?: () => void;
  size?: number;
  color?: string;
}> = ({ value, onChange, onDragStart, size = 32, color = '#00d4ff' }) => {
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    const startX = e.clientX;
    const startVal = value;

    const handleMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * 1.5;
      onChange(Math.max(-100, Math.min(100, Math.round(startVal + delta))));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [value, onChange, onDragStart]);

  // Angle: -135 (full left) to +135 (full right)
  const angle = (value / 100) * 135;
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (angle - 90) * (Math.PI / 180);
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);

  return (
    <div
      ref={knobRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onChange(0)}
      title={`Pan: ${value > 0 ? value + 'R' : value < 0 ? Math.abs(value) + 'L' : 'C'}`}
      style={{ cursor: 'ew-resize', width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a4a" strokeWidth="2" />
        {/* Center tick */}
        <line x1={cx} y1={2} x2={cx} y2={5} stroke="#555" strokeWidth="1" />
        {/* Pointer */}
        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2" fill={color} />
      </svg>
    </div>
  );
};

// ─── Vertical Fader ───

const Fader: React.FC<{
  value: number; // 0-100
  onChange: (v: number) => void;
  onDragStart?: () => void;
  color: string;
  height?: number;
}> = ({ value, onChange, onDragStart, color, height = 140 }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart?.();
    const update = (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      onChange(Math.round(ratio * 100));
    };

    update(e.clientY);

    const handleMove = (ev: MouseEvent) => update(ev.clientY);
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [onChange, onDragStart]);

  const fillHeight = (value / 100) * height;
  const thumbY = height - fillHeight;

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onChange(75)}
      title={`Volume: ${value}%`}
      style={{
        width: 8,
        height,
        background: '#1a1a2e',
        borderRadius: 4,
        position: 'relative',
        cursor: 'pointer',
        border: '1px solid #2a2a4a',
      }}
    >
      {/* Fill */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${fillHeight}px`,
        background: `linear-gradient(to top, ${color}88, ${color})`,
        borderRadius: '0 0 3px 3px',
        transition: 'height 0.05s',
      }} />
      {/* Thumb */}
      <div style={{
        position: 'absolute',
        top: `${thumbY - 5}px`,
        left: -4,
        width: 16,
        height: 10,
        background: '#e0e0e0',
        borderRadius: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        border: '1px solid #aaa',
      }} />
      {/* dB scale marks */}
      {[0, 25, 50, 75, 100].map((mark) => (
        <div
          key={mark}
          style={{
            position: 'absolute',
            right: -14,
            top: `${height - (mark / 100) * height - 1}px`,
            width: 6,
            height: 1,
            background: '#444',
          }}
        />
      ))}
    </div>
  );
};

// ─── Channel Strip ───

const ChannelStrip: React.FC<{ trackId: number }> = ({ trackId }) => {
  const track = useDawStore((s) => s.tracks.find((t) => t.id === trackId));
  const toggleMute = useDawStore((s) => s.toggleMute);
  const toggleSolo = useDawStore((s) => s.toggleSolo);
  const setTrackVolume = useDawStore((s) => s.setTrackVolume);
  const setTrackPan = useDawStore((s) => s.setTrackPan);
  const pushUndoSnapshot = useDawStore((s) => s.pushUndoSnapshot);

  if (!track) return null;

  const hasSolo = useDawStore((s) => s.tracks.some((t) => t.solo));
  const isMuted = track.muted || (hasSolo && !track.solo);
  const TrackIcon = track.type === 'audio' ? Icons.Microphone : track.type === 'drums' ? Icons.Drums : Icons.Piano;

  return (
    <div style={styles.strip}>
      {/* Track icon & name */}
      <div style={{ ...styles.stripIcon, backgroundColor: track.color }}>
        <TrackIcon color="#fff" size={12} />
      </div>
      <div style={styles.stripName} title={track.name}>
        {track.name}
      </div>

      {/* Pan knob */}
      <div style={styles.controlSection}>
        <span style={styles.controlLabel}>Pan</span>
        <PanKnob
          value={track.pan}
          onChange={(v) => {
            setTrackPan(trackId, v);
            setTimeout(() => {
              const t = useDawStore.getState().tracks.find((tr) => tr.id === trackId);
              if (t) updateTrackParams(t);
            }, 0);
          }}
          onDragStart={() => pushUndoSnapshot('Change Pan')}
          color={track.color}
          size={28}
        />
        <span style={styles.controlValue}>
          {track.pan === 0 ? 'C' : track.pan > 0 ? `${track.pan}R` : `${Math.abs(track.pan)}L`}
        </span>
      </div>

      {/* Volume fader */}
      <div style={styles.faderSection}>
        <Fader
          value={track.volume}
          onChange={(v) => {
            setTrackVolume(trackId, v);
            setTimeout(() => {
              const t = useDawStore.getState().tracks.find((tr) => tr.id === trackId);
              if (t) updateTrackParams(t);
            }, 0);
          }}
          onDragStart={() => pushUndoSnapshot('Change Volume')}
          color={track.color}
        />
        <span style={styles.faderValue}>{track.volume}</span>
      </div>

      {/* Mute / Solo */}
      <div style={styles.buttonRow}>
        <button
          onClick={() => toggleMute(trackId)}
          style={{
            ...styles.msButton,
            backgroundColor: track.muted ? '#e74c3c' : 'transparent',
            color: track.muted ? '#fff' : '#888',
            borderColor: track.muted ? '#e74c3c' : '#3a3a5e',
          }}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={() => toggleSolo(trackId)}
          style={{
            ...styles.msButton,
            backgroundColor: track.solo ? '#f39c12' : 'transparent',
            color: track.solo ? '#fff' : '#888',
            borderColor: track.solo ? '#f39c12' : '#3a3a5e',
          }}
          title="Solo"
        >
          S
        </button>
      </div>

      {/* Muted indicator */}
      {isMuted && (
        <div style={styles.mutedOverlay} />
      )}
    </div>
  );
};

// ─── Mixer Panel ───

const MixerPanel: React.FC = () => {
  const showMixer = useDawStore((s) => s.showMixer);
  const toggleMixer = useDawStore((s) => s.toggleMixer);
  const tracks = useDawStore((s) => s.tracks);

  // Slide animation
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (showMixer) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [showMixer]);

  if (!mounted) return null;

  return (
    <div style={{
      ...styles.panel,
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
    }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Icons.Vel color="#00d4ff" size={14} />
          <span style={styles.headerTitle}>Mixer</span>
          <span style={styles.trackCount}>{tracks.length} tracks</span>
        </div>
        <button onClick={toggleMixer} style={styles.closeBtn}>✕</button>
      </div>

      {/* Channel strips */}
      <div style={styles.strips}>
        {tracks.map((track) => (
          <ChannelStrip key={track.id} trackId={track.id} />
        ))}

        {/* Master bus */}
        <div style={{ ...styles.strip, ...styles.masterStrip }}>
          <div style={styles.stripIcon}>
            <Icons.Volume color="#00d4ff" size={12} />
          </div>
          <div style={{ ...styles.stripName, color: '#00d4ff', fontWeight: 600 }}>Master</div>
          <div style={styles.controlSection}>
            <span style={styles.controlLabel}>Pan</span>
            <PanKnob value={0} onChange={() => {}} color="#00d4ff" size={28} />
            <span style={styles.controlValue}>C</span>
          </div>
          <div style={styles.faderSection}>
            <Fader value={100} onChange={() => {}} color="#00d4ff" />
            <span style={styles.faderValue}>100</span>
          </div>
          <div style={styles.buttonRow} />
        </div>
      </div>
    </div>
  );
};

// ─── Styles ───

const styles: Record<string, React.CSSProperties> = {
  panel: {
    height: '300px',
    flexShrink: 0,
    backgroundColor: '#16162a',
    borderTop: '2px solid #3a3a5e',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Poppins', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    backgroundColor: '#1e1e38',
    borderBottom: '1px solid #2a2a4a',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  trackCount: {
    fontSize: '10px',
    color: '#666',
    background: '#2a2a4a',
    borderRadius: 8,
    padding: '1px 7px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
  },
  strips: {
    flex: 1,
    display: 'flex',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '8px 8px',
    gap: 2,
  },
  strip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    minWidth: 64,
    width: 64,
    background: '#1a1a32',
    borderRadius: 6,
    position: 'relative',
    flexShrink: 0,
  },
  masterStrip: {
    borderLeft: '2px solid #3a3a5e',
    marginLeft: 6,
    background: '#1a1a38',
  },
  stripIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripName: {
    fontSize: '9px',
    color: '#ccc',
    fontWeight: 500,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
    maxWidth: 56,
  },
  controlSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  controlLabel: {
    fontSize: '7px',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  controlValue: {
    fontSize: '8px',
    color: '#888',
    fontWeight: 500,
  },
  faderSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  faderValue: {
    fontSize: '9px',
    color: '#888',
    fontWeight: 600,
  },
  buttonRow: {
    display: 'flex',
    gap: 3,
    minHeight: 20,
  },
  msButton: {
    width: 22,
    height: 18,
    border: '1px solid #3a3a5e',
    borderRadius: 3,
    fontSize: '9px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    padding: 0,
    lineHeight: 1,
  },
  mutedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    pointerEvents: 'none',
  },
};

export default MixerPanel;