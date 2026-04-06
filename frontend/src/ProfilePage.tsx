import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import NotFound from './NotFound';
import ImageCropModal from './components/ImageCropModal';
import { usePlayerStore } from './stores/playerStore';
import { useNotificationStore } from './stores/notificationStore';
import { apiFetch } from './utils/api';
import TrackEditModal from './components/TrackEditModal';
import RepostIcon from './components/RepostIcon';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { getUserGradient } from './utils/userGradient';

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
  follower_count?: number;
  following_count?: number;
  is_following?: boolean;
}

interface FollowUser {
  id: number;
  username: string;
  display_name: string;
  profile_picture: string | null;
  bio: string;
  role: string;
}

interface Track {
  id: number;
  title: string;
  audio_file: string;
  uploaded_at: string;
  cover_image?: string;
}

interface RepostListEntry {
  reposted_at: string;
  track: {
    id: number;
    title: string;
    audio_file: string;
    uploaded_at?: string;
    cover_image?: string;
    username: string;
    display_name?: string;
    profile_picture?: string | null;
  };
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followListModal, setFollowListModal] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [reposts, setReposts] = useState<RepostListEntry[]>([]);
  const [repostsLoading, setRepostsLoading] = useState(false);

  const { currentTrack, isPlaying, play, togglePlayPause, stop } = usePlayerStore();
  const { unreadCount, startPolling } = useNotificationStore();

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

  const fetchReposts = useCallback(async () => {
    if (!urlUsername) return;
    setRepostsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/reposts/`);
      if (res.ok) {
        const data = await res.json();
        setReposts(Array.isArray(data) ? data : []);
      } else {
        setReposts([]);
      }
    } catch {
      setReposts([]);
    } finally {
      setRepostsLoading(false);
    }
  }, [API_BASE_URL, urlUsername]);

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

  const toggleFollow = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || !urlUsername) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/follow/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        setFollowerCount(data.follower_count);
      }
    } catch { /* silent */ } finally {
      setFollowLoading(false);
    }
  };

  const openFollowList = async (type: 'followers' | 'following') => {
    if (!urlUsername) return;
    setFollowListModal(type);
    setFollowListLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/${type}/`);
      if (res.ok) setFollowList(await res.json());
    } catch { /* silent */ } finally {
      setFollowListLoading(false);
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

  const playRepostedTrack = (t: RepostListEntry['track']) => {
    if (currentTrack?.id === t.id && currentTrack?.type === 'track') {
      togglePlayPause();
      return;
    }
    play({
      id: t.id,
      type: 'track',
      title: t.title,
      artist: t.display_name || t.username,
      audioUrl: t.audio_file,
      coverImage: t.cover_image || t.profile_picture || null,
      artistHandle: t.username,
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
          const meRes = await apiFetch('/api/auth/profile/');
          if (meRes.ok) {
            const meData = await meRes.json();
            loggedInUsername = meData.username;
            setLoggedInUsername(meData.username);
          }
          startPolling();
        } catch { /* not logged in or token expired */ }
      }

      if (loggedInUsername && loggedInUsername === urlUsername) {
        setIsOwnProfile(true);
        try {
          const [profileRes, publicRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/auth/profile/`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            }),
            fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/`),
          ]);
          if (!profileRes.ok) throw new Error('Failed to fetch profile');
          setUser(await profileRes.json());
          if (publicRes.ok) {
            const pubData = await publicRes.json();
            setFollowerCount(pubData.follower_count ?? 0);
            setFollowingCount(pubData.following_count ?? 0);
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
          setLoading(false);
        }
      } else {
        setIsOwnProfile(false);
        try {
          const publicHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
          const res = await fetch(`${API_BASE_URL}/api/auth/users/${urlUsername}/`, { headers: publicHeaders });
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
          setFollowerCount(data.follower_count ?? 0);
          setFollowingCount(data.following_count ?? 0);
          setIsFollowing(data.is_following ?? false);
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

  useEffect(() => {
    if (activeTab === 'Reposts') fetchReposts();
  }, [activeTab, fetchReposts]);

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
      <div style={styles.pageWrapper}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageWrapper}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');`}</style>
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
    <div style={styles.pageWrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
        textarea:focus, input[type=text]:focus { outline: none; border-color: #a78bfa !important; box-shadow: 0 0 15px rgba(167, 139, 250, 0.3); }
        .profile-upload-card:hover { border-color: rgba(167, 139, 250, 0.5); background: rgba(30, 25, 50, 0.6); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .edit-icon-btn:hover { background: rgba(255,255,255,0.25) !important; transform: scale(1.05); }
        .role-pill-btn { transition: all 0.2s ease !important; }
        .role-pill-btn:hover { transform: none !important; opacity: 1 !important; }
        .edit-modal-backdrop { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
      `}</style>

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={{...styles.sidebar, bottom: currentTrack ? 72 : 0}}>
        <div style={styles.sidebarTop}>
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </div>

        <nav style={styles.sidebarNav}>
          <Link to="/home" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><HomeIcon /></span> Home
          </Link>
          <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><TrendingIcon /></span> Trending
          </Link>
          <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MusicIcon /></span> Create Music
          </Link>
          <div style={{ ...styles.sidebarLink, opacity: 0.35, cursor: 'default' }}>
            <span style={styles.sidebarIcon}><MarketplaceIcon /></span> Marketplace
          </div>
          <Link to="/notifications" className="sidebar-link" style={{ ...styles.sidebarLink, position: 'relative' }}>
            <span style={styles.sidebarIcon}><BellIcon /></span> Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', minWidth: 20, textAlign: 'center' }}>
                {unreadCount}
              </span>
            )}
          </Link>
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><ProfileIcon /></span> Profile
          </div>
        </nav>

        <div style={styles.sidebarBottom}>
          <Link to="/create" style={styles.uploadBtn}>
            + Upload Track
          </Link>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────── */}
      <div style={styles.mainArea}>

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
                    : { background: getUserGradient(user?.username || '') }),
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

      {/* Cover */}
      <div style={styles.coverWrap}>
        <div
          style={{
            ...styles.cover,
            ...(getHeaderImageUrl()
              ? { backgroundImage: `url(${getHeaderImageUrl()})` }
              : { background: getUserGradient(user?.username || '') }),
          }}
        >
          {getHeaderImageUrl() && <div style={styles.coverGradient} />}
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

          {/* Follower / Following counts */}
          <div style={styles.followStats}>
            <button type="button" onClick={() => openFollowList('followers')} style={styles.followStatBtn}>
              <strong>{followerCount}</strong> Followers
            </button>
            <button type="button" onClick={() => openFollowList('following')} style={styles.followStatBtn}>
              <strong>{followingCount}</strong> Following
            </button>
          </div>

          {/* Follow button (only on other people's profiles) */}
          {!isOwnProfile && !loading && user && (
            <button
              type="button"
              onClick={toggleFollow}
              disabled={followLoading}
              style={isFollowing ? styles.unfollowBtn : styles.followBtn}
            >
              {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}

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
          ) : activeTab === 'Reposts' ? (
            <div>
              {repostsLoading ? (
                <p style={styles.comingSoon}>Loading reposts…</p>
              ) : reposts.length === 0 ? (
                <p style={styles.comingSoon}>
                  {isOwnProfile ? 'Repost tracks you love — they’ll show up here.' : 'No reposts yet.'}
                </p>
              ) : (
                <div style={styles.trackList}>
                  {reposts.map((entry) => (
                    <div key={`${entry.track.id}-${entry.reposted_at}`} style={styles.repostCard}>
                      <div style={styles.repostCardMeta}>
                        <span style={styles.repostBadge}>
                            <RepostIcon size={14} active />
                            <span style={{ marginLeft: 6 }}>Reposted</span>
                        </span>
                        <span style={styles.repostDate}>
                          {new Date(entry.reposted_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div style={styles.trackCard}>
                        <button
                          type="button"
                          onClick={() => playRepostedTrack(entry.track)}
                          style={styles.playBtn}
                          aria-label={
                            currentTrack?.id === entry.track.id && currentTrack?.type === 'track' && isPlaying
                              ? 'Pause'
                              : 'Play'
                          }
                        >
                          {currentTrack?.id === entry.track.id && currentTrack?.type === 'track' && isPlaying
                            ? '⏸'
                            : '▶'}
                        </button>
                        <div style={styles.trackInfo}>
                          <span style={styles.trackTitle}>{entry.track.title}</span>
                          <button
                            type="button"
                            style={styles.repostOriginalArtist}
                            onClick={() => navigate(`/@${entry.track.username}`)}
                          >
                            {entry.track.display_name || entry.track.username}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/track/${entry.track.id}`)}
                          style={styles.repostOpenBtn}
                        >
                          Open
                        </button>
                      </div>
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
          aspect={cropTarget === 'pfp' ? 1 : 5.15}
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

      {/* Follow list modal */}
      {followListModal && (
        <div style={styles.modalOverlay} onClick={() => setFollowListModal(null)}>
          <div style={styles.followModal} onClick={e => e.stopPropagation()}>
            <div style={styles.followModalHeader}>
              <h3 style={styles.followModalTitle}>
                {followListModal === 'followers' ? 'Followers' : 'Following'}
              </h3>
              <button type="button" onClick={() => setFollowListModal(null)} style={styles.followModalClose}>✕</button>
            </div>
            <div style={styles.followModalBody}>
              {followListLoading ? (
                <p style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}>Loading...</p>
              ) : followList.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px', opacity: 0.5 }}>
                  {followListModal === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </p>
              ) : (
                followList.map(u => (
                  <div
                    key={u.id}
                    style={styles.followUserRow}
                    onClick={() => { setFollowListModal(null); navigate(`/@${u.username}`); }}
                  >
                    {u.profile_picture
                      ? <img src={u.profile_picture} alt="" style={styles.followUserAvatar} />
                      : <div style={styles.followUserAvatarPh}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.followUserName}>{u.display_name || u.username}</div>
                      <div style={styles.followUserHandle}>@{u.username}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
      </div>{/* end mainArea */}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0f0f1a',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffffff',
  },

  // ── Sidebar ─────────────────────────────────────────────────────────────
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: '#13131f',
    borderRight: '1px solid rgba(167,139,250,0.15)',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 100,
  },
  sidebarTop: {
    padding: '24px 20px 16px',
    borderBottom: '1px solid rgba(167,139,250,0.1)',
  },
  sidebarLogo: {
    height: 36,
    width: 'auto',
    filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.3))',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    padding: '16px 12px',
    flex: 1,
  },
  sidebarLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 10,
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  sidebarLinkActive: {
    color: '#ffffff',
    background: 'rgba(167,139,250,0.15)',
  },
  sidebarIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center' as const,
  },
  sidebarBottom: {
    padding: '16px 12px 24px',
    borderTop: '1px solid rgba(167,139,250,0.1)',
  },
  uploadBtn: {
    display: 'block',
    textAlign: 'center' as const,
    padding: '12px 20px',
    borderRadius: 9999,
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    textDecoration: 'none',
    boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
    fontFamily: "'Poppins', sans-serif",
  },

  // ── Main area ───────────────────────────────────────────────────────────
  mainArea: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto' as const,
    marginLeft: 240,
    height: '100vh',
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
    borderTopColor: '#a78bfa',
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
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(167, 139, 250, 0.3)',
  },
  coverWrap: {
    maxWidth: '1330px',
    margin: '0 auto',
    padding: '24px 24px 0',
    position: 'relative',
    zIndex: 1,
  },
  cover: {
    width: '100%',
    height: '260px',
    background: 'linear-gradient(135deg, rgba(19, 19, 31, 0.9) 0%, rgba(30, 25, 50, 0.7) 50%, rgba(40, 20, 60, 0.6) 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
  },
  coverGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, transparent 40%, rgba(15, 15, 26, 0.7) 100%)',
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
    background: '#13131f',
    border: '1px solid rgba(167, 139, 250, 0.15)',
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
    background: 'rgba(15, 15, 26, 0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(167, 139, 250, 0.12)',
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
    aspectRatio: '5.15',
    background: 'linear-gradient(135deg, rgba(19, 19, 31, 0.9) 0%, rgba(30, 25, 50, 0.7) 50%, rgba(40, 20, 60, 0.6) 100%)',
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
    border: '2px solid #0f0f1a',
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
    border: '1px solid rgba(167, 139, 250, 0.18)',
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
    border: '1px solid rgba(167, 139, 250, 0.18)',
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
    border: '1px solid rgba(167, 139, 250, 0.18)',
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
    border: '2px solid rgba(167, 139, 250, 0.18)',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  rolePillBtnActive: {
    borderColor: '#a78bfa',
    background: 'rgba(167, 139, 250, 0.12)',
    color: '#a78bfa',
    boxShadow: '0 0 20px rgba(167, 139, 250, 0.2), inset 0 0 20px rgba(167, 139, 250, 0.05)',
  },
  main: {
    maxWidth: '1280px',
    margin: '0 auto',
    marginTop: '-9px',
    position: 'relative',
    zIndex: 1,
    paddingLeft: '24px',
    paddingRight: '24px',
    borderLeft: '1px solid rgba(167, 139, 250, 0.15)',
    borderRight: '1px solid rgba(167, 139, 250, 0.15)',
    minHeight: 'calc(100vh - 53px + 284px)',
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
    background: 'rgba(30, 25, 50, 0.8)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '4px solid #0f0f1a',
    marginTop: '-70px',
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
    border: '2px solid rgba(167, 139, 250, 0.2)',
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
    background: 'rgba(167, 139, 250, 0.2)',
    color: '#a78bfa',
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
    background: 'rgba(30, 25, 50, 0.4)',
    border: '1px solid rgba(167, 139, 250, 0.15)',
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
    border: '2px solid rgba(167, 139, 250, 0.2)',
    background: 'rgba(30, 25, 50, 0.6)',
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
    accentColor: '#a78bfa',
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
    border: '2px dashed rgba(167, 139, 250, 0.25)',
    background: 'rgba(30, 25, 50, 0.4)',
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
    border: '2px solid rgba(167, 139, 250, 0.2)',
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
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(167, 139, 250, 0.3)',
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
    borderBottom: '1px solid rgba(167, 139, 250, 0.15)',
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
    color: '#a78bfa',
    fontWeight: 600,
    boxShadow: 'inset 0 -2px 0 #a78bfa',
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
    background: 'rgba(30, 25, 50, 0.35)',
    border: '1px solid rgba(167, 139, 250, 0.15)',
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
    border: '2px solid rgba(167, 139, 250, 0.2)',
    background: 'rgba(30, 25, 50, 0.6)',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
  },
  trackUploadBtn: {
    padding: '10px 20px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(167, 139, 250, 0.3)',
    whiteSpace: 'nowrap' as const,
  },
  trackCancelBtn: {
    padding: '10px 16px',
    borderRadius: '9999px',
    border: '2px solid rgba(167, 139, 250, 0.2)',
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
  repostCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    padding: '12px 14px',
    borderRadius: 14,
    background: 'rgba(20, 18, 38, 0.55)',
    border: '1px solid rgba(94, 234, 212, 0.12)',
  },
  repostCardMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  repostBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(94, 234, 212, 0.9)',
  },
  repostDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  repostOriginalArtist: {
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: 'left' as const,
    fontSize: 13,
    color: 'rgba(167, 139, 250, 0.85)',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  repostOpenBtn: {
    padding: '8px 14px',
    borderRadius: 9999,
    border: '1px solid rgba(167, 139, 250, 0.35)',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: "'Poppins', sans-serif",
  },
  trackCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'rgba(30, 25, 50, 0.35)',
    border: '1px solid rgba(167, 139, 250, 0.12)',
    transition: 'background 0.15s',
  },
  playBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 10px rgba(167, 139, 250, 0.25)',
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

  // Follow styles
  followStats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '8px',
  },
  followStatBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: "'Poppins', sans-serif",
    transition: 'color 0.2s',
  },
  followBtn: {
    padding: '8px 28px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(167,139,250,0.25)',
    transition: 'all 0.2s',
    marginBottom: '14px',
    marginRight: '15px'
  },
  unfollowBtn: {
    padding: '8px 28px',
    borderRadius: '9999px',
    border: '2px solid rgba(167,139,250,0.25)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '14px',
    marginRight: '15px'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    overflow: 'hidden',
  },
  followModal: {
    width: '100%',
    maxWidth: '420px',
    maxHeight: '70vh',
    background: '#13131f',
    borderRadius: '16px',
    border: '1px solid rgba(167,139,250,0.15)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  followModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(167,139,250,0.12)',
  },
  followModalTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: 0,
  },
  followModalClose: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
  },
  followModalBody: {
    overflowY: 'auto' as const,
    flex: 1,
    paddingRight: 4,
  },
  followUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderBottom: '1px solid rgba(167,139,250,0.06)',
  },
  followUserAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  followUserAvatarPh: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(30,25,50,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  followUserName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  followUserHandle: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
  },
};

export default ProfilePage;