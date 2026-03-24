import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayerStore } from './stores/playerStore';
import sonaraLogo from './assets/sonara_logo.svg';

// ── Interfaces (Chris) ──────────────────────────────────────────────────────

interface Track {
  id: number;
  title: string;
  audio_file: string;
  username: string;
  display_name?: string;
  profile_picture: string | null;
  cover_image?: string | null;
  type: 'track' | 'publication';
  play_count?: number;
  like_count?: number;
  uploaded_at?: string;
  published_at?: string;
}

interface SearchUser {
  id: number;
  username: string;
  profile_picture: string | null;
  bio: string;
  role: string;
}

// ── Gradient palette for cards without cover images (Tony) ───────────────────

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #34d399 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #a78bfa 100%)',
];

const getGradient = (id: number) => CARD_GRADIENTS[id % CARD_GRADIENTS.length];

// ── Component ────────────────────────────────────────────────────────────────

const ListenerHome = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  // Chris: real API data
  const [trending, setTrending] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Chris: search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Chris: player store
  const globalPlayerState = usePlayerStore();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  // ── Auth + data fetch (Chris) ─────────────────────────────────────────────

  useEffect(() => {
    document.title = 'Home | Sonara';
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }

    const init = async () => {
      try {
        const profileRes = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileRes.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          navigate('/login');
          return;
        }
        const profileData = await profileRes.json();
        setUsername(profileData.username);

        const [trendRes, newRes, exploreRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/trending/`),
          fetch(`${API_BASE_URL}/api/auth/new-releases/`),
          fetch(`${API_BASE_URL}/api/auth/explore/`),
        ]);

        const fmt = (d: any): Track[] => {
          if (Array.isArray(d)) {
            return d.map((t: any) => ({ ...t, type: (t.type || 'track') as Track['type'] }));
          }
          return [
            ...(d.tracks || []).map((t: any) => ({ ...t, type: 'track' as const })),
            ...(d.publications || []).map((p: any) => ({ ...p, type: 'publication' as const })),
          ];
        };

        if (trendRes.ok) setTrending(fmt(await trendRes.json()));
        if (newRes.ok) setNewReleases(fmt(await newRes.json()));
        if (exploreRes.ok) setAllTracks(fmt(await exploreRes.json()));
      } catch {
        navigate('/login');
      } finally {
        setContentLoading(false);
      }
    };
    init();
  }, [navigate, API_BASE_URL]);

  // ── Close search dropdown on outside click (Chris) ────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node))
        setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search logic (Chris) ──────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchUsers([]); setSearchResults([]); setSearchOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/search/?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchUsers(data.users || []);
        setSearchResults([
          ...(data.publications || []).map((p: any) => ({ ...p, type: 'publication' as const })),
          ...(data.tracks || []).map((t: any) => ({ ...t, type: 'track' as const })),
        ]);
        setSearchOpen(true);
      }
    } catch { /* silent */ } finally { setSearching(false); }
  }, [API_BASE_URL]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) { setSearchUsers([]); setSearchResults([]); setSearchOpen(false); return; }
    searchTimerRef.current = setTimeout(() => runSearch(value), 300);
  };

  // ── Playback helpers (Chris) ──────────────────────────────────────────────

  const playTrack = (item: Track) => {
    usePlayerStore.getState().play({
      id: item.id,
      type: item.type,
      title: item.title,
      artist: item.display_name || item.username || 'Unknown',
      audioUrl: item.audio_file,
      coverImage: item.cover_image || item.profile_picture || null,
      artistHandle: item.username,
    });
  };

  const isPlaying = (item: Track) =>
    globalPlayerState.currentTrack?.id === item.id &&
    globalPlayerState.currentTrack?.type === item.type &&
    globalPlayerState.isPlaying;

  const formatCount = (n?: number) => {
    if (!n) return '0';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  };

  // ── Logout (Chris: stops player) ──────────────────────────────────────────

  const handleLogout = () => {
    usePlayerStore.getState().stop();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    navigate('/login');
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  /** Tony's gradient card design + Chris's play/data wiring */
  const TrackCard = ({ item, index }: { item: Track; index: number }) => {
    const cover = item.cover_image || item.profile_picture;
    const playing = isPlaying(item);
    return (
      <div style={styles.trackCard}>
        <div className="card-img-wrap" style={styles.cardImageWrap}>
          {cover ? (
            <img src={cover} alt="" style={styles.cardImage} />
          ) : (
            <div style={{ ...styles.cardGradient, background: getGradient(index) }} />
          )}
          <button
            className="card-play-btn"
            style={{ ...styles.cardPlayBtn, opacity: playing ? 1 : undefined }}
            onClick={() => playing ? globalPlayerState.togglePlayPause() : playTrack(item)}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
        <div style={styles.cardTextWrap} onClick={() => navigate(`/${item.type}/${item.id}`)}>
          <p style={styles.cardTitle}>{item.title}</p>
          <p
            style={styles.cardArtist}
            onClick={(e) => { e.stopPropagation(); navigate(`/@${item.username}`); }}
          >
            {item.display_name || item.username}
          </p>
          <p style={styles.cardPlays}>▶ {formatCount(item.play_count)}</p>
        </div>
      </div>
    );
  };

  /** Chris's TrackRow for the All Tracks feed */
  const TrackRow = ({ item }: { item: Track }) => {
    const cover = item.cover_image || item.profile_picture;
    const playing = isPlaying(item);
    return (
      <div style={styles.row} className="track-row">
        <div style={styles.rowThumb}>
          {cover ? (
            <img src={cover} alt="" style={styles.rowThumbImg} />
          ) : (
            <div style={styles.rowThumbPh}>🎵</div>
          )}
          <button
            style={{ ...styles.rowPlay, opacity: playing ? 1 : undefined }}
            onClick={() => playing ? globalPlayerState.togglePlayPause() : playTrack(item)}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
        <div style={styles.rowInfo} onClick={() => navigate(`/${item.type}/${item.id}`)}>
          <span style={styles.rowTitle}>{item.title}</span>
          <span
            style={styles.rowArtist}
            onClick={(e) => { e.stopPropagation(); navigate(`/@${item.username}`); }}
          >
            {item.display_name || item.username}
          </span>
        </div>
        {/* Waveform placeholder */}
        <div style={styles.waveWrap}>
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} style={{
              ...styles.waveBar,
              height: `${12 + Math.abs(Math.sin(i * 0.8) * 16 + Math.cos(i * 0.3) * 8)}px`,
              background: playing
                ? `rgba(167,139,250,${0.35 + (i % 3) * 0.2})`
                : `rgba(100,150,200,${0.2 + (i % 3) * 0.15})`,
            }} />
          ))}
        </div>
        <span style={styles.rowCount}>▶ {formatCount(item.play_count)}</span>
      </div>
    );
  };

  // ── Render (Tony's layout with sidebar) ───────────────────────────────────

  return (
    <div style={styles.pageWrapper}>
      {/* ── Sidebar (Tony) ──────────────────────────────────────────────────── */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </div>

        <nav style={styles.sidebarNav}>
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}>🏠</span> Home
          </div>
          <Link to="/explore" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}>🔥</span> Trending
          </Link>
          <Link to="/create" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}>🎵</span> Create Music
          </Link>
          <Link to="/explore" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}>🛒</span> Marketplace
          </Link>
          <Link to={username ? `/@${username}` : '/profile'} style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}>👤</span> Profile
          </Link>
        </nav>

        <div style={styles.sidebarBottom}>
          <Link to="/create" style={styles.uploadBtn}>
            + Upload Track
          </Link>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div style={styles.mainArea}>
        {/* ── Top bar (Tony layout + Chris search) ────────────────────────── */}
        <header style={styles.topBar}>
          <div ref={searchWrapRef} style={styles.searchWrap}>
            <input
              type="text"
              placeholder="Search tracks or artists..."
              style={styles.searchInput}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setSearchOpen(false);
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              onFocus={() => { if (searchResults.length > 0 || searchUsers.length > 0) setSearchOpen(true); }}
            />
            {searching && <span style={styles.searchSpinner}>...</span>}

            {/* ── Search dropdown (Chris) ──────────────────────────────────── */}
            {searchOpen && (searchUsers.length > 0 || searchResults.length > 0) && (
              <div style={styles.searchDropdown}>
                {searchUsers.length > 0 && (
                  <>
                    <div style={styles.dropLabel}>People</div>
                    {searchUsers.map((u) => (
                      <div
                        key={`u-${u.id}`}
                        style={styles.dropRow}
                        onClick={() => { setSearchOpen(false); navigate(`/@${u.username}`); }}
                      >
                        {u.profile_picture
                          ? <img src={u.profile_picture} alt="" style={styles.dropAvatar} />
                          : <div style={styles.dropAvatarPh}>👤</div>}
                        <div>
                          <div style={styles.dropName}>{u.username}</div>
                          <div style={styles.dropSub}>{u.role === 'both' ? 'Listener & Creator' : u.role}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {searchResults.length > 0 && (
                  <>
                    <div style={styles.dropLabel}>Tracks & Posts</div>
                    {searchResults.map((r) => (
                      <div key={`r-${r.type}-${r.id}`} style={styles.dropRow}>
                        <button style={styles.dropPlayBtn} onClick={() => playTrack(r)}>▶</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={styles.dropName}>{r.title}</div>
                          <div
                            style={styles.dropSub}
                            onClick={() => { setSearchOpen(false); navigate(`/@${r.username}`); }}
                          >
                            @{r.username}
                          </div>
                        </div>
                        <span style={{ ...styles.dropTag, ...(r.type === 'publication' ? styles.dropTagPub : {}) }}>
                          {r.type === 'publication' ? 'POST' : 'TRACK'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                <div
                  style={styles.dropSeeAll}
                  onClick={() => { setSearchOpen(false); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
                >
                  See all results
                </div>
              </div>
            )}
          </div>

          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </header>

        {/* ── Hero banner (Tony) ──────────────────────────────────────────── */}
        <div style={styles.heroBanner}>
          <div style={styles.heroOverlay} />
          <div style={styles.heroContent}>
            <h1 style={styles.heroTitle}>Listen. Create. Connect.</h1>
            <p style={styles.heroSubtitle}>Discover your next favorite sound or make your own.</p>
          </div>
        </div>

        {/* ── Featured Track (Tony design, real data) ─────────────────────── */}
        {!contentLoading && trending.length > 0 && (
          <section style={styles.featuredSection}>
            <h2 style={styles.sectionTitle}>Featured Track</h2>
            <div style={styles.featuredCard}>
              <div style={styles.featuredLeft}>
                {(trending[0].cover_image || trending[0].profile_picture) ? (
                  <img src={(trending[0].cover_image || trending[0].profile_picture)!} alt="" style={styles.featuredImage} />
                ) : (
                  <div style={{ ...styles.featuredImagePh, background: getGradient(trending[0].id) }} />
                )}
              </div>
              <div style={styles.featuredRight}>
                <p style={styles.featuredLabel}>NOW PLAYING</p>
                <h3 style={{ ...styles.featuredTitle, cursor: 'pointer' }} onClick={() => navigate(`/${trending[0].type}/${trending[0].id}`)}>{trending[0].title}</h3>
                <p
                  style={styles.featuredArtist}
                  onClick={() => navigate(`/@${trending[0].username}`)}
                >
                  {trending[0].display_name || trending[0].username}
                </p>
                {/* Waveform visualization (Tony) */}
                <div style={styles.featuredWaveWrap}>
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        borderRadius: 2,
                        background: isPlaying(trending[0])
                          ? `rgba(167,139,250,${0.4 + (i % 3) * 0.2})`
                          : `rgba(167,139,250,${0.2 + (i % 4) * 0.1})`,
                        height: `${8 + Math.abs(Math.sin(i * 0.5) * 20 + Math.cos(i * 0.3) * 10)}px`,
                      }}
                    />
                  ))}
                </div>
                <div style={styles.featuredActions}>
                  <button
                    style={styles.featuredPlayBtn}
                    onClick={() =>
                      isPlaying(trending[0])
                        ? globalPlayerState.togglePlayPause()
                        : playTrack(trending[0])
                    }
                  >
                    {isPlaying(trending[0]) ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <span style={styles.featuredPlays}>▶ {formatCount(trending[0].play_count)}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div style={styles.mainContent}>
          {contentLoading ? (
            <div style={{ textAlign: 'center', margin: '40px 0', opacity: 0.6 }}>
              Loading featured tracks…
            </div>
          ) : (
            <>
              {/* Trending Now grid (Tony's 6-col card grid, Chris data) */}
              {trending.length > 0 && (
                <section style={styles.section}>
                  <div style={styles.sectionHead}>
                    <h2 style={styles.sectionTitle}>🔥 Trending Now</h2>
                    <Link to="/explore" style={styles.seeAll}>See all</Link>
                  </div>
                  <div style={styles.trackGrid}>
                    {trending.slice(0, 6).map((item, idx) => (
                      <TrackCard key={`tr-${item.type}-${item.id}`} item={item} index={idx} />
                    ))}
                  </div>
                </section>
              )}

              {/* New Releases grid */}
              {newReleases.length > 0 && (
                <section style={styles.section}>
                  <div style={styles.sectionHead}>
                    <h2 style={styles.sectionTitle}>✨ New Releases</h2>
                    <Link to="/explore" style={styles.seeAll}>See all</Link>
                  </div>
                  <div style={styles.trackGrid}>
                    {newReleases.slice(0, 6).map((item, idx) => (
                      <TrackCard key={`nr-${item.type}-${item.id}`} item={item} index={idx + 3} />
                    ))}
                  </div>
                </section>
              )}

              {/* All Tracks feed (Chris's TrackRow) */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>All Tracks</h2>
                {allTracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                    <p style={{ fontSize: 36, marginBottom: 12 }}>🎵</p>
                    <p>No tracks uploaded yet. Be the first!</p>
                    <Link to="/create" style={styles.uploadBtn}>Upload a Track</Link>
                  </div>
                ) : (
                  <div style={styles.trackList}>
                    {allTracks.map((item) => (
                      <TrackRow key={`all-${item.type}-${item.id}`} item={item} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Global CSS ──────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.6); }
        input:focus { outline: none; border-color: #a78bfa !important; box-shadow: 0 0 15px rgba(167,139,250,0.3); }
        button:hover { transform: translateY(-1px); }
        .card-play-btn { opacity: 0; transition: opacity 0.15s; }
        .card-img-wrap:hover .card-play-btn { opacity: 1 !important; }
        .track-row:hover { background: rgba(255,255,255,0.04) !important; }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
      `}</style>
    </div>
  );
};

// ── Styles (Tony's design: dark theme with purples/pinks, inline style object) ─

const styles: Record<string, React.CSSProperties> = {
  // Layout
  pageWrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0f0f1a',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffffff',
  },

  // ── Sidebar (Tony) ────────────────────────────────────────────────────────
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: '#13131f',
    borderRight: '1px solid rgba(167,139,250,0.15)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
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
    flexDirection: 'column',
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
    textAlign: 'center',
  },
  sidebarBottom: {
    padding: '16px 12px 24px',
    borderTop: '1px solid rgba(167,139,250,0.1)',
  },
  uploadBtn: {
    display: 'block',
    textAlign: 'center',
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

  // ── Main area ─────────────────────────────────────────────────────────────
  mainArea: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    padding: '0 32px',
    background: 'rgba(19,19,31,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(167,139,250,0.12)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  searchWrap: {
    position: 'relative',
    flex: 1,
    maxWidth: 480,
  },
  searchInput: {
    width: '100%',
    padding: '10px 20px',
    borderRadius: 12,
    border: '1.5px solid rgba(167,139,250,0.3)',
    background: 'rgba(28,28,46,0.8)',
    color: 'white',
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  searchSpinner: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    pointerEvents: 'none',
  },
  searchDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    maxHeight: 360,
    overflowY: 'auto',
    background: 'rgba(19,19,31,0.97)',
    border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: 12,
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  dropLabel: {
    padding: '8px 14px 4px',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 14px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '1px solid rgba(167,139,250,0.08)',
  },
  dropAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  dropAvatarPh: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'rgba(28,28,46,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    flexShrink: 0,
  },
  dropName: { fontSize: 13, fontWeight: 600, color: '#fff' },
  dropSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' },
  dropPlayBtn: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTag: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 6,
    background: 'rgba(167,139,250,0.25)',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dropTagPub: {
    background: 'rgba(236,72,153,0.3)',
    color: 'rgba(236,72,153,0.9)',
  },
  dropSeeAll: {
    padding: '10px 14px',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: '#a78bfa',
    cursor: 'pointer',
    borderTop: '1px solid rgba(167,139,250,0.12)',
  },
  logoutButton: {
    padding: '10px 24px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #ff6b6b, #dd4a4a)',
    color: 'white',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    boxShadow: '0 3px 12px rgba(255,100,100,0.25)',
    transition: 'all 0.2s',
    marginLeft: 16,
    flexShrink: 0,
  },

  // ── Hero banner (Tony) ────────────────────────────────────────────────────
  heroBanner: {
    position: 'relative',
    height: 200,
    background: 'linear-gradient(135deg, #1c1c2e 0%, #a78bfa 50%, #ec4899 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15,15,26,0.55)',
    pointerEvents: 'none',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #ffffff, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Featured track (Tony) ─────────────────────────────────────────────────
  featuredSection: {
    padding: '32px 32px 0',
  },
  featuredCard: {
    display: 'flex',
    gap: 24,
    padding: 24,
    borderRadius: 16,
    background: '#1c1c2e',
    border: '1px solid rgba(167,139,250,0.2)',
    marginTop: 16,
  },
  featuredLeft: {
    width: 180,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  featuredImagePh: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  featuredRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#a78bfa',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
  },
  featuredArtist: {
    fontSize: 14,
    color: '#ec4899',
    cursor: 'pointer',
  },
  featuredWaveWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: 36,
    overflow: 'hidden',
    marginTop: 8,
    opacity: 0.7,
  },
  featuredActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  featuredPlayBtn: {
    padding: '10px 28px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  featuredPlays: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Main content area ─────────────────────────────────────────────────────
  mainContent: {
    padding: '32px 32px 120px',
  },
  section: {
    marginBottom: 48,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
  },
  seeAll: {
    fontSize: 13,
    color: '#a78bfa',
    fontWeight: 600,
    textDecoration: 'none',
  },

  // ── Track grid (Tony's 6-column gradient cards) ───────────────────────────
  trackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 16,
  },
  trackCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    background: '#1c1c2e',
    border: '1px solid rgba(167,139,250,0.15)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardGradient: {
    width: '100%',
    height: '100%',
  },
  cardPlayBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(167,139,250,0.4)',
    transition: 'opacity 0.15s',
  },
  cardTextWrap: {
    cursor: 'pointer',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 3,
  },
  cardArtist: {
    fontSize: 12,
    color: '#ec4899',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    marginBottom: 2,
  },
  cardPlays: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },

  // ── Track list / rows (Chris's TrackRow) ──────────────────────────────────
  trackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 16px',
    borderRadius: 16,
    background: 'rgba(28,28,46,0.5)',
    border: '1px solid rgba(167,139,250,0.12)',
    transition: 'background 0.2s, transform 0.2s',
    cursor: 'default',
  },
  rowThumb: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
    background: 'rgba(28,28,46,0.6)',
  },
  rowThumbImg: {
    width: 52,
    height: 52,
    objectFit: 'cover',
  },
  rowThumbPh: {
    width: 52,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    color: 'rgba(255,255,255,0.15)',
  },
  rowPlay: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'rgba(0,0,0,0.55)',
    color: '#a78bfa',
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  rowInfo: {
    width: 190,
    flexShrink: 0,
    cursor: 'pointer',
  },
  rowTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 3,
  },
  rowArtist: {
    display: 'block',
    fontSize: 12,
    color: '#ec4899',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  waveWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: 36,
    overflow: 'hidden',
    opacity: 0.7,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  rowCount: {
    flexShrink: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    width: 56,
    textAlign: 'right',
  },
};

export default ListenerHome;
