import React, { useEffect, useRef, useState } from 'react';
import useDawStore from '../state/dawStore';
import * as Icons from './Icons';

// Icon map for action labels — returns React elements
const ACTION_ICONS: Record<string, React.FC<{ color?: string }>> = {
  'Add Track': Icons.Plus,
  'Delete Track': Icons.Trash,
  'Rename Track': Icons.Pencil,
  'Reorder Track': Icons.Reorder,
  'Duplicate Track': Icons.Duplicate,
  'Change Color': Icons.Palette,
  'Change Instrument': Icons.Piano,
  'Toggle Mute': Icons.Mute,
  'Toggle Solo': Icons.Solo,
  'Set Volume': Icons.Volume,
  'Change Volume': Icons.Volume,
  'Set Pan': Icons.Pan,
  'Change Pan': Icons.Pan,
  'Add Clip': Icons.Clip,
  'Delete Clip': Icons.Scissors,
  'Move Clip': Icons.Pan,
  'Resize Clip': Icons.Pan,
  'Add Note': Icons.Note,
  'Add Notes': Icons.Note,
  'Delete Notes': Icons.Trash,
  'Move Notes': Icons.Pan,
  'Resize Notes': Icons.Pan,
  'Paste Notes': Icons.Duplicate,
  'Record Notes': Icons.Record,
  'Set BPM': Icons.Clock,
  'Change Effects': Icons.Knobs,
  'Change Reverb': Icons.Reverb,
  'Change Delay': Icons.Delay,
  'Change Filter': Icons.Filter,
  'Change Filter Type': Icons.Filter,
  'Toggle Filter': Icons.Filter,
  'Quantize': Icons.Quantize,
  'Humanize': Icons.Humanize,
  'Add Audio Clip': Icons.Microphone,
  'Paste Clip': Icons.Duplicate,
  'Automation': Icons.Automation,
  'Initial State': Icons.Doc,
  'Rename Clip': Icons.Pencil,
  'Change Velocity': Icons.Vel,
};

const getIcon = (label: string): React.FC<{ color?: string }> | null => {
  for (const [key, IconComp] of Object.entries(ACTION_ICONS)) {
    if (label.includes(key) || label.toLowerCase().includes(key.toLowerCase())) return IconComp;
  }
  return null;
};

const HistoryPanel: React.FC = () => {
  const showHistoryPanel = useDawStore((s) => s.showHistoryPanel);
  const toggleHistoryPanel = useDawStore((s) => s.toggleHistoryPanel);
  const getHistoryList = useDawStore((s) => s.getHistoryList);
  const jumpToHistory = useDawStore((s) => s.jumpToHistory);
  const undoVersion = useDawStore((s) => s.undoVersion);

  const listRef = useRef<HTMLDivElement>(null);

  // Track mounted state for unmount animation
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (showHistoryPanel) {
      setMounted(true);
      // Trigger animation on next frame so the initial transform applies first
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      // Wait for transition to finish before unmounting
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [showHistoryPanel]);

  // Re-derive on every undo version change
  const { labels, currentIndex } = getHistoryList();

  // Auto-scroll to current entry
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [undoVersion]);

  if (!mounted) return null;

  return (
    <div style={{
      width: visible ? 240 : 0,
      minWidth: visible ? 240 : 0,
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
    }}>
    <div style={{
      ...styles.panel,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s ease',
    }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>History</span>
        <span style={styles.headerCount}>{labels.length}</span>
        <button onClick={toggleHistoryPanel} style={styles.closeBtn}>✕</button>
      </div>

      {/* Scrollable list */}
      <div ref={listRef} style={styles.list}>
        {labels.map((label, i) => {
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          return (
            <div
              key={i}
              data-active={isCurrent ? 'true' : undefined}
              onClick={() => jumpToHistory(i)}
              style={{
                ...styles.entry,
                ...(isCurrent ? styles.entryCurrent : {}),
                ...(isFuture ? styles.entryFuture : {}),
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.background = isFuture
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(0,212,255,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.background = isFuture
                    ? 'transparent'
                    : 'transparent';
                }
              }}
            >
              <span style={styles.entryIcon}>
                {(() => {
                  const IconComp = getIcon(label);
                  if (IconComp) {
                    const iconColor = isCurrent ? '#00d4ff' : isFuture ? '#555' : '#888';
                    return <IconComp color={iconColor} size={12} />;
                  }
                  return <span style={{ fontSize: '10px' }}>•</span>;
                })()}
              </span>
              <span style={{
                ...styles.entryLabel,
                ...(isFuture ? { opacity: 0.35 } : {}),
                ...(isCurrent ? { color: '#00d4ff', fontWeight: 600 } : {}),
              }}>
                {label}
              </span>
              {isCurrent && <span style={styles.currentDot} />}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        Click to jump to any state
      </div>
    </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 240,
    height: '100%',
    background: '#16162a',
    borderLeft: '1px solid #2a2a4a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Poppins', sans-serif",
    boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid #2a2a4a',
    background: '#1a1a32',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0',
    flex: 1,
  },
  headerCount: {
    fontSize: '10px',
    color: '#888',
    background: '#2a2a4a',
    borderRadius: '8px',
    padding: '1px 7px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    lineHeight: 1,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    position: 'relative' as const,
    borderLeft: '3px solid transparent',
  },
  entryCurrent: {
    background: 'rgba(0,212,255,0.12)',
    borderLeft: '3px solid #00d4ff',
  },
  entryFuture: {
    opacity: 0.5,
  },
  entryIcon: {
    fontSize: '12px',
    width: 18,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  entryLabel: {
    fontSize: '11px',
    color: '#c0c0d0',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#00d4ff',
    flexShrink: 0,
    boxShadow: '0 0 6px #00d4ff',
  },
  footer: {
    padding: '6px 12px',
    fontSize: '9px',
    color: '#555',
    borderTop: '1px solid #2a2a4a',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
};

export default HistoryPanel;