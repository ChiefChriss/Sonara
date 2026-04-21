import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayerStore } from './stores/playerStore';
import { apiFetch } from './utils/api';
import { getApiBaseUrl } from './utils/apiBase';
import { useNotificationStore } from './stores/notificationStore';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import RepostIcon from './components/RepostIcon';
import TrackPageWaveform from './components/TrackPageWaveform';
import { getTrackGradient } from './utils/trackGradient';
import { getUserGradient } from './utils/userGradient';
import Footer from './components/Footer';
import { PlayGlyph, PauseGlyph, PlayPauseLabel } from './components/MediaIcons';

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
  is_liked?: boolean;
  uploaded_at?: string;
  published_at?: string;
}

interface FollowingRepostItem {
  activity_type?: 'repost' | 'upload';
  timestamp?: string;
  reposted_at?: string;
  reposter_username: string;
  reposter_display_name: string;
  reposter_profile_picture: string | null;
  track: Track;
}

const repostTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── Gradient palette removed – now using getTrackGradient from utils ────────

// ── Component ────────────────────────────────────────────────────────────────

const ListenerHome = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  // Chris: real API data
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [followingReposts, setFollowingReposts] = useState<FollowingRepostItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Chris: player store
  const globalPlayerState = usePlayerStore();
  const { unreadCount, startPolling } = useNotificationStore();
  const API_BASE_URL = getApiBaseUrl();

  // ── Auth + data fetch (Chris) ─────────────────────────────────────────────

  useEffect(() => {
    document.title = 'Home | Sonara';
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }

    const init = async () => {
      try {
        const profileRes = await apiFetch('/api/auth/profile/');
        if (!profileRes.ok) return;
        const profileData = await profileRes.json();
        setUsername(profileData.username);
        startPolling();

        const [newRes, exploreRes, feedRes, followingRepostsRes] = await Promise.all([
          apiFetch('/api/auth/new-releases/'),
          apiFetch('/api/auth/explore/'),
          apiFetch('/api/auth/feed/'),
          apiFetch('/api/auth/following-reposts/'),
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

        if (newRes.ok) setNewReleases(fmt(await newRes.json()));

        // Combine tracks + publications
        const tracks = exploreRes.ok ? fmt(await exploreRes.json()) : [];
        const pubs = feedRes.ok
          ? (await feedRes.json()).map((p: any) => ({ ...p, type: 'publication' as const }))
          : [];
        setAllTracks([...tracks, ...pubs].sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0)));
        if (followingRepostsRes.ok) {
          const raw = await followingRepostsRes.json();
          setFollowingReposts(Array.isArray(raw) ? raw : []);
        }
      } catch {
        navigate('/login');
      } finally {
        setContentLoading(false);
      }
    };
    init();
  }, [navigate, API_BASE_URL]);

  // ── Playback helpers (Chris) ──────────────────────────────────────────────

  const toQueueItem = (item: Track) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    artist: item.display_name || item.username || 'Unknown',
    audioUrl: item.audio_file,
    coverImage: item.cover_image || item.profile_picture || null,
    artistHandle: item.username,
  });

  const buildHomeQueue = () => {
    const seen = new Set<string>();
    const items: Track[] = [];
    for (const t of [allTracks[0], ...newReleases]) {
      if (!t) continue;
      const key = `${t.type}-${t.id}`;
      if (!seen.has(key)) { seen.add(key); items.push(t); }
    }
    return items.map(toQueueItem);
  };

  const playTrack = (item: Track) => {
    const queue = buildHomeQueue();
    usePlayerStore.getState().play(toQueueItem(item), { queue });
  };

  const isPlaying = (item: Track) =>
    globalPlayerState.currentTrack?.id === item.id &&
    globalPlayerState.currentTrack?.type === item.type &&
    globalPlayerState.isPlaying;

  const formatCount = (n?: number) => {
    if (!n) return '0';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  };

  const toggleLike = async (item: Track) => {
    const endpoint = item.type === 'track'
      ? `/api/auth/tracks/${item.id}/like/`
      : `/api/auth/publications/${item.id}/like/`;
    try {
      const res = await apiFetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const update = (list: Track[]) => list.map(t =>
          t.id === item.id && t.type === item.type
            ? { ...t, is_liked: data.liked, like_count: data.like_count ?? ((t.like_count ?? 0) + (data.liked ? 1 : -1)) }
            : t
        );
        setAllTracks(update);
        setNewReleases(update);
      }
    } catch { /* silent */ }
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  /** Track card with cover image, play button, and like button */
  const TrackCard = ({ item, index }: { item: Track; index: number }) => {
    const playing = isPlaying(item);
    return (
      <div style={styles.trackCard}>
        <div className="card-img-wrap" style={{ ...styles.cardImageWrap, cursor: 'pointer' }} onClick={() => navigate(`/${item.type}/${item.id}`)}>
          {item.cover_image ? (
            <img src={item.cover_image} alt="" style={styles.cardImage} />
          ) : (
            <div style={{ ...styles.cardGradient, background: getTrackGradient(item.id) }} />
          )}
          <button
            className="card-play-btn"
            style={{ ...styles.cardPlayBtn, opacity: playing ? 1 : undefined }}
            onClick={(e) => { e.stopPropagation(); playing ? globalPlayerState.togglePlayPause() : playTrack(item); }}
          >
            {playing ? <PauseGlyph size={15} fill="#fff" /> : <PlayGlyph size={15} fill="#fff" />}
          </button>
          <button
            type="button"
            className="card-heart-btn"
            onClick={(e) => { e.stopPropagation(); toggleLike(item); }}
            style={{ ...styles.cardHeartBtn, color: item.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.7)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill={item.is_liked ? '#ff4d6d' : 'none'}
              stroke={item.is_liked ? '#ff4d6d' : 'currentColor'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ ...styles.cardPlays, display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
              <PlayGlyph size={10} fill="rgba(255,255,255,0.4)" />
              {formatCount(item.play_count)}
            </p>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              {formatCount(item.like_count)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /** Repost from someone you follow — secondary home feed strip */
  const FollowingRepostRow = ({ item }: { item: FollowingRepostItem }) => {
    const t = { ...item.track, type: (item.track.type || 'track') as Track['type'] };
    const playing = isPlaying(t);
    const name = item.reposter_display_name || item.reposter_username;
    const isUpload = item.activity_type === 'upload';
    const time = item.timestamp || item.reposted_at || '';
    return (
      <div style={styles.followingRepostWrap}>
        <button
          type="button"
          style={styles.followingRepostHeader}
          onClick={() => navigate(`/@${item.reposter_username}`)}
        >
          {item.reposter_profile_picture ? (
            <img src={item.reposter_profile_picture} alt="" style={styles.followingRepostAvatar} />
          ) : (
            <div style={{...styles.followingRepostAvatarPh, background: getUserGradient(item.reposter_username), color: '#fff', fontWeight: 700, fontFamily: "'Poppins', sans-serif", fontSize: 12}}>{item.reposter_username ? item.reposter_username[0].toUpperCase() : '?'}</div>
          )}
          <span style={styles.followingRepostHeaderText}>
            <strong style={{ color: '#e9d5ff' }}>{name}</strong>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
              {' '}
              {isUpload ? 'uploaded' : 'reposted'} · {repostTimeAgo(time)}
            </span>
          </span>
        </button>
        <div style={styles.row} className="track-row">
          <div style={{ ...styles.rowThumb, position: 'relative' }}>
            {t.cover_image ? (
              <img src={t.cover_image} alt="" style={styles.rowThumbImg} />
            ) : (
              <div style={{ ...styles.rowThumbPh, background: getTrackGradient(t.id) }} />
            )}
            <button
              style={{ ...styles.rowPlay, opacity: playing ? 1 : undefined }}
              onClick={() => (playing ? globalPlayerState.togglePlayPause() : playTrack(t))}
            >
              {playing ? <PauseGlyph size={18} fill="#a78bfa" /> : <PlayGlyph size={18} fill="#a78bfa" />}
            </button>
            {t.profile_picture && (
              <img
                src={t.profile_picture}
                alt=""
                style={styles.rowAvatarBadge}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/@${t.username}`);
                }}
              />
            )}
          </div>
          <div style={styles.rowInfo} onClick={() => navigate(`/${t.type}/${t.id}`)}>
            <span style={styles.rowTitle}>{t.title}</span>
            <span
              style={styles.rowArtist}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/@${t.username}`);
              }}
            >
              {t.display_name || t.username}
            </span>
          </div>
          <div style={styles.waveWrap}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.waveBar,
                  height: `${10 + Math.abs(Math.sin(i * 0.8) * 12)}px`,
                  background: playing
                    ? `rgba(94,234,212,${0.25 + (i % 3) * 0.15})`
                    : `rgba(100,150,200,${0.15 + (i % 3) * 0.1})`,
                }}
              />
            ))}
          </div>
          <span style={{ ...styles.rowCount, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <PlayGlyph size={11} fill="rgba(255,255,255,0.35)" />
            {formatCount(t.play_count)}
          </span>
        </div>
      </div>
    );
  };

  // ── Render (Tony's layout with sidebar) ───────────────────────────────────

  return (
    <div style={styles.pageWrapper}>
      {/* ── Sidebar (Tony) ──────────────────────────────────────────────────── */}
      <aside className="desktop-sidebar" style={{...styles.sidebar, bottom: globalPlayerState.currentTrack ? 72 : 0}}>
        <div style={styles.sidebarTop}>
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </div>

        <nav style={styles.sidebarNav}>
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><HomeIcon /></span> Home
          </div>
          <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><TrendingIcon /></span> Tracks
          </Link>
          <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MusicIcon /></span> Create Music
          </Link>

          {/* ── CHANGED: Marketplace is now a real link instead of greyed out ── */}
          <Link to="/marketplace" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MarketplaceIcon /></span> Marketplace
          </Link>

          <Link to="/notifications" className="sidebar-link" style={{ ...styles.sidebarLink, position: 'relative' }}>
            <span style={styles.sidebarIcon}><BellIcon /></span> Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', minWidth: 20, textAlign: 'center' }}>
                {unreadCount}
              </span>
            )}
          </Link>
          <Link to={username ? `/@${username}` : '/profile'} className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><ProfileIcon /></span> Profile
          </Link>
        </nav>

        <div style={styles.sidebarBottom}>
          <Link to={username ? `/@${username}?tab=Tracks` : '/profile?tab=Tracks'} style={styles.uploadBtn}>
            + Upload Track
          </Link>
          <Link to="/terms-of-service" style={styles.tosLink}>Terms of Service</Link>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="sidebar-main" style={styles.mainArea}>
        {/* ── Hero banner (Tony) ──────────────────────────────────────────── */}
        <div className="hero-responsive" style={styles.heroBanner}>
          <div style={styles.heroOverlay} />
          <div style={styles.heroContent}>
            <h1 className="hero-title-responsive" style={styles.heroTitle}>Listen. Create. Connect.</h1>
            <p className="hero-subtitle-responsive" style={styles.heroSubtitle}>Discover your next favorite sound or make your own.</p>
          </div>
        </div>

        {/* ── Featured Track (Tony design, real data) ─────────────────────── */}
        {!contentLoading && allTracks.length > 0 && (
          <section className="content-padding" style={styles.featuredSection}>
            <h2 style={styles.sectionTitle}>Featured Track</h2>
            <div className="featured-responsive" style={styles.featuredCard}>
              <div className="card-img-wrap featured-left-responsive" style={{ ...styles.featuredLeft, cursor: 'pointer', position: 'relative' }} onClick={() => navigate(`/${allTracks[0].type}/${allTracks[0].id}`)}>
                {allTracks[0].cover_image ? (
                  <img src={allTracks[0].cover_image} alt="" style={styles.featuredImage} />
                ) : (
                  <div style={{ ...styles.featuredImagePh, background: getTrackGradient(allTracks[0].id) }} />
                )}
                <button
                  type="button"
                  className="card-heart-btn"
                  onClick={(e) => { e.stopPropagation(); toggleLike(allTracks[0]); }}
                  style={{ ...styles.cardHeartBtn, color: allTracks[0].is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.7)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"
                    fill={allTracks[0].is_liked ? '#ff4d6d' : 'none'}
                    stroke={allTracks[0].is_liked ? '#ff4d6d' : 'currentColor'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                {allTracks[0].profile_picture && (
                  <img
                    src={allTracks[0].profile_picture}
                    alt=""
                    style={styles.featuredAvatarBadge}
                    onClick={(e) => { e.stopPropagation(); navigate(`/@${allTracks[0].username}`); }}
                  />
                )}
              </div>
              <div style={styles.featuredRight}>
                <p style={styles.featuredLabel}>NOW PLAYING</p>
                <h3 style={{ ...styles.featuredTitle, cursor: 'pointer' }} onClick={() => navigate(`/${allTracks[0].type}/${allTracks[0].id}`)}>{allTracks[0].title}</h3>
                <p
                  style={styles.featuredArtist}
                  onClick={() => navigate(`/@${allTracks[0].username}`)}
                >
                  {allTracks[0].display_name || allTracks[0].username}
                </p>
                {/* Waveform visualization */}
                <div style={{ marginTop: 8 }}>
                  <TrackPageWaveform
                    audioUrl={allTracks[0].audio_file}
                    isActive={
                      globalPlayerState.currentTrack?.id === allTracks[0].id &&
                      globalPlayerState.currentTrack?.type === allTracks[0].type
                    }
                    waveHeight={48}
                  />
                </div>
                <div style={styles.featuredActions}>
                  <button
                    style={styles.featuredPlayBtn}
                    onClick={() =>
                      isPlaying(allTracks[0])
                        ? globalPlayerState.togglePlayPause()
                        : playTrack(allTracks[0])
                    }
                  >
                    <PlayPauseLabel playing={isPlaying(allTracks[0])} />
                  </button>
                  <span style={{ ...styles.featuredPlays, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <PlayGlyph size={12} fill="rgba(255,255,255,0.45)" />
                    {formatCount(allTracks[0].play_count)}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                    {formatCount(allTracks[0].like_count)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div className="content-padding" style={styles.mainContent}>
          {contentLoading ? (
            <div style={{ textAlign: 'center', margin: '40px 0', opacity: 0.6 }}>
              Loading featured tracks…
            </div>
          ) : (
            <>
              {/* New Releases grid */}
              {newReleases.length > 0 && (
                <section style={styles.section}>
                  <div style={styles.sectionHead}>
                    <h2 style={{ ...styles.sectionTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      New Releases
                    </h2>
                    <Link to="/explore" style={styles.seeAll}>See all</Link>
                  </div>
                  <div className="track-grid-responsive" style={styles.trackGrid}>
                    {newReleases.slice(0, 6).map((item, idx) => (
                      <TrackCard key={`nr-${item.type}-${item.id}`} item={item} index={idx + 3} />
                    ))}
                  </div>
                </section>
              )}

              {/* Reposts from people you follow */}
              {followingReposts.length > 0 && (
                <section style={styles.section}>
                  <div style={styles.sectionHead}>
                    <h2 style={{ ...styles.sectionTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      From people you follow
                    </h2>
                    <span style={styles.sectionSubtle}>Recent activity</span>
                  </div>
                  <div style={styles.followingRepostList}>
                    {followingReposts.map((fr) => (
                      <FollowingRepostRow key={`${fr.activity_type}-${fr.reposter_username}-${fr.track.id}-${fr.timestamp || fr.reposted_at}`} item={fr} />
                    ))}
                  </div>
                </section>
              )}
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
        .card-heart-btn:hover { transform: scale(1.15); }
        .track-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
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
    position: 'fixed',
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
  tosLink: {
    display: 'block',
    textAlign: 'center' as const,
    marginTop: '10px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.3)',
    textDecoration: 'none',
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
    marginLeft: 240,
    height: 'calc(100vh - 64px)',
    overflowY: 'auto',
  },

  // ── Hero banner (Tony) ────────────────────────────────────────────────────
  heroBanner: {
    position: 'relative',
    height: 200,
    flexShrink: 0,
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
  sectionSubtle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 500,
  },
  followingRepostList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  followingRepostWrap: {
    borderRadius: 14,
    border: '1px solid rgba(94, 234, 212, 0.12)',
    background: 'rgba(15, 22, 32, 0.5)',
    overflow: 'hidden',
  },
  followingRepostHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.2)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: "'Poppins', sans-serif",
    fontSize: 13,
  },
  followingRepostAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  followingRepostAvatarPh: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(167,139,250,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  followingRepostHeaderText: {
    flex: 1,
    minWidth: 0,
    lineHeight: 1.35,
  },

  // ── Track grid (Tony's 6-column gradient cards) ───────────────────────────
  trackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 16,
  },
  trackCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s',
    minWidth: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
  },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    background: '#1c1c2e',
    border: '1px solid rgba(167,139,250,0.15)',
    flexShrink: 0,
  },
  cardImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  cardGradient: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  cardPlayBtn: {
    position: 'absolute',
    zIndex: 2,
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
  cardHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    zIndex: 2,
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
    paddingTop: 2,
    minWidth: 0,
  },
  rowTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 3,
  },
  rowArtist: {
    display: 'block',
    fontSize: 12,
    color: '#ec4899',
    lineHeight: 1.35,
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
    transition: 'height 0.1s',
  },
  rowCount: {
    flexShrink: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    width: 56,
    textAlign: 'right',
  },

  // Avatar badges
  cardAvatarBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #13131f',
    cursor: 'pointer',
    zIndex: 2,
  } as React.CSSProperties,
  featuredAvatarBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #13131f',
    cursor: 'pointer',
    zIndex: 2,
  } as React.CSSProperties,
  rowAvatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1.5px solid #13131f',
    cursor: 'pointer',
    zIndex: 2,
  } as React.CSSProperties,
};

export default ListenerHome;