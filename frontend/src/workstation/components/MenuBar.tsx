import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useDawStore from '../state/dawStore';
import { exportToWav, exportToMp3, renderToMp3Blob } from '../engine/ExportEngine';
import { parseMidiFile, midiToClipNotes } from '../engine/MidiParser';
import { createProject, saveProject, publishSong } from '../api/projectApi';

// ─── Modal Component ───

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, width = 420 }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={{ ...modalStyles.container, width }} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>{title}</h3>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>
        <div style={modalStyles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
};

const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 20000,
    backdropFilter: 'blur(4px)',
  },
  container: {
    backgroundColor: '#1e1e38',
    border: '1px solid #3a3a5e',
    borderRadius: '12px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #2a2a4e',
  },
  title: {
    margin: 0, fontSize: '16px', fontWeight: 600,
    color: '#ffffff', fontFamily: "'Poppins', sans-serif",
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#888',
    fontSize: '16px', cursor: 'pointer', padding: '4px 8px',
    borderRadius: '4px',
  },
  body: {
    padding: '16px 20px 20px',
  },
};

// ─── Shortcuts Display ───

const SHORTCUTS = [
  { category: 'Transport', items: [
    { keys: 'Space', desc: 'Play / Pause' },
    { keys: 'Ctrl+S', desc: 'Save project' },
  ]},
  { category: 'Editing', items: [
    { keys: 'Ctrl+Z', desc: 'Undo' },
    { keys: 'Ctrl+Y', desc: 'Redo' },
    { keys: 'Ctrl+C', desc: 'Copy clip or notes' },
    { keys: 'Ctrl+V', desc: 'Paste' },
    { keys: 'Ctrl+D', desc: 'Duplicate clip' },
    { keys: 'Del / ⌫', desc: 'Delete selected' },
  ]},
  { category: 'View', items: [
    { keys: 'Ctrl+ +', desc: 'Zoom in' },
    { keys: 'Ctrl+ −', desc: 'Zoom out' },
    { keys: 'Ctrl+0', desc: 'Reset zoom' },
    { keys: 'G', desc: 'Toggle snap to grid' },
    { keys: 'Ctrl+H', desc: 'Toggle history panel' },
    { keys: 'Ctrl+M', desc: 'Toggle mixer' },
  ]},
  { category: 'Keyboard', items: [
    { keys: 'A − L', desc: 'Play notes (lower row)' },
    { keys: 'Z / X', desc: 'Octave down / up' },
    { keys: '− / =', desc: 'Octave down / up' },
    { keys: 'Shift', desc: 'Sustain (hold)' },
  ]},
];

const ShortcutsContent: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {SHORTCUTS.map((group) => (
      <div key={group.category}>
        <div style={{
          fontSize: '11px', fontWeight: 600, color: '#00d4ff',
          textTransform: 'uppercase', letterSpacing: '1px',
          marginBottom: '8px', fontFamily: "'Poppins', sans-serif",
        }}>
          {group.category}
        </div>
        {group.items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '5px 0',
            borderBottom: i < group.items.length - 1 ? '1px solid #252542' : 'none',
          }}>
            <span style={{
              fontSize: '12px', color: '#ccc',
              fontFamily: "'Poppins', sans-serif",
            }}>{item.desc}</span>
            <kbd style={{
              backgroundColor: '#252542',
              border: '1px solid #3a3a5e',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontFamily: "'SF Mono', 'Consolas', monospace",
              color: '#fff',
              minWidth: '32px',
              textAlign: 'center',
            }}>{item.keys}</kbd>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ─── About Content ───

const AboutContent: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '8px 0' }}>
    <img
      src="https://www.sonara.us/sonara_logo.svg"
      alt="Sonara"
      style={{ height: '48px', marginBottom: '8px' }}
    />
    <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', fontFamily: "'Poppins', sans-serif" }}>
      Digital Audio Workstation
    </div>
    <div style={{ fontSize: '12px', color: '#666', fontFamily: "'Poppins', sans-serif", lineHeight: '1.6' }}>
      Built with React, Tone.js & Zustand<br />
      Audio engine powered by Web Audio API
    </div>
  </div>
);

// ─── Menu Infrastructure ───

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

const MenuDropdown: React.FC<{
  menu: MenuDef;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}> = ({ menu, isOpen, onToggle, onClose, buttonRef }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, buttonRef]);

  return (
    <>
      <button
        ref={buttonRef as React.RefObject<HTMLButtonElement>}
        onClick={onToggle}
        style={{
          ...styles.menuButton,
          backgroundColor: isOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
        }}
      >
        {menu.label}
      </button>
      {isOpen && createPortal(
        <div ref={menuRef} style={{ ...styles.dropdown, top: pos.top, left: pos.left }}>
          {menu.items.map((item, i) => {
            if (item.divider) {
              return <div key={i} style={styles.dropdownDivider} />;
            }
            return (
              <button
                key={i}
                onClick={() => { if (item.action && !item.disabled) item.action(); onClose(); }}
                style={{
                  ...styles.dropdownItem,
                  opacity: item.disabled ? 0.4 : 1,
                  cursor: item.disabled ? 'default' : 'pointer',
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span style={styles.shortcut}>{item.shortcut}</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

// ─── MenuBar ───

const MenuBar: React.FC = () => {
  const navigate = useNavigate();
  const projectName = useDawStore((s) => s.projectName);
  const setProjectName = useDawStore((s) => s.setProjectName);
  const undo = useDawStore((s) => s.undo);
  const redo = useDawStore((s) => s.redo);
  const canUndo = useDawStore((s) => s.canUndo);
  const canRedo = useDawStore((s) => s.canRedo);
  const undoLabel = useDawStore((s) => s.undoLabel);
  const redoLabel = useDawStore((s) => s.redoLabel);
  const copyClip = useDawStore((s) => s.copyClip);
  const pasteClip = useDawStore((s) => s.pasteClip);
  const duplicateClip = useDawStore((s) => s.duplicateClip);
  const selectedClipId = useDawStore((s) => s.selectedClipId);
  const deleteClip = useDawStore((s) => s.deleteClip);
  const toggleSnap = useDawStore((s) => s.toggleSnap);
  const snapEnabled = useDawStore((s) => s.snapEnabled);
  const zoom = useDawStore((s) => s.zoom);
  const setZoom = useDawStore((s) => s.setZoom);
  const showHistoryPanel = useDawStore((s) => s.showHistoryPanel);
  const toggleHistoryPanel = useDawStore((s) => s.toggleHistoryPanel);
  const showMixer = useDawStore((s) => s.showMixer);
  const toggleMixer = useDawStore((s) => s.toggleMixer);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [modal, setModal] = useState<'shortcuts' | 'about' | null>(null);

  const fileRef = useRef<HTMLButtonElement | null>(null);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const viewRef = useRef<HTMLButtonElement | null>(null);
  const helpRef = useRef<HTMLButtonElement | null>(null);

  const handleExportWav = async () => {
    setIsExporting(true);
    try {
      await exportToWav();
    } catch (err) {
      console.error('Export failed:', err);
    }
    setIsExporting(false);
  };

  const handleExportMp3 = async () => {
    setIsExporting(true);
    try {
      await exportToMp3();
    } catch (err) {
      console.error('Export failed:', err);
    }
    setIsExporting(false);
  };

  const handleSave = async () => {
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
      alert('Project saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save project.');
    }
  };

  const handlePublish = async () => {
    const state = useDawStore.getState();
    const title = prompt('Song title:', state.projectName);
    if (!title) return;
    const description = prompt('Description (optional):', '') || '';

    setIsExporting(true);
    try {
      // Save project first
      const data = state.getProjectData();
      let projId = state.serverProjectId;
      if (projId) {
        await saveProject(projId, state.projectName, data);
      } else {
        const proj = await createProject(state.projectName, data);
        projId = proj.id;
        state.setServerProjectId(proj.id);
      }

      // Render to MP3 blob
      const audioBlob = await renderToMp3Blob();

      // Publish
      await publishSong(audioBlob, title, description, projId || undefined);
      alert('Song published to your profile!');
    } catch (err) {
      console.error('Publish failed:', err);
      alert('Failed to publish. Make sure you are logged in.');
    }
    setIsExporting(false);
  };

  const handleImportMidi = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseMidiFile(buffer);
        const state = useDawStore.getState();

        // Find first instrument track, or create one
        let targetTrack = state.tracks.find((t) => t.type === 'instrument' || t.type === 'drums');
        if (!targetTrack) {
          state.addTrack('instrument');
          await new Promise((r) => setTimeout(r, 0));
          const newState = useDawStore.getState();
          targetTrack = newState.tracks[newState.tracks.length - 1];
        }

        if (!targetTrack) return;

        // Import each MIDI track as a separate clip
        // If multiple tracks in the MIDI, import to multiple DAW tracks
        const dawTracks = useDawStore.getState().tracks.filter((t) => t.type !== 'audio');

        for (let i = 0; i < parsed.tracks.length; i++) {
          const midiTrack = parsed.tracks[i];
          const { notes, durationBeats } = midiToClipNotes(midiTrack, parsed.ticksPerBeat);

          if (notes.length === 0) continue;

          // Use existing instrument track or create new one
          let track = dawTracks[i];
          if (!track) {
            useDawStore.getState().addTrack('instrument');
            await new Promise((r) => setTimeout(r, 0));
            const updated = useDawStore.getState();
            track = updated.tracks[updated.tracks.length - 1];
          }

          if (track) {
            const clipName = midiTrack.name || file.name.replace(/\.(mid|midi)$/i, '');
            useDawStore.getState().importMidiClip(track.id, 0, clipName, notes, durationBeats);
          }
        }
      } catch (err) {
        console.error('MIDI import failed:', err);
        alert('Failed to import MIDI file. The file may be corrupted or in an unsupported format.');
      }
    };
    input.click();
  };

  const menus: { def: MenuDef; ref: React.RefObject<HTMLButtonElement | null> }[] = [
    {
      ref: fileRef,
      def: {
        label: 'File',
        items: [
          { label: 'Save Project', shortcut: 'Ctrl+S', action: handleSave },
          { divider: true, label: '' },
          { label: 'Import MIDI File', action: handleImportMidi },
          { divider: true, label: '' },
          { label: 'Export as WAV', action: handleExportWav, disabled: isExporting },
          { label: 'Export as MP3', action: handleExportMp3, disabled: isExporting },
          { divider: true, label: '' },
          { label: '🚀 Publish Song', action: handlePublish, disabled: isExporting },
          { divider: true, label: '' },
          { label: 'Exit to Dashboard', action: () => navigate('/create') },
        ],
      },
    },
    {
      ref: editRef,
      def: {
        label: 'Edit',
        items: [
          { label: canUndo ? `Undo ${undoLabel}` : 'Undo', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
          { label: canRedo ? `Redo ${redoLabel}` : 'Redo', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
          { divider: true, label: '' },
          { label: 'Copy Clip', shortcut: 'Ctrl+C', action: copyClip, disabled: !selectedClipId },
          { label: 'Paste Clip', shortcut: 'Ctrl+V', action: pasteClip },
          { label: 'Duplicate Clip', shortcut: 'Ctrl+D', action: () => duplicateClip(), disabled: !selectedClipId },
          { divider: true, label: '' },
          { label: 'Delete Clip', shortcut: 'Del', action: () => { if (selectedClipId) deleteClip(selectedClipId); }, disabled: !selectedClipId },
        ],
      },
    },
    {
      ref: viewRef,
      def: {
        label: 'View',
        items: [
          { label: 'Zoom In', shortcut: 'Ctrl++', action: () => setZoom(Math.min(4, zoom + 0.25)) },
          { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => setZoom(Math.max(0.25, zoom - 0.25)) },
          { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => setZoom(1) },
          { divider: true, label: '' },
          { label: `${snapEnabled ? '✓ ' : ''}Snap to Grid`, shortcut: 'G', action: toggleSnap },
          { divider: true, label: '' },
          { label: `${showHistoryPanel ? '✓ ' : ''}History Panel`, shortcut: 'Ctrl+H', action: toggleHistoryPanel },
          { label: `${showMixer ? '✓ ' : ''}Mixer`, shortcut: 'Ctrl+M', action: toggleMixer },
        ],
      },
    },
    {
      ref: helpRef,
      def: {
        label: 'Help',
        items: [
          { label: 'Keyboard Shortcuts', action: () => setModal('shortcuts') },
          { label: 'About Sonara', action: () => setModal('about') },
        ],
      },
    },
  ];

  return (
    <>
      <div style={styles.menuBar}>
        <div style={styles.menuLeft}>
          <button onClick={() => navigate('/create')} style={styles.menuButton}>↩ Exit</button>
          <span style={styles.menuDivider}>|</span>
          {menus.map(({ def, ref }) => (
            <MenuDropdown
              key={def.label}
              menu={def}
              isOpen={openMenu === def.label}
              onToggle={() => setOpenMenu(openMenu === def.label ? null : def.label)}
              onClose={() => setOpenMenu(null)}
              buttonRef={ref}
            />
          ))}
        </div>
        <div style={styles.menuRight}>
          {isExporting && <span style={styles.exportingLabel}>⏳ Exporting...</span>}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={styles.projectNameInput}
          />
        </div>
      </div>

      {modal === 'shortcuts' && (
        <Modal title="Keyboard Shortcuts" onClose={() => setModal(null)} width={400}>
          <ShortcutsContent />
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="About" onClose={() => setModal(null)} width={340}>
          <AboutContent />
        </Modal>
      )}
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  menuBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    backgroundColor: '#252542',
    borderBottom: '1px solid #3a3a5e',
    zIndex: 100,
  },
  menuLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  menuRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  menuButton: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '4px',
    fontFamily: "'Poppins', sans-serif",
  },
  menuDivider: {
    color: '#3a3a5e',
    margin: '0 6px',
  },
  dropdown: {
    position: 'fixed',
    backgroundColor: '#252542',
    border: '1px solid #3a3a5e',
    borderRadius: '8px',
    padding: '4px 0',
    zIndex: 10000,
    minWidth: '220px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  dropdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '7px 14px',
    border: 'none',
    background: 'none',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    textAlign: 'left',
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#3a3a5e',
    margin: '4px 0',
  },
  shortcut: {
    color: '#888',
    fontSize: '11px',
    marginLeft: '24px',
  },
  projectNameInput: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'right' as const,
    width: '200px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: "'Poppins', sans-serif",
  },
  exportingLabel: {
    color: '#00d4ff',
    fontSize: '12px',
    fontWeight: 500,
  },
};

export default MenuBar;