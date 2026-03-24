import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NotFound from './NotFound';
import ImageCropModal from './components/ImageCropModal';
import { usePlayerStore } from './stores/playerStore';
import TrackEditModal from './components/TrackEditModal';

interface UserProfile {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: string;
  is_listener: boolean;
  is_creator: boolean;
  header_image: string | null;
  profile_picture: string | null;
  bio: string;
}

interface Track {
  id: number;
  title: string;
  audio_file: string;
  uploaded_at: string;
  cover_image?: string;
}

const TABS = ['Posts', 'Tracks', 'Playlists', 'Reposts'] as const;

const ProfilePage = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Posts');
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editIsListener, setEditIsListener] = useState(false);
  const [editIsCreator, setEditIsCreator] = useState(false);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [removeHeader, setRemoveHeader] = useState(false);
  const [removePfp, setRemovePfp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [modalMode, setModalMode] = useState<'upload_track' | 'edit_track' | 'edit_pub' | null>(null);
  const [editTargetId, setEditTargetId] = useState<number | undefined>(undefined);
  const [editInitialTitle, setEditInitialTitle] = useState('');
  const [editInitialCover, setEditInitialCover] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<number | null>(null);

  const { currentTrack, isPlaying, play, togglePlayPause, stop } = usePlayerStore();

  const trackInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const pfpInputRef = useRef<HTMLInputElement>(null);
  const [cropTarget, setCropTarget] = useState<'header' | 'pfp' | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const navigate = useNavigate();
  const { handle } = useParams<{ handle: string }>();
  const urlUsername = handle?.startsWith('@') ? handle.slice(1) : handle;

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  const startEditing = () => {
    setEditBio(user?.bio ?? '');
    setEditDisplayName(user?.display_name ?? '');
    setEditHandle(user?.username ?? '');
    setEditIsListener(user?.is_listener ?? false);
    setEditIsCreator(user?.is_creator ?? false);
    setHeaderFile(null);
    setPfpFile(null);
    setRemoveHeader(false);
    setRemovePfp(false);
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError('');
    setHeaderFile(null);
    setPfpFile(null);
    setRemoveHeader(false);
    setRemovePfp(false);
  };

  const fetchTracks = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;
    setTracksLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/tracks/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to load tracks');
      const data = await response.json();
      setTracks(data);
    } catch {
      /* silently fail — tracks area will just be empty */
    } finally {
      setTracksLoading(false);
    }
  }, [API_BASE_URL]);

  const deleteTrack = async (trackId: number) => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;
    setDeletingTrackId(trackId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/tracks/${trackId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Delete failed');
      if (currentTrack?.id === trackId && currentTrack?.type === 'track') {
        stop();
      }
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch {
      /* optionally show error */
    } finally {
      setDeletingTrackId(null);
    }
  };

  const togglePlay = (track: Track) => {
    if (currentTrack?.id === track.id && currentTrack?.type === 'track') {
      togglePlayPause();
      return;
    }
    play({
      id: track.id, type: 'track',
      title: track.title, artist: user?.display_name || user?.username || urlUsername || 'Unknown',
      audioUrl: track.audio_file, coverImage: user?.profile_picture || null,
      artistHandle: user?.username || urlUsername || '',
    });
  };

  const saveProfile = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;
    setSaving(true);
    setSaveError('');
    try {
      const formData = new FormData();
      formData.append('bio', editBio);
      formData.append('display_name', editDisplayName);
      formData.append('username', editHandle.trim().toLowerCase());
      formData.append('is_listener', String(editIsListener));
      formData.append('is_creator', String(editIsCreator));
      if (headerFile) formData.append('header_image', headerFile);
      if (pfpFile) formData.append('profile_picture', pfpFile);
      if (removeHeader) formData.append('remove_header_image', 'true');
      if (removePfp) formData.append('remove_profile_picture', 'true');

      const response = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg =
          (Array.isArray(errData?.is_listener) ? errData.is_listener[0] : null) ||
          (Array.isArray(errData?.is_creator) ? errData.is_creator[0] : null) ||
          (Array.isArray(errData?.header_image) ? errData.header_image[0] : null) ||
          (Array.isArray(errData?.profile_picture) ? errData.profile_picture[0] : null) ||
          (Array.isArray(errData?.bio) ? errData.bio[0] : null) ||
          (Array.isArray(errData?.username) ? errData.username[0] : null) ||
          (Array.isArray(errData?.display_name) ? errData.display_name[0] : null) ||
          errData?.detail ||
          `Failed to update profile (${response.status})`;
        throw new Error(msg);
      }
      const data = await response.json();
      setUser(data);
      setEditing(false);
      setHeaderFile(null);
      setPfpFile(null);
      setRemoveHeader(false);
      setRemovePfp(false);
      // If username changed, redirect to new handle URL
      if (data.username !== urlUsername) {
        navigate(`/@${data.username}`, { replace: true });
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!handle?.startsWith('@')) return;

    const fetchProfile = async () => {
      const accessToken = localStorage.getItem('accessToken');

      let loggedInUsername: string | null = null;
      if (accessToken) {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            loggedInUsername = meData.username;
          }
        } catch { /* not logged in or token expired */ }
      }

      if (loggedInUsername && loggedInUsername === urlUsername) {
        setIsOwnProfile(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) throw new Error('Failed to fetch profile');
          setUser(await res.json());
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
          setLoading(false);
        }
      } else {
        setIsOwnProfile(false);
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/`);
          if (!res.ok) {
            if (res.status === 404) {
              setError('User not found');
            } else {
              throw new Error('Failed to load profile');
            }
            setLoading(false);
            return;
          }
          const data = await res.json();
          const publicTracks: Track[] = data.tracks || [];
          setUser({
            id: data.id,
            username: data.username,
            email: '',
            role: data.role,
            is_listener: data.is_listener,
            is_creator: data.is_creator,
            header_image: data.header_image,
            profile_picture: data.profile_picture,
            bio: data.bio,
            display_name: data.display_name || '',
          });
          setTracks(publicTracks);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProfile();
  }, [navigate, handle, urlUsername, API_BASE_URL]);

  // Update document title when user loads
  useEffect(() => {
    if (user?.username) {
      document.title = `${user.username}'s Profile | Sonara`;
    } else {
      document.title = 'Profile | Sonara';
    }
  }, [user?.username]);

  useEffect(() => {
    if (isOwnProfile) fetchTracks();
  }, [fetchTracks, isOwnProfile]);

  const headerPreviewUrl = useMemo(
    () => (headerFile ? URL.createObjectURL(headerFile) : null),
    [headerFile]
  );
  const pfpPreviewUrl = useMemo(
    () => (pfpFile ? URL.createObjectURL(pfpFile) : null),
    [pfpFile]
  );
  useEffect(() => {
    return () => {
      if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl);
      if (pfpPreviewUrl) URL.revokeObjectURL(pfpPreviewUrl);
    };
  }, [headerPreviewUrl, pfpPreviewUrl]);

  function getHeaderImageUrl(): string | null {
    if (editing && removeHeader) return null;
    if (editing && headerPreviewUrl) return headerPreviewUrl;
    return user?.header_image ?? null;
  }

  function getPfpImageUrl(): string | null {
    if (editing && removePfp) return null;
    if (editing && pfpPreviewUrl) return pfpPreviewUrl;
    return user?.profile_picture ?? null;
  }

  if (!handle?.startsWith('@')) {
    return <NotFound />;
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.backgroundOverlay} />
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');`}</style>
        <div style={styles.backgroundOverlay} />
        <div style={styles.errorWrap}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={() => navigate('/login')} style={styles.errorButton}>Go to Login</button>
        </div>
      </div>
    );
  }

  const roleLabel =
    user?.role === 'both'
      ? 'Listener & Creator'
      : user?.role === 'none' || !user?.role
        ? 'No role set'
        : (user?.role ?? 'No role set').charAt(0).toUpperCase() + (user?.role ?? '').slice(1);

  return (
    <div style={styles.page}>
      <div style={styles.backgroundOverlay} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
        textarea:focus, input[type=text]:focus { outline: none; border-color: #00d4ff !important; box-shadow: 0 0 15px rgba(0, 212, 255, 0.3); }
        .profile-upload-card:hover { border-color: rgba(0, 212, 255, 0.5); background: rgba(30, 45, 80, 0.6); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .edit-icon-btn:hover { background: rgba(255,255,255,0.25) !important; transform: scale(1.05); }
        .role-pill-btn { transition: all 0.2s ease !important; }
        .role-pill-btn:hover { transform: none !important; opacity: 1 !important; }
        .edit-modal-backdrop { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Hidden file inputs (always in DOM) */}
      <input
        ref={headerInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setCropImageSrc(URL.createObjectURL(f));
            setCropTarget('header');
          }
          e.target.value = '';
        }}
        style={styles.hiddenFileInput}
        disabled={saving}
      />
      <input
        ref={pfpInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setCropImageSrc(URL.createObjectURL(f));
            setCropTarget('pfp');
          }
          e.target.value = '';
        }}
        style={styles.hiddenFileInput}
        disabled={saving}
      />

      {/* ═══════════════ EDIT MODE POPUP MODAL ═══════════════ */}
      {isOwnProfile && editing && (
        <div className="edit-modal-backdrop" style={styles.editBackdrop} onClick={cancelEditing}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            {/* Edit top bar */}
            <header style={styles.editTopBar}>
              <button type="button" onClick={cancelEditing} style={styles.editCloseBtn} aria-label="Close" disabled={saving}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <span style={styles.editTopBarTitle}>Edit profile</span>
              <button type="button" onClick={saveProfile} style={styles.editSaveBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </header>

            {/* Editable cover photo */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  ...styles.editCover,
                  ...(getHeaderImageUrl()
                    ? { backgroundImage: `url(${getHeaderImageUrl()})` }
                    : {}),
                }}
              >
                {getHeaderImageUrl() && <div style={styles.coverGradient} />}
                {/* Always-visible icon buttons centered on cover */}
                <div style={styles.coverIconRow}>
                  <button
                    type="button"
                    className="edit-icon-btn"
                    onClick={() => headerInputRef.current?.click()}
                    style={styles.editIconBtn}
                    aria-label="Change cover photo"
                    disabled={saving}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  </button>
                  {(getHeaderImageUrl()) && (
                    <button
                      type="button"
                      className="edit-icon-btn"
                      onClick={() => { setRemoveHeader(true); setHeaderFile(null); }}
                      style={styles.editIconBtn}
                      aria-label="Remove cover photo"
                      disabled={saving}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>
                {!getHeaderImageUrl() && (
                  <div style={styles.coverPlaceholder}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    <span>Add cover photo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Editable avatar */}
            <div style={styles.editAvatarSection}>
              <div
                style={{
                  ...styles.avatar,
                  ...(getPfpImageUrl()
                    ? { backgroundImage: `url(${getPfpImageUrl()})` }
                    : {}),
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onClick={() => pfpInputRef.current?.click()}
              >
                {!getPfpImageUrl() && (
                  <span style={styles.avatarIcon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </span>
                )}
                {/* Camera badge */}
                <div style={styles.avatarCameraBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                </div>
              </div>
              {getPfpImageUrl() && (
                <button
                  type="button"
                  onClick={() => { setRemovePfp(true); setPfpFile(null); }}
                  style={styles.avatarRemoveLink}
                  disabled={saving}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Edit form fields */}
            <div style={styles.editFormSection}>
              {/* Display Name */}
              <div style={styles.editFieldGroup}>
                <label style={styles.editFieldLabel}>Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={100}
                  style={styles.editFieldInput}
                  disabled={saving}
                />
              </div>

              {/* Handle */}
              <div style={styles.editFieldGroup}>
                <label style={styles.editFieldLabel}>Handle</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: 'rgba(255,255,255,0.35)', fontSize: '14px', fontFamily: "'Poppins', sans-serif",
                    pointerEvents: 'none',
                  }}>@</span>
                  <input
                    type="text"
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                    placeholder="username"
                    maxLength={30}
                    style={{ ...styles.editFieldInput, paddingLeft: '28px' }}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Bio */}
              <div style={styles.editFieldGroup}>
                <label style={styles.editFieldLabel}>Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  style={styles.editFieldTextarea}
                  disabled={saving}
                />
              </div>

              {/* Role toggle pills */}
              <div style={styles.editFieldGroup}>
                <label style={styles.editFieldLabel}>Role</label>
                <div style={styles.editRoleRow}>
                  <button
                    type="button"
                    className="role-pill-btn"
                    onClick={() => setEditIsListener(!editIsListener)}
                    style={{
                      ...styles.rolePillBtn,
                      ...(editIsListener ? styles.rolePillBtnActive : {}),
                    }}
                    disabled={saving}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                    Listener
                  </button>
                  <button
                    type="button"
                    className="role-pill-btn"
                    onClick={() => setEditIsCreator(!editIsCreator)}
                    style={{
                      ...styles.rolePillBtn,
                      ...(editIsCreator ? styles.rolePillBtnActive : {}),
                    }}
                    disabled={saving}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    Creator
                  </button>
                </div>
              </div>

              {saveError && <p style={styles.saveError}>{saveError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header style={styles.topBar}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={styles.backButton}
          aria-label="Back"
        >
          ←
        </button>
        <span style={styles.topBarTitle}>Profile</span>
        <div style={styles.topBarRight} />
      </header>

      {/* Cover */}
      <div style={styles.coverWrap}>
        <div
          style={{
            ...styles.cover,
            ...(getHeaderImageUrl()
              ? { backgroundImage: `url(${getHeaderImageUrl()})` }
              : {}),
          }}
        >
          {getHeaderImageUrl() && <div style={styles.coverGradient} />}
          {!getHeaderImageUrl() && (
            <div style={styles.coverPlaceholder}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              <span>No cover photo</span>
            </div>
          )}
        </div>
      </div>

      <div style={styles.main}>
        {/* Profile info block */}
        <div style={styles.profileBlock}>
          <div
            style={{
              ...styles.avatar,
              ...(getPfpImageUrl()
                ? { backgroundImage: `url(${getPfpImageUrl()})` }
                : {}),
            }}
          >
            {!getPfpImageUrl() && (
              <span style={styles.avatarIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </span>
            )}
          </div>

          <div style={styles.nameRow}>
            <div style={styles.nameAndEdit}>
              <h1 style={styles.displayName}>{user?.display_name || user?.username}</h1>
              {isOwnProfile && (
                <button type="button" onClick={startEditing} style={styles.editBtn}>
                  Edit profile
                </button>
              )}
            </div>
            <p style={styles.handle}>@{user?.username}</p>
          </div>

          <div style={styles.rolePill}>{roleLabel}</div>

          {user?.bio?.trim() ? (
            <p style={styles.bio}>{user.bio}</p>
          ) : null}

          {isOwnProfile && (
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  stop();
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  localStorage.removeItem('username');
                  navigate('/login');
                }}
                style={styles.logoutBtn}
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={styles.tabsWrap}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.tabContent}>
          {activeTab === 'Tracks' ? (
            <div>
              {isOwnProfile && (
                <div style={styles.trackUploadSection}>
                  <h3 style={styles.trackSectionTitle}>Upload a track</h3>
                  <div style={styles.trackUploadForm}>
                    <input
                      ref={trackInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setTrackFile(f);
                          setModalMode('upload_track');
                        }
                        e.target.value = '';
                      }}
                      style={styles.hiddenFileInput}
                    />
                    <button
                      type="button"
                      onClick={() => trackInputRef.current?.click()}
                      className="profile-upload-card"
                      style={styles.uploadCard}
                    >
                      <span style={styles.uploadIcon}>♫</span>
                      <span style={styles.uploadText}>{'Choose audio file'}</span>
                    </button>
                  </div>
                </div>
              )}

              {tracksLoading ? (
                <p style={styles.comingSoon}>Loading tracks...</p>
              ) : tracks.length === 0 ? (
                <p style={styles.comingSoon}>{isOwnProfile ? 'No tracks uploaded yet' : 'No tracks yet'}</p>
              ) : (
                <div style={styles.trackList}>
                  {tracks.map((track) => (
                    <div key={track.id} style={styles.trackCard}>
                      <button
                        type="button"
                        onClick={() => togglePlay(track)}
                        style={styles.playBtn}
                        aria-label={currentTrack?.id === track.id && currentTrack?.type === 'track' && isPlaying ? 'Pause' : 'Play'}
                      >
                        {currentTrack?.id === track.id && currentTrack?.type === 'track' && isPlaying ? '⏸' : '▶'}
                      </button>
                      <div style={styles.trackInfo}>
                        <span style={styles.trackTitle}>{track.title}</span>
                        <span style={styles.trackDate}>
                          {new Date(track.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>
                      {isOwnProfile && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTargetId(track.id);
                              setEditInitialTitle(track.title);
                              setEditInitialCover(track.cover_image || null);
                              setModalMode('edit_track');
                            }}
                            style={{ ...styles.trackDeleteBtn, background: 'rgba(255,165,0,0.2)', color: 'orange', borderColor: 'orange' }}
                            title="Edit metadata"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTrack(track.id)}
                            style={styles.trackDeleteBtn}
                            disabled={deletingTrackId === track.id}
                            title="Delete track"
                          >
                            {deletingTrackId === track.id ? '...' : '✕'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={styles.comingSoon}>{activeTab} — Coming soon</p>
          )}
        </div>
      </div>

      {/* Image crop modal */}
      {cropTarget && cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          aspect={cropTarget === 'pfp' ? 1 : 16 / 9}
          cropShape={cropTarget === 'pfp' ? 'round' : 'rect'}
          onCropComplete={(blob) => {
            const ext = blob.type === 'image/png' ? '.png' : '.jpg';
            const fileName = cropTarget === 'pfp' ? `profile${ext}` : `header${ext}`;
            const file = new File([blob], fileName, { type: blob.type });
            if (cropTarget === 'pfp') {
              setPfpFile(file);
              setRemovePfp(false);
            } else {
              setHeaderFile(file);
              setRemoveHeader(false);
            }
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
            setCropTarget(null);
          }}
          onCancel={() => {
            if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
            setCropTarget(null);
          }}
        />
      )}

      {/* Track edit/upload modal */}
      {modalMode && (
        <TrackEditModal
          isOpen={!!modalMode}
          onClose={() => {
            setModalMode(null);
            setTrackFile(null);
          }}
          mode={modalMode}
          initialFile={trackFile}
          editId={editTargetId}
          initialTitle={editInitialTitle}
          initialCoverUrl={editInitialCover}
          onSuccess={() => {
            fetchTracks();
          }}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(100, 100, 200, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '12px',
    position: 'relative',
    zIndex: 1,
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255,255,255,0.2)',
    borderTopColor: '#00d4ff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
  },
  errorWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
    padding: '24px',
    position: 'relative',
    zIndex: 1,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '15px',
  },
  errorButton: {
    padding: '10px 20px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
  },
  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '53px',
    padding: '0 16px',
    background: 'rgba(10, 10, 26, 0.9)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(100, 150, 200, 0.2)',
  },
  backButton: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: '19px',
    fontWeight: 700,
    color: '#ffffff',
  },
  topBarRight: {
    width: '34px',
  },
  coverWrap: {
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  cover: {
    width: '100%',
    height: '260px',
    background: 'linear-gradient(135deg, rgba(20, 30, 60, 0.9) 0%, rgba(30, 50, 90, 0.7) 50%, rgba(0, 80, 120, 0.6) 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(100, 150, 200, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  coverGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, transparent 40%, rgba(10, 10, 26, 0.7) 100%)',
    pointerEvents: 'none',
  },
  /* ── Edit modal styles ── */
  editBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    overflowY: 'auto',
  },
  editModal: {
    width: '100%',
    maxWidth: '600px',
    borderRadius: '20px',
    background: '#0f0f23',
    border: '1px solid rgba(100, 150, 200, 0.2)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease',
  },
  editTopBar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '53px',
    padding: '0 16px',
    background: 'rgba(10, 10, 26, 0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(100, 150, 200, 0.15)',
  },
  editCloseBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Poppins', sans-serif",
  },
  editTopBarTitle: {
    fontSize: '19px',
    fontWeight: 700,
    color: '#ffffff',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  editSaveBtn: {
    padding: '8px 20px',
    borderRadius: '9999px',
    border: 'none',
    background: '#ffffff',
    color: '#000000',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  coverIconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    zIndex: 3,
    position: 'relative',
  },
  editIconBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#ffffff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    transition: 'background 0.2s, transform 0.2s',
  },
  editCover: {
    width: '100%',
    height: '200px',
    background: 'linear-gradient(135deg, rgba(20, 30, 60, 0.9) 0%, rgba(30, 50, 90, 0.7) 50%, rgba(0, 80, 120, 0.6) 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  editAvatarSection: {
    padding: '0 24px',
    marginTop: '-50px',
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    marginBottom: '24px',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    border: '2px solid #0a0a1a',
    backdropFilter: 'blur(4px)',
  },
  avatarRemoveLink: {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    padding: '4px 0',
    marginBottom: '8px',
  },
  editFormSection: {
    padding: '0 24px 40px',
    maxWidth: '600px',
  },
  editFieldGroup: {
    marginBottom: '20px',
  },
  editFieldLabel: {
    display: 'block',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '6px',
    fontWeight: 500,
  },
  editFieldReadonly: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(100, 150, 200, 0.25)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '16px',
    fontFamily: "'Poppins', sans-serif",
  },
  editFieldInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '14px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(100, 150, 200, 0.25)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '16px',
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
  },
  editFieldTextarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(100, 150, 200, 0.25)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '16px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
    minHeight: '80px',
  },
  editRoleRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  rolePillBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '9999px',
    border: '2px solid rgba(100, 150, 200, 0.25)',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  rolePillBtnActive: {
    borderColor: '#00d4ff',
    background: 'rgba(0, 212, 255, 0.12)',
    color: '#00d4ff',
    boxShadow: '0 0 20px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.05)',
  },
  main: {
    maxWidth: '1280px',
    margin: '0 auto',
    marginTop: '-60px',
    position: 'relative',
    zIndex: 1,
    paddingLeft: '24px',
    paddingRight: '24px',
    borderLeft: '1px solid rgba(100, 150, 200, 0.2)',
    borderRight: '1px solid rgba(100, 150, 200, 0.2)',
    minHeight: 'calc(100vh - 53px - 230px + 60px)',
  },
  coverPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
  },
  coverPlaceholderIcon: {
    fontSize: '32px',
    opacity: 0.7,
  },
  profileBlock: {
    padding: '12px 16px 16px',
    position: 'relative',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'rgba(30, 45, 80, 0.8)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '4px solid #0a0a1a',
    marginTop: '-60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarIcon: {
    fontSize: '48px',
    opacity: 0.6,
  },
  nameRow: {
    marginTop: '12px',
  },
  nameAndEdit: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: 1.2,
    margin: 0,
    color: '#ffffff',
  },
  editBtn: {
    padding: '6px 14px',
    borderRadius: '9999px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  handle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px',
    marginTop: '2px',
  },
  rolePill: {
    display: 'inline-block',
    marginTop: '12px',
    padding: '4px 12px',
    borderRadius: '9999px',
    background: 'rgba(0, 212, 255, 0.2)',
    color: '#00d4ff',
    fontSize: '13px',
    fontWeight: 600,
  },
  bio: {
    marginTop: '12px',
    fontSize: '15px',
    lineHeight: 1.4,
    color: 'rgba(255, 255, 255, 0.9)',
    whiteSpace: 'pre-wrap',
  },
  editBlock: {
    marginTop: '16px',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  editCard: {
    width: '100%',
    maxWidth: '520px',
    padding: '24px',
    borderRadius: '16px',
    background: 'rgba(30, 45, 80, 0.4)',
    border: '1px solid rgba(100, 150, 200, 0.2)',
  },
  editCardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '10px',
    marginTop: '20px',
  },
  editCardTitleFirst: {
    marginTop: 0,
  },
  editLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '6px',
  },
  bioInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    background: 'rgba(30, 45, 80, 0.6)',
    color: '#ffffff',
    fontSize: '15px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
    minHeight: '100px',
  },
  saveError: {
    color: '#ff6b6b',
    fontSize: '14px',
    marginTop: '8px',
    marginBottom: 0,
  },
  roleCheckboxRow: {
    display: 'flex',
    gap: '24px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#00d4ff',
    cursor: 'pointer',
  },
  uploadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
    flexWrap: 'wrap',
  },
  hiddenFileInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  uploadCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderRadius: '12px',
    border: '2px dashed rgba(100, 150, 200, 0.4)',
    background: 'rgba(30, 45, 80, 0.4)',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  uploadIcon: {
    fontSize: '18px',
    opacity: 0.8,
  },
  uploadText: {
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 100, 100, 0.5)',
    background: 'transparent',
    color: '#ff6b6b',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  editActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cancelBtn: {
    padding: '8px 18px',
    borderRadius: '9999px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 18px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
  },
  actions: {
    marginTop: '16px',
  },
  logoutBtn: {
    padding: '10px 20px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 50%, #dd4a4a 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(255, 100, 100, 0.3)',
  },
  tabsWrap: {
    display: 'flex',
    borderBottom: '1px solid rgba(100, 150, 200, 0.2)',
  },
  tab: {
    flex: 1,
    padding: '14px 16px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    color: '#00d4ff',
    fontWeight: 600,
    boxShadow: 'inset 0 -2px 0 #00d4ff',
  },
  tabContent: {
    padding: '32px 16px',
    minHeight: '200px',
  },
  comingSoon: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px',
    textAlign: 'center',
    margin: 0,
  },
  trackUploadSection: {
    marginBottom: '28px',
    padding: '20px',
    borderRadius: '16px',
    background: 'rgba(30, 45, 80, 0.35)',
    border: '1px solid rgba(100, 150, 200, 0.2)',
  },
  trackSectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0 0 14px 0',
  },
  trackUploadForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  trackTitleRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  trackTitleInput: {
    flex: 1,
    minWidth: '160px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    background: 'rgba(30, 45, 80, 0.6)',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
  },
  trackUploadBtn: {
    padding: '10px 20px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
    whiteSpace: 'nowrap' as const,
  },
  trackCancelBtn: {
    padding: '10px 16px',
    borderRadius: '9999px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  trackList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  trackCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'rgba(30, 45, 80, 0.35)',
    border: '1px solid rgba(100, 150, 200, 0.15)',
    transition: 'background 0.15s',
  },
  playBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 10px rgba(0, 212, 255, 0.25)',
  },
  trackInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  trackTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  trackDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  trackDeleteBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 100, 100, 0.4)',
    background: 'transparent',
    color: '#ff6b6b',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
};

export default ProfilePage;