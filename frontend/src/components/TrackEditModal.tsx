import React, { useState, useRef, useEffect } from 'react';

type ModalMode = 'upload_track' | 'edit_track' | 'edit_pub';

interface TrackEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: ModalMode;
    initialFile?: File | null; // For upload mode
    editId?: number;           // For edit modes
    initialTitle?: string;
    initialCoverUrl?: string | null;
    onSuccess: () => void;
}

const TrackEditModal: React.FC<TrackEditModalProps> = ({
    isOpen, onClose, mode, initialFile, editId, initialTitle = '', initialCoverUrl = null, onSuccess
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialCoverUrl);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle || (initialFile ? initialFile.name.replace(/\.[^/.]+$/, '') : ''));
            setCoverFile(null);
            setPreviewUrl(initialCoverUrl);
            setError('');
        }
    }, [isOpen, initialTitle, initialFile, initialCoverUrl]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCoverFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        if (!title.trim()) {
            setError('Title cannot be empty');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            if (coverFile) {
                formData.append('cover_image', coverFile);
            }

            let endpoint = '';
            let method = '';

            if (mode === 'upload_track') {
                if (!initialFile) throw new Error('No audio file selected');
                formData.append('audio_file', initialFile);
                endpoint = `${API_BASE_URL}/api/auth/tracks/`;
                method = 'POST';
            } else if (mode === 'edit_track') {
                endpoint = `${API_BASE_URL}/api/auth/tracks/${editId}/`;
                method = 'PATCH';
            } else if (mode === 'edit_pub') {
                endpoint = `${API_BASE_URL}/api/auth/publications/${editId}/`;
                method = 'PATCH';
            }

            const res = await fetch(endpoint, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || errData?.audio_file?.[0] || errData?.cover_image?.[0] || 'Gosh darnit, save failed.');
            }

            onSuccess();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setSaving(false);
        }
    };

    const titleText = mode === 'upload_track' ? 'Upload Track' : 'Edit Track Data';

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2 style={styles.header}>{titleText}</h2>

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.content}>
                    <div style={styles.coverSection}>
                        <div
                            style={styles.coverPreview}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Cover" style={styles.coverImg} />
                            ) : (
                                <div style={styles.coverPlaceholder}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    <span style={{ fontSize: '12px', marginTop: '4px' }}>Upload Cover</span>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>

                    <div style={styles.formSection}>
                        <label style={styles.label}>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={styles.input}
                            placeholder="Track Title"
                        />
                    </div>
                </div>

                <div style={styles.actions}>
                    <button onClick={onClose} style={styles.cancelBtn} disabled={saving}>Cancel</button>
                    <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000,
    },
    modal: {
        background: '#151525', width: '400px', borderRadius: '12px',
        padding: '24px', position: 'relative' as const,
        border: '1px solid rgba(255,255,255,0.1)',
    },
    header: {
        margin: '0 0 20px 0', color: '#fff', fontSize: '20px', fontWeight: 600,
    },
    error: {
        color: '#ff4d4d', background: 'rgba(255,77,77,0.1)', padding: '10px',
        borderRadius: '6px', marginBottom: '16px', fontSize: '14px',
    },
    content: {
        display: 'flex', gap: '20px'
    },
    coverSection: {
        flexShrink: 0,
    },
    coverPreview: {
        width: '120px', height: '120px', borderRadius: '8px',
        background: '#1e2030', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', overflow: 'hidden', border: '1px dashed rgba(255,255,255,0.2)',
    },
    coverImg: {
        width: '100%', height: '100%', objectFit: 'cover' as const,
    },
    coverPlaceholder: {
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', color: 'rgba(255,255,255,0.5)',
    },
    formSection: {
        flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center',
    },
    label: {
        fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px'
    },
    input: {
        width: '100%', padding: '10px 12px', borderRadius: '6px',
        background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.1)',
        color: '#fff', fontSize: '14px', outline: 'none',
    },
    actions: {
        display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px',
    },
    cancelBtn: {
        padding: '8px 16px', borderRadius: '6px', background: 'transparent',
        color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
    },
    saveBtn: {
        padding: '8px 24px', borderRadius: '6px', border: 'none',
        background: 'linear-gradient(135deg, #00d4ff, #0096c7)',
        color: '#fff', fontWeight: 600, cursor: 'pointer',
    }
};

export default TrackEditModal;
