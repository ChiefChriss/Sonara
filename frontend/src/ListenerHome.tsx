import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from './utils/api';
import sonaraLogo from './assets/sonara_logo.svg';

const ListenerHome = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Home | Sonara';

    const verifyAuth = async () => {
      try {
        const response = await apiFetch('/api/auth/profile/');
        if (!response.ok) {
          navigate('/login');
          return;
        }
        const data = await response.json();
        setUsername(data.username);
        setLoading(false);
      } catch {
        navigate('/login');
      }
    };

    verifyAuth();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const trendingTracks = [
    { id: 1, title: 'Summer Vibes', artist: 'DJ Sunshine', plays: '1.2k', price: '$1.99' },
    { id: 2, title: 'Lo-Fi Chill', artist: 'BeatsCreator', plays: '3.5k', price: '$2.49' },
    { id: 3, title: 'Hip Hop Beats', artist: 'MC Producer', plays: '2.8k', price: '$3.99' },
    { id: 4, title: 'Electronic Dreams', artist: 'SynthWave99', plays: '4.2k', price: '$1.49' },
    { id: 5, title: 'Acoustic Sunset', artist: 'GuitarMaster', plays: '1.9k', price: '$2.99' },
    { id: 6, title: 'Jazz Night', artist: 'SmoothJazz', plays: '987', price: '$3.49' },
  ];

  const newReleases = [
    { id: 1, title: 'Neon Lights', artist: 'CityBeats', plays: '543', price: '$1.99' },
    { id: 2, title: 'Midnight Run', artist: 'NightOwl', plays: '1.1k', price: '$2.99' },
    { id: 3, title: 'Ocean Waves', artist: 'ChillMaster', plays: '876', price: '$1.49' },
    { id: 4, title: 'Fire & Ice', artist: 'DualTone', plays: '2.3k', price: '$3.99' },
    { id: 5, title: 'Urban Flow', artist: 'StreetSound', plays: '654', price: '$2.49' },
    { id: 6, title: 'Stargazer', artist: 'CosmicBeats', plays: '1.7k', price: '$1.99' },
  ];

  const cardColors = [
    'linear-gradient(135deg, #a78bfa, #ec4899)',
    'linear-gradient(135deg, #60a5fa, #a78bfa)',
    'linear-gradient(135deg, #34d399, #60a5fa)',
    'linear-gradient(135deg, #f97316, #ec4899)',
    'linear-gradient(135deg, #6ee7b7, #3b82f6)',
    'linear-gradient(135deg, #fbbf24, #f87171)',
  ];

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <img src={sonaraLogo} alt="Sonara" style={styles.logoImg} />
          <p style={styles.sidebarTagline}>Create • Share • Sell Music</p>
        </div>

        <nav style={styles.sidebarNav}>
          <div style={{ ...styles.navItem, ...styles.navItemActive }}>
            <span style={styles.navIcon}>🏠</span>
            <span>Home</span>
          </div>
          <div style={styles.navItem}>
            <span style={styles.navIcon}>🔥</span>
            <span>Trending</span>
          </div>
          <div style={styles.navItem}>
            <span style={styles.navIcon}>🎵</span>
            <Link to="/create" style={styles.navLink}>Create Music</Link>
          </div>
          <div style={styles.navItem}>
            <span style={styles.navIcon}>🛒</span>
            <span>Marketplace</span>
          </div>
          <div style={styles.navItem}>
            <span style={styles.navIcon}>👤</span>
            <Link to="/profile" style={styles.navLink}>Profile</Link>
          </div>
        </nav>

        <button style={styles.uploadButton}>⬆ Upload Track</button>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {/* Top Search Bar */}
        <div style={styles.topBar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search for artists, tracks, or genres..."
              style={styles.searchInput}
            />
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>

        {/* Hero Banner */}
        <div style={styles.heroBanner}>
          <div style={styles.heroContent}>
            <h1 style={styles.heroTitle}>Create & Sell Your Music</h1>
            <p style={styles.heroSubtitle}>All-in-one platform for music creation, distribution, and direct sales</p>
            <button style={styles.heroButton}>Start Creating</button>
          </div>
        </div>

        {/* Featured Track */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🔥 Featured Track</h2>
          <div style={styles.featuredCard}>
            <div style={styles.featuredArt}>
              <span style={styles.musicNote}>🎵</span>
            </div>
            <div style={styles.featuredInfo}>
              <h3 style={styles.featuredTitle}>Midnight Dreams</h3>
              <p style={styles.featuredArtist}>by NightProducer</p>
              <p style={styles.featuredMeta}>Posted 3 hours ago • Electronic</p>
              <div style={styles.waveform}>
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.waveBar,
                      height: `${20 + Math.random() * 30}px`,
                      opacity: i < 15 ? 1 : 0.4,
                    }}
                  />
                ))}
                <div style={styles.playButton}>▶</div>
              </div>
              <div style={styles.featuredStats}>
                <span>▶ 2.4k plays</span>
                <span>❤ 450 likes</span>
                <span>💬 28 comments</span>
                <span style={styles.featuredPrice}>$2.99</span>
              </div>
            </div>
            <div style={styles.featuredActions}>
              <button style={styles.iconBtn}>❤</button>
              <button style={styles.iconBtn}>🔗</button>
            </div>
          </div>
        </div>

        {/* Trending Now */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Trending Now</h2>
            <span style={styles.viewAll}>View all →</span>
          </div>
          <div style={styles.tracksGrid}>
            {trendingTracks.map((track, i) => (
              <div key={track.id} style={styles.trackCard}>
                <div style={{ ...styles.trackArt, background: cardColors[i % cardColors.length] }}>
                  <span style={styles.trackNote}>🎵</span>
                </div>
                <p style={styles.trackTitle}>{track.title}</p>
                <p style={styles.trackArtist}>{track.artist}</p>
                <div style={styles.trackFooter}>
                  <span style={styles.trackPlays}>{track.plays} plays</span>
                  <span style={styles.trackPrice}>{track.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* New Releases */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>New Releases</h2>
            <span style={styles.viewAll}>View all →</span>
          </div>
          <div style={styles.tracksGrid}>
            {newReleases.map((track, i) => (
              <div key={track.id} style={styles.trackCard}>
                <div style={{ ...styles.trackArt, background: cardColors[(i + 2) % cardColors.length] }}>
                  <span style={styles.trackNote}>🎵</span>
                </div>
                <p style={styles.trackTitle}>{track.title}</p>
                <p style={styles.trackArtist}>{track.artist}</p>
                <div style={styles.trackFooter}>
                  <span style={styles.trackPlays}>{track.plays} plays</span>
                  <span style={styles.trackPrice}>{track.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.4); }
        input:focus { outline: none; }
        button:hover { opacity: 0.9; transform: translateY(-1px); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f0f1a; }
        ::-webkit-scrollbar-thumb { background: #3a3a5c; border-radius: 3px; }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0f0f1a',
    fontFamily: "'Poppins', sans-serif",
    color: 'white',
  },

  // Sidebar
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    background: '#13131f',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    gap: '8px',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sidebarLogo: {
    marginBottom: '28px',
  },
  logoImg: {
    height: '36px',
    width: 'auto',
  },
  sidebarTagline: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '4px',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.55)',
    transition: 'all 0.2s',
  },
  navItemActive: {
    background: 'rgba(139,92,246,0.15)',
    color: '#a78bfa',
  },
  navIcon: {
    fontSize: '16px',
  },
  navLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  uploadButton: {
    marginTop: 'auto',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #ec4899, #a78bfa)',
    color: 'white',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Main
  main: {
    marginLeft: '220px',
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
    gap: '16px',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1c1c2e',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '10px 16px',
    flex: 1,
    maxWidth: '500px',
  },
  searchIcon: {
    fontSize: '14px',
    opacity: 0.5,
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    width: '100%',
  },
  logoutButton: {
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Hero
  heroBanner: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
    borderRadius: '16px',
    padding: '40px',
    marginBottom: '36px',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroTitle: {
    fontSize: '32px',
    fontWeight: 800,
    marginBottom: '10px',
  },
  heroSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: '24px',
  },
  heroButton: {
    padding: '12px 28px',
    borderRadius: '10px',
    border: 'none',
    background: 'white',
    color: '#1e1b4b',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Featured
  section: {
    marginBottom: '40px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '20px',
  },
  viewAll: {
    fontSize: '13px',
    color: '#a78bfa',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  featuredCard: {
    background: '#1c1c2e',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  featuredArt: {
    width: '90px',
    height: '90px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  musicNote: {
    fontSize: '28px',
  },
  featuredInfo: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: '18px',
    fontWeight: 700,
  },
  featuredArtist: {
    fontSize: '13px',
    color: '#a78bfa',
    margin: '4px 0',
  },
  featuredMeta: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '12px',
  },
  waveform: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    marginBottom: '12px',
    height: '50px',
  },
  waveBar: {
    width: '4px',
    background: 'linear-gradient(to top, #a78bfa, #ec4899)',
    borderRadius: '2px',
    transition: 'height 0.3s',
  },
  playButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    cursor: 'pointer',
    marginLeft: '8px',
    flexShrink: 0,
  },
  featuredStats: {
    display: 'flex',
    gap: '20px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
  },
  featuredPrice: {
    color: '#34d399',
    fontWeight: 700,
    marginLeft: 'auto',
  },
  featuredActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },

  // Tracks Grid
  tracksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '16px',
  },
  trackCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  trackArt: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px',
  },
  trackNote: {
    fontSize: '24px',
    opacity: 0.8,
  },
  trackTitle: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackArtist: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '6px',
  },
  trackFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackPlays: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
  },
  trackPrice: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#34d399',
  },
};

export default ListenerHome;
