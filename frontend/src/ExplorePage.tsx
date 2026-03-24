import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import { usePlayerStore } from './stores/playerStore';

interface Track {
  id: number;
  title: string;
  audio_file: string;
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
  const { currentTrack, isPlaying, play, togglePlayPause } = usePlayerStore();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    document.title = 'Explore | Sonara';
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

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

    Promise.all([fetchTracks(), fetchPublications()]).finally(() => setLoading(false));
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

  return (
    <div style={styles.page}>
      <div style={styles.backgroundOverlay} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        button:hover { opacity: 0.9; }
        .explore-card:hover { background: rgba(30, 45, 80, 0.55) !important; transform: translateY(-2px); }
        .heart-btn:hover { transform: scale(1.15); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <header style={styles.topBar}>
        <Link to="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src={sonaraLogo} alt="Sonara" style={styles.logo} />
        </Link>
        <span style={styles.pageTitle}>Explore</span>
        <div style={{ width: '50px' }} />
      </header>

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
            <p style={styles.subtitle}>{tracks.length} track{tracks.length !== 1 ? 's' : ''} from the community</p>
            <div style={styles.grid}>
              {tracks.map((track) => (
                <div key={track.id} className="explore-card" style={styles.card}>
                  <div style={styles.cardTop}>
                    <button
                      type="button"
                      onClick={() => handlePlayTrack(track)}
                      style={styles.playBtn}
                    >
                      {isTrackPlaying(track.id) ? '⏸' : '▶'}
                    </button>
                    <button
                      type="button"
                      className="heart-btn"
                      onClick={() => toggleTrackLike(track.id)}
                      style={styles.heartBtnInline}
                      title={track.is_liked ? 'Unlike' : 'Like'}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"
                        fill={track.is_liked ? '#ff4d6d' : 'none'}
                        stroke={track.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.5)'}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  <div style={styles.cardBody}>
                    <span style={styles.trackTitle}>{track.title}</span>
                    <span
                      style={styles.trackArtist}
                      onClick={() => navigate(`/@${track.username}`)}
                    >
                      {track.display_name || `@${track.username}`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                      <span style={styles.trackDate}>
                        {new Date(track.uploaded_at).toLocaleDateString()}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ▶ {track.play_count}
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
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '48px', marginBottom: '16px' }}>Published Songs</h2>
                <div style={styles.grid}>
                  {publications.map((pub) => (
                    <div key={pub.id} className="explore-card" style={styles.card}>
                      <div style={styles.cardTop}>
                        <button
                          type="button"
                          onClick={() => handlePlayPub(pub)}
                          style={styles.playBtn}
                        >
                          {isPubPlaying(pub.id) ? '⏸' : '▶'}
                        </button>
                        <button
                          type="button"
                          className="heart-btn"
                          onClick={() => toggleLike(pub.id)}
                          style={styles.heartBtnInline}
                          title={pub.is_liked ? 'Unlike' : 'Like'}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24"
                            fill={pub.is_liked ? '#ff4d6d' : 'none'}
                            stroke={pub.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.5)'}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      </div>
                      <div style={styles.cardBody}>
                        <span style={styles.trackTitle}>{pub.title}</span>
                        <span
                          style={styles.trackArtist}
                          onClick={() => navigate(`/@${pub.username}`)}
                        >
                          {pub.display_name || `@${pub.username}`}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                          <span style={styles.trackDate}>
                            {new Date(pub.published_at).toLocaleDateString()}
                          </span>
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
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(100, 100, 200, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px',
    padding: '0 24px',
    background: 'rgba(10, 10, 26, 0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(100, 150, 200, 0.2)',
  },
  logo: {
    height: '32px',
    width: 'auto',
    filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.15))',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 700,
  },
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '32px 24px',
    position: 'relative',
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
    borderTopColor: '#00d4ff',
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
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '16px',
    borderRadius: '16px',
    background: 'rgba(30, 45, 80, 0.35)',
    border: '1px solid rgba(100, 150, 200, 0.15)',
    transition: 'background 0.2s, transform 0.2s',
    cursor: 'default',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  playBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '17px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 12px rgba(0, 212, 255, 0.3)',
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
    background: 'rgba(30, 45, 80, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
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
    color: 'rgba(0, 212, 255, 0.8)',
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
