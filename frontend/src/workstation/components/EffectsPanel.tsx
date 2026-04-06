import React, { useCallback } from 'react';
import useDawStore from '../state/dawStore';
import { TrackEffects, DEFAULT_EFFECTS } from '../models/types';
import { updateEffects } from '../engine/TransportSync';
import * as Icons from './Icons';

interface EffectsPanelProps {
  trackId: number;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ trackId }) => {
  const track = useDawStore((s) => s.tracks.find((t) => t.id === trackId));
  const setTrackEffects = useDawStore((s) => s.setTrackEffects);
  const pushUndoSnapshot = useDawStore((s) => s.pushUndoSnapshot);

  if (!track) return null;

  const fx = track.effects || DEFAULT_EFFECTS;

  const update = useCallback((changes: Partial<TrackEffects>) => {
    setTrackEffects(trackId, changes);
    // Apply to audio engine immediately
    const updatedTrack = {
      ...track,
      effects: { ...fx, ...changes },
    };
    updateEffects(updatedTrack);
  }, [trackId, track, fx, setTrackEffects]);

  const snapshot = useCallback((label: string) => {
    pushUndoSnapshot(label);
  }, [pushUndoSnapshot]);

  return (
    <div style={styles.container}>
      <div style={styles.effectsGrid}>
        {/* ─── Reverb ─── */}
        <div style={styles.effectCard}>
          <div style={styles.effectHeader}>
            <span style={styles.effectTitle}><Icons.Reverb color="#00d4ff" size={14} /> Reverb</span>
            <span style={styles.effectValue}>{fx.reverbMix}%</span>
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Mix</label>
            <input
              type="range" min={0} max={100} value={fx.reverbMix}
              onMouseDown={() => snapshot('Change Reverb')}
              onChange={(e) => update({ reverbMix: Number(e.target.value) })}
              style={styles.slider}
            />
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Decay</label>
            <input
              type="range" min={1} max={100} value={fx.reverbDecay * 10}
              onMouseDown={() => snapshot('Change Reverb')}
              onChange={(e) => update({ reverbDecay: Number(e.target.value) / 10 })}
              style={styles.slider}
            />
            <span style={styles.valueLabel}>{fx.reverbDecay.toFixed(1)}s</span>
          </div>
        </div>

        {/* ─── Delay ─── */}
        <div style={styles.effectCard}>
          <div style={styles.effectHeader}>
            <span style={styles.effectTitle}><Icons.Delay color="#00d4ff" size={14} /> Delay</span>
            <span style={styles.effectValue}>{fx.delayMix}%</span>
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Mix</label>
            <input
              type="range" min={0} max={100} value={fx.delayMix}
              onMouseDown={() => snapshot('Change Delay')}
              onChange={(e) => update({ delayMix: Number(e.target.value) })}
              style={styles.slider}
            />
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Time</label>
            <input
              type="range" min={1} max={100} value={fx.delayTime * 100}
              onMouseDown={() => snapshot('Change Delay')}
              onChange={(e) => update({ delayTime: Number(e.target.value) / 100 })}
              style={styles.slider}
            />
            <span style={styles.valueLabel}>{(fx.delayTime * 1000).toFixed(0)}ms</span>
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Feedback</label>
            <input
              type="range" min={0} max={90} value={fx.delayFeedback}
              onMouseDown={() => snapshot('Change Delay')}
              onChange={(e) => update({ delayFeedback: Number(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.valueLabel}>{fx.delayFeedback}%</span>
          </div>
        </div>

        {/* ─── Filter ─── */}
        <div style={styles.effectCard}>
          <div style={styles.effectHeader}>
            <span style={styles.effectTitle}><Icons.Filter color="#00d4ff" size={14} /> Filter</span>
            <button
              onClick={() => { snapshot('Toggle Filter'); update({ filterEnabled: !fx.filterEnabled }); }}
              style={{
                ...styles.toggleBtn,
                backgroundColor: fx.filterEnabled ? '#00d4ff' : '#3a3a5e',
                color: fx.filterEnabled ? '#000' : '#888',
              }}
            >
              {fx.filterEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Type</label>
            <div style={styles.filterTypeGroup}>
              {(['lowpass', 'highpass', 'bandpass'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { snapshot('Change Filter Type'); update({ filterType: type }); }}
                  style={{
                    ...styles.filterTypeBtn,
                    backgroundColor: fx.filterType === type ? '#3a3a5e' : 'transparent',
                    color: fx.filterType === type ? '#fff' : '#666',
                  }}
                >
                  {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.knobRow}>
            <label style={styles.knobLabel}>Freq</label>
            <input
              type="range" min={0} max={100}
              value={Math.log10(fx.filterFreq / 20) / Math.log10(1000) * 100}
              onMouseDown={() => snapshot('Change Filter')}
              onChange={(e) => {
                const normalized = Number(e.target.value) / 100;
                const freq = 20 * Math.pow(1000, normalized);
                update({ filterFreq: Math.round(freq) });
              }}
              style={styles.slider}
              disabled={!fx.filterEnabled}
            />
            <span style={styles.valueLabel}>
              {fx.filterFreq >= 1000
                ? `${(fx.filterFreq / 1000).toFixed(1)}kHz`
                : `${fx.filterFreq}Hz`}
            </span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div style={styles.hint}>
        Effects apply to track: {track.name}
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
    padding: '12px 16px',
    overflow: 'auto',
  },
  effectsGrid: {
    display: 'flex',
    gap: '12px',
    flex: 1,
  },
  effectCard: {
    flex: 1,
    backgroundColor: '#252542',
    borderRadius: '8px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  effectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  effectTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  effectValue: {
    fontSize: '11px',
    color: '#00d4ff',
    fontWeight: 600,
  },
  knobRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  knobLabel: {
    fontSize: '11px',
    color: '#888',
    width: '52px',
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    height: '4px',
    cursor: 'pointer',
    accentColor: '#00d4ff',
  },
  valueLabel: {
    fontSize: '10px',
    color: '#666',
    width: '42px',
    textAlign: 'right',
    flexShrink: 0,
  },
  toggleBtn: {
    padding: '2px 8px',
    borderRadius: '3px',
    border: 'none',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  filterTypeGroup: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    padding: '2px',
  },
  filterTypeBtn: {
    padding: '2px 8px',
    borderRadius: '3px',
    border: 'none',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  hint: {
    fontSize: '10px',
    color: '#555',
    textAlign: 'center',
    marginTop: '8px',
    flexShrink: 0,
  },
};

export default EffectsPanel;