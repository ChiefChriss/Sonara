import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';

interface SearchUser {
  id: number;
  username: string;
  profile_picture: string | null;
  bio: string;
  role: string;
}

interface SearchTrack {
  id: number;
  title: string;
  audio_file: string;
  uploaded_at: string;
  username: string;
  profile_picture: string | null;
}

interface SearchPublication {
  id: number;
  title: string;
  description: string;
  audio_file: string;
  cover_image: string | null;
  play_count: number;
  published_at: string;
  username: string;
  profile_picture: string | null;
}

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [tracks, setTracks] = useState<SearchTrack[]>([]);
  const [publications, setPublications] = useState<SearchPublication[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setTracks([]);
      setPublications([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/search/?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTracks(data.tracks || []);
        setPublications(data.publications || []);
      }
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    document.title = initialQuery ? `Search: ${initialQuery} | Sonara` : 'Search | Sonara';
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(value.trim() ? { q: value.trim() } : {}, { replace: true });
      runSearch(value);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchParams(query.trim() ? { q: query.trim() } : {}, { replace: true });
      runSearch(query);
    }
  };

  const togglePlay = (audioFile: string, key: string) => {
    if (playingId === key) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioFile);
    audio.addEventListener('ended', () => setPlayingId(null));
    audio.play();
    audioRef.current = audio;
    setPlayingId(key);
  };

  const totalResults = users.length + tracks.length + publications.length;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundOverlay} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder { color: rgba(255, 255, 255, 0.5); }
        input:focus { outline: none; border-color: #00d4ff; box-shadow: 0 0 15px rgba(0, 212, 255, 0.3); }
        button:hover { opacity: 0.9; }
        .search-result-row:hover { background: rgba(30, 45, 80, 0.5) !important; }
      `}</style>

      <header style={styles.topBar}>
        <Link to="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src={sonaraLogo} alt="Sonara" style={styles.logo} />
        </Link>
        <div style={styles.searchBarWrap}>
          <input
            type="text"
            placeholder="Search users, tracks, posts..."
            style={styles.searchInput}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {loading && <span style={styles.spinner}>...</span>}
        </div>
        <div style={{ width: '50px' }} />
      </header>

      <div style={styles.main}>
        {!hasSearched && !loading && (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Search for users, tracks, or posts</p>
          </div>
        )}

        {hasSearched && !loading && totalResults === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No results for "{query}"</p>
          </div>
        )}

        {users.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>People</h2>
            <div style={styles.userGrid}>
              {users.map((u) => (
                <div
                  key={u.id}
                  className="search-result-row"
                  style={styles.userCard}
                  onClick={() => navigate(`/@${u.username}`)}
                >
                  {u.profile_picture ? (
                    <img src={u.profile_picture} alt="" style={styles.userAvatar} />
                  ) : (
                    <div style={styles.userAvatarPlaceholder}>
                      <span style={{ fontSize: '24px', opacity: 0.6 }}>👤</span>
                    </div>
                  )}
                  <div style={styles.userInfo}>
                    <span style={styles.userName}>@{u.username}</span>
                    <span style={styles.userRole}>
                      {u.role === 'both' ? 'Listener & Creator' : u.role === 'none' ? '' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                    {u.bio && (
                      <span style={styles.userBio}>{u.bio.length > 80 ? u.bio.slice(0, 80) + '...' : u.bio}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tracks.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Tracks</h2>
            <div style={styles.resultList}>
              {tracks.map((t) => {
                const key = `track-${t.id}`;
                return (
                  <div key={key} className="search-result-row" style={styles.resultRow}>
                    <button
                      type="button"
                      onClick={() => togglePlay(t.audio_file, key)}
                      style={styles.playBtn}
                    >
                      {playingId === key ? '⏸' : '▶'}
                    </button>
                    <div style={styles.resultInfo}>
                      <span style={styles.resultTitle}>{t.title}</span>
                      <span
                        style={styles.resultArtist}
                        onClick={() => navigate(`/@${t.username}`)}
                      >
                        @{t.username}
                      </span>
                    </div>
                    <span style={styles.resultDate}>
                      {new Date(t.uploaded_at).toLocaleDateString()}
                    </span>
                    {t.profile_picture && (
                      <img src={t.profile_picture} alt="" style={styles.resultAvatar} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {publications.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Posts</h2>
            <div style={styles.resultList}>
              {publications.map((p) => {
                const key = `pub-${p.id}`;
                return (
                  <div key={key} className="search-result-row" style={styles.resultRow}>
                    <button
                      type="button"
                      onClick={() => togglePlay(p.audio_file, key)}
                      style={styles.playBtn}
                    >
                      {playingId === key ? '⏸' : '▶'}
                    </button>
                    <div style={styles.resultInfo}>
                      <span style={styles.resultTitle}>{p.title}</span>
                      <span
                        style={styles.resultArtist}
                        onClick={() => navigate(`/@${p.username}`)}
                      >
                        @{p.username}
                      </span>
                      {p.description && (
                        <span style={styles.resultDesc}>
                          {p.description.length > 100 ? p.description.slice(0, 100) + '...' : p.description}
                        </span>
                      )}
                    </div>
                    <div style={styles.resultMeta}>
                      <span style={styles.resultDate}>
                        {new Date(p.published_at).toLocaleDateString()}
                      </span>
                      {p.play_count > 0 && (
                        <span style={styles.playCount}>{p.play_count} plays</span>
                      )}
                    </div>
                    {p.profile_picture && (
                      <img src={p.profile_picture} alt="" style={styles.resultAvatar} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
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
    gap: '20px',
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
  searchBarWrap: {
    flex: 1,
    maxWidth: '600px',
    position: 'relative' as const,
  },
  searchInput: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '12px',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    backgroundColor: 'rgba(30, 45, 80, 0.6)',
    color: 'white',
    fontSize: '15px',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  spinner: {
    position: 'absolute' as const,
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    pointerEvents: 'none' as const,
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 24px',
    position: 'relative',
    zIndex: 1,
  },
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '80px',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '16px',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(100, 150, 200, 0.15)',
  },
  userGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'rgba(30, 45, 80, 0.3)',
    border: '1px solid rgba(100, 150, 200, 0.12)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  userAvatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  userAvatarPlaceholder: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'rgba(30, 45, 80, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  userName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
  },
  userRole: {
    fontSize: '12px',
    color: 'rgba(0, 212, 255, 0.8)',
  },
  userBio: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  resultList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 16px',
    borderRadius: '14px',
    background: 'rgba(30, 45, 80, 0.3)',
    border: '1px solid rgba(100, 150, 200, 0.12)',
    transition: 'background 0.15s',
  },
  playBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #00d4ff 0%, #0096c7 100%)',
    color: '#ffffff',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 10px rgba(0, 212, 255, 0.25)',
  },
  resultInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  resultTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  resultArtist: {
    fontSize: '13px',
    color: 'rgba(0, 212, 255, 0.8)',
    cursor: 'pointer',
  },
  resultDesc: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: '2px',
  },
  resultMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '2px',
    flexShrink: 0,
  },
  resultDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
    flexShrink: 0,
  },
  playCount: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  resultAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
};

export default SearchPage;
