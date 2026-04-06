import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { usePlayerStore } from './stores/playerStore';
import { useNotificationStore } from './stores/notificationStore';
import { apiFetch } from './utils/api';
import { getTrackGradient } from './utils/trackGradient';

interface Track {
  id: number;
  title: string;
  audio_file: string;
  cover_image: string | null;
  uploaded_at: string;
  play_count: number;
  like_count: number;
  username: string;
  display_name: string;
  profile_picture: string | null;
  is_liked: boolean;
}

interface Publication {
  id: number;
  title: string;
  description: string;
  audio_file: string;
  cover_image: string | null;
  play_count: number;
  like_count: number;
  published_at: string;
  username: string;
  display_name: string;
  profile_picture: string | null;
  is_liked: boolean;
}

const ExplorePage = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const { currentTrack, isPlaying, play, togglePlayPause } = usePlayerStore();
  const { unreadCount, startPolling } = useNotificationStore();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    document.title = 'Explore | Sonara';
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch username for profile link
    const fetchProfile = async () => {
      if (!token) return;
      try {
        const res = await apiFetch('/api/auth/profile/');
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
        }
        startPolling();
      } catch { /* silently fail */ }
    };

    const fetchTracks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/explore/`, { headers });
        if (res.ok) setTracks(await res.json());
      } catch { /* silently fail */ }
    };

    const fetchPublications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/feed/`, { headers });
        if (res.ok) setPublications(await res.json());
      } catch { /* silently fail */ }
    };

    Promise.all([fetchProfile(), fetchTracks(), fetchPublications()]).finally(() => setLoading(false));
  }, [API_BASE_URL]);

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id && currentTrack?.type === 'track') {
      togglePlayPause();
    } else {
      play({
        id: track.id, type: 'track',
        title: track.title, artist: track.display_name || track.username,
        audioUrl: track.audio_file, coverImage: null,
        artistHandle: track.username,
      });
      setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, play_count: t.play_count + 1 } : t));
    }
  };

  const handlePlayPub = (pub: Publication) => {
    if (currentTrack?.id === pub.id && currentTrack?.type === 'publication') {
      togglePlayPause();
    } else {
      play({
        id: pub.id, type: 'publication',
        title: pub.title, artist: pub.display_name || pub.username,
        audioUrl: pub.audio_file, coverImage: pub.cover_image,
        artistHandle: pub.username,
      });
      setPublications((prev) => prev.map((p) => p.id === pub.id ? { ...p, play_count: p.play_count + 1 } : p));
    }
  };

  const isTrackPlaying = (id: number) => currentTrack?.id === id && currentTrack?.type === 'track' && isPlaying;
  const isPubPlaying = (id: number) => currentTrack?.id === id && currentTrack?.type === 'publication' && isPlaying;

  const toggleLike = async (pubId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/publications/${pubId}/like/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPublications((prev) =>
          prev.map((p) => p.id === pubId ? { ...p, is_liked: data.liked, like_count: data.like_count } : p)
        );
      }
    } catch { /* silently fail */ }
  };

  const toggleTrackLike = async (trackId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/tracks/${trackId}/like/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTracks((prev) =>
          prev.map((t) => t.id === trackId ? { ...t, is_liked: data.liked, like_count: data.like_count } : t)
        );
      }
    } catch { /* silently fail */ }
  };

  const profileLink = username ? `/@${username}` : '/profile';

  /* ── Sidebar (shared layout) ─────────────────────────────────────────────── */
  const renderSidebar = () => (
    <nav style={{...styles.sidebar, bottom: currentTrack ? 72 : 0}}>
      <div style={styles.sidebarTop}>
        <Link to="/home">
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </Link>
      </div>
      <div style={styles.sidebarNav as React.CSSProperties}>
        <Link to="/" className="sidebar-link" style={styles.sidebarLink}>
          <span style={styles.sidebarIcon as React.CSSProperties}><HomeIcon /></span> Home
        </Link>
        <Link to="/explore" className="sidebar-link" style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
          <span style={styles.sidebarIcon as React.CSSProperties}><TrendingIcon /></span> Tracks
        </Link>
        <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
          <span style={styles.sidebarIcon as React.CSSProperties}><MusicIcon /></span> Create Music
        </Link>
        <div style={{ ...styles.sidebarLink, opacity: 0.35, cursor: 'default' }}>
          <span style={styles.sidebarIcon as React.CSSProperties}><MarketplaceIcon /></span> Marketplace
        </div>
        <Link to="/notifications" className="sidebar-link" style={{ ...styles.sidebarLink, position: 'relative' }}>
          <span style={styles.sidebarIcon as React.CSSProperties}><BellIcon /></span> Notifications
          {unreadCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', minWidth: 20, textAlign: 'center' }}>
              {unreadCount}
            </span>
          )}
        </Link>
        <Link to={profileLink} className="sidebar-link" style={styles.sidebarLink}>
          <span style={styles.sidebarIcon as React.CSSProperties}><ProfileIcon /></span> Profile
        </Link>
      </div>
      <div style={styles.sidebarBottom}>
        <Link to="/create" style={styles.uploadBtn}>Upload Track</Link>
      </div>
    </nav>
  );

  return (
    <div style={styles.pageWrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        button:hover { opacity: 0.9; }
        .explore-card:hover { background: rgba(30, 25, 50, 0.55) !important; transform: translateY(-2px); }
        .explore-card:hover .card-play-btn { opacity: 1 !important; }
        .card-heart-btn:hover { transform: scale(1.15); }
        .heart-btn:hover { transform: scale(1.15); }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {renderSidebar()}

      <div style={styles.mainArea}>
        <div style={styles.main}>
          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <span style={styles.loadingText}>Loading tracks...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div style={styles.emptyWrap}>
              <p style={styles.emptyText}>No tracks have been uploaded yet. Be the first!</p>
              <button onClick={() => navigate('/create')} style={styles.createBtn}>Create a track</button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Uploaded Tracks</h2>
              <div style={styles.grid}>
                {tracks.map((track) => (
                  <div key={track.id} className="explore-card" style={styles.card}>
                    <div className="card-img-wrap" style={styles.cardImageWrap} onClick={() => navigate(`/track/${track.id}`)}>
                      {track.cover_image ? (
                        <img src={track.cover_image} alt="" style={styles.cardImage} />
                      ) : (
                        <div style={{ ...styles.cardGradient, background: getTrackGradient(track.id) }} />
                      )}
                      <button
                        className="card-play-btn"
                        style={{ ...styles.cardPlayBtn, opacity: isTrackPlaying(track.id) ? 1 : undefined }}
                        onClick={(e) => { e.stopPropagation(); handlePlayTrack(track); }}
                      >
                        {isTrackPlaying(track.id) ? '\u23F8' : '\u25B6'}
                      </button>
                      <button
                        type="button"
                        className="card-heart-btn"
                        onClick={(e) => { e.stopPropagation(); toggleTrackLike(track.id); }}
                        style={{ ...styles.cardHeartBtn, color: track.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.7)' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24"
                          fill={track.is_liked ? '#ff4d6d' : 'none'}
                          stroke={track.is_liked ? '#ff4d6d' : 'currentColor'}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                    </div>
                    <div style={styles.cardBody} onClick={() => navigate(`/track/${track.id}`)}>
                      <span style={styles.trackTitle}>{track.title}</span>
                      <span style={styles.trackArtist} onClick={(e) => { e.stopPropagation(); navigate(`/@${track.username}`); }}>
                        {track.display_name || `@${track.username}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                          {'\u25B6'} {track.play_count}
                        </span>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {track.like_count}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Published Songs with Like buttons */}
              {publications.length > 0 && (
                <>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '48px', marginBottom: '16px' }}>Published Tracks</h2>
                  <div style={styles.grid}>
                    {publications.map((pub) => (
                      <div key={pub.id} className="explore-card" style={styles.card}>
                        <div className="card-img-wrap" style={styles.cardImageWrap} onClick={() => navigate(`/publication/${pub.id}`)}>
                          {pub.cover_image ? (
                            <img src={pub.cover_image} alt="" style={styles.cardImage} />
                          ) : (
                            <div style={{ ...styles.cardGradient, background: getTrackGradient(pub.id) }} />
                          )}
                          <button
                            className="card-play-btn"
                            style={{ ...styles.cardPlayBtn, opacity: isPubPlaying(pub.id) ? 1 : undefined }}
                            onClick={(e) => { e.stopPropagation(); handlePlayPub(pub); }}
                          >
                            {isPubPlaying(pub.id) ? '\u23F8' : '\u25B6'}
                          </button>
                          <button
                            type="button"
                            className="card-heart-btn"
                            onClick={(e) => { e.stopPropagation(); toggleLike(pub.id); }}
                            style={{ ...styles.cardHeartBtn, color: pub.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.7)' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24"
                              fill={pub.is_liked ? '#ff4d6d' : 'none'}
                              stroke={pub.is_liked ? '#ff4d6d' : 'currentColor'}
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                        </div>
                        <div style={styles.cardBody} onClick={() => navigate(`/publication/${pub.id}`)}>
                          <span style={styles.trackTitle}>{pub.title}</span>
                          <span style={styles.trackArtist} onClick={(e) => { e.stopPropagation(); navigate(`/@${pub.username}`); }}>
                            {pub.display_name || `@${pub.username}`}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                              {pub.like_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  /* ── Sidebar layout ──────────────────────────────────────────────────────── */
  pageWrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0f0f1a',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffffff',
  },
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
  mainArea: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto' as const,
    marginLeft: 240,
    height: 'calc(100vh - 64px)',
  },

  /* ── Content area ────────────────────────────────────────────────────────── */
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '32px 24px 64px',
    position: 'relative' as const,
    zIndex: 1,
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '24px',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '80px',
    gap: '12px',
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
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    paddingTop: '80px',
    gap: '20px',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '16px',
  },
  createBtn: {
    padding: '12px 28px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  card: {
    borderRadius: '16px',
    background: 'rgba(30, 25, 50, 0.35)',
    border: '1px solid rgba(167, 139, 250, 0.15)',
    transition: 'background 0.2s, transform 0.2s',
    cursor: 'default',
    overflow: 'hidden',
  },
  cardImageWrap: {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '1',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  cardGradient: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #1a1035, #2d1b69, #4c1d95)',
  },
  cardPlayBtn: {
    position: 'absolute' as const,
    bottom: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.15s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  cardHeartBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  playBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#ffffff',
    fontSize: '17px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 12px rgba(167, 139, 250, 0.3)',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    cursor: 'pointer',
  },
  avatarPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(30, 25, 50, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    padding: '12px 14px 14px',
    cursor: 'pointer',
  },
  trackTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  trackArtist: {
    fontSize: '13px',
    color: 'rgba(167, 139, 250, 0.8)',
    cursor: 'pointer',
  },
  trackDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  heartBtnInline: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    transition: 'transform 0.15s',
  },
};

export default ExplorePage;
