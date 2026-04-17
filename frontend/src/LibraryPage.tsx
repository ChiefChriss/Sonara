import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { usePlayerStore } from './stores/playerStore';
import { useNotificationStore } from './stores/notificationStore';
import { apiFetch } from './utils/api';
import { getTrackGradient } from './utils/trackGradient';

interface LibraryItem {
    id: number;
    type: 'publication' | 'track';
    title: string;
    description: string;
    audio_file: string;
    cover_image: string | null;
    play_count: number;
    like_count: number;
    date: string;
    username: string;
    display_name: string;
    is_liked: boolean;
}

const LibraryPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');
    const { currentTrack, isPlaying, play, togglePlayPause } = usePlayerStore();
    const { unreadCount, startPolling } = useNotificationStore();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    useEffect(() => {
        document.title = 'Library | Sonara';
        const fetchLibrary = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) { navigate('/login'); return; }
            try {
                // Fetch profile for username
                const profileRes = await apiFetch('/api/auth/profile/');
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setUsername(profileData.username);
                }
                startPolling();

                const res = await apiFetch('/api/auth/library/');
                if (res.ok) {
                    const data = await res.json();
                    const pubs: LibraryItem[] = (data.publications || []).map((p: any) => ({
                        id: p.id, type: 'publication' as const,
                        title: p.title, description: p.description || '',
                        audio_file: p.audio_file, cover_image: p.cover_image,
                        play_count: p.play_count, like_count: p.like_count,
                        date: p.published_at, username: p.username,
                        display_name: p.display_name || '', is_liked: p.is_liked,
                    }));
                    const tracks: LibraryItem[] = (data.tracks || []).map((t: any) => ({
                        id: t.id, type: 'track' as const,
                        title: t.title, description: '',
                        audio_file: t.audio_file, cover_image: null,
                        play_count: t.play_count, like_count: t.like_count,
                        date: t.uploaded_at, username: t.username,
                        display_name: t.display_name || '', is_liked: t.is_liked,
                    }));
                    setItems([...pubs, ...tracks]);
                }
            } catch { /* silently fail */ } finally {
                setLoading(false);
            }
        };
        fetchLibrary();
    }, [API_BASE_URL, navigate]);

    const itemKey = (item: LibraryItem) => `${item.type}-${item.id}`;

    const togglePlay = (item: LibraryItem) => {
        if (currentTrack?.id === item.id && currentTrack?.type === item.type) {
            togglePlayPause();
            return;
        }

        play({
            id: item.id, type: item.type,
            title: item.title, artist: item.display_name || item.username,
            audioUrl: item.audio_file, coverImage: item.cover_image,
            artistHandle: item.username,
        });

        setItems((prev) =>
            prev.map((i) => (i.id === item.id && i.type === item.type) ? { ...i, play_count: i.play_count + 1 } : i)
        );
    };

    const toggleLike = async (item: LibraryItem) => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const endpoint = item.type === 'track'
            ? `${API_BASE_URL}/api/auth/tracks/${item.id}/like/`
            : `${API_BASE_URL}/api/auth/publications/${item.id}/like/`;
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (!data.liked) {
                    setItems((prev) => prev.filter((i) => !(i.id === item.id && i.type === item.type)));
                } else {
                    setItems((prev) =>
                        prev.map((i) => (i.id === item.id && i.type === item.type)
                            ? { ...i, is_liked: data.liked, like_count: data.like_count } : i)
                    );
                }
            }
        } catch { /* silently fail */ }
    };

    return (
        <div style={styles.pageWrapper}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
        .lib-row:hover { background: rgba(30, 25, 50, 0.55) !important; }
        .heart-btn:hover { transform: scale(1.15); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

            {/* ── Sidebar ── */}
            <nav className="desktop-sidebar" style={{...styles.sidebar, bottom: currentTrack ? 72 : 0}}>
                <div style={styles.sidebarTop}>
                    <Link to="/home">
                        <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
                    </Link>
                </div>
                <div style={styles.sidebarNav}>
                    <Link to="/" className="sidebar-link" style={styles.sidebarLink}>
                        <span style={styles.sidebarIcon}><HomeIcon /></span> Home
                    </Link>
                    <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
                        <span style={styles.sidebarIcon}><TrendingIcon /></span> Tracks
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
                    <Link to={username ? `/@${username}` : '/profile'} className="sidebar-link" style={styles.sidebarLink}>
                        <span style={styles.sidebarIcon}><ProfileIcon /></span> Profile
                    </Link>
                </div>
                <div style={styles.sidebarBottom}>
                    <Link to="/upload" style={styles.uploadBtn}>Upload Track</Link>
                    <Link to="/terms-of-service" style={styles.tosLink}>Terms of Service</Link>
                </div>
            </nav>

            {/* ── Main Area ── */}
            <div className="sidebar-main" style={styles.mainArea}>
                <div className="library-main" style={styles.main}>
                    <h1 style={styles.pageTitle}>Your Library</h1>

                    {loading ? (
                        <div style={styles.loadingWrap}>
                            <div style={styles.spinner} />
                            <span style={styles.loadingText}>Loading your library...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div style={styles.emptyWrap}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            <p style={styles.emptyTitle}>Your library is empty</p>
                            <p style={styles.emptySubtext}>Songs you like will appear here. Go explore and find something you love!</p>
                            <button onClick={() => navigate('/explore')} style={styles.exploreBtn}>Explore music</button>
                        </div>
                    ) : (
                        <>
                            <p style={styles.subtitle}>{items.length} liked song{items.length !== 1 ? 's' : ''}</p>

                            {/* Header row */}
                            <div style={styles.listHeader}>
                                <span style={styles.headerNum}>#</span>
                                <span style={styles.headerTitle}>Title</span>
                                <span style={styles.headerArtist}>Artist</span>
                                <span style={styles.headerPlays}>Plays</span>
                                <span style={styles.headerLikes}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                </span>
                            </div>

                            {/* Song rows */}
                            {items.map((item, idx) => (
                                <div
                                    key={itemKey(item)}
                                    className="lib-row"
                                    style={{ ...styles.row, animationDelay: `${idx * 40}ms` }}
                                >
                                    {/* Number / play */}
                                    <button
                                        type="button"
                                        onClick={() => togglePlay(item)}
                                        style={styles.numCell}
                                    >
                                        {currentTrack?.id === item.id && currentTrack?.type === item.type && isPlaying ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#a78bfa" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                        ) : (
                                            <span style={styles.rowNum}>{idx + 1}</span>
                                        )}
                                    </button>

                                    {/* Cover + Title */}
                                    <div style={styles.titleCell}>
                                        {item.cover_image ? (
                                            <img src={item.cover_image} alt="" style={styles.coverImg} />
                                        ) : (
                                            <div style={{ ...styles.coverPlaceholder, background: getTrackGradient(item.id) }} />
                                        )}
                                        <div style={styles.titleInfo}>
                                            <span style={styles.songTitle}>{item.title}</span>
                                            <span style={styles.songDesc}>
                                                {item.type === 'track' ? 'Track' : (item.description || 'Published song')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Artist */}
                                    <span
                                        style={styles.artistCell}
                                        onClick={() => navigate(`/@${item.username}`)}
                                    >
                                        {item.display_name || item.username}
                                    </span>

                                    {/* Plays */}
                                    <span style={styles.playsCell}>
                                        {item.play_count.toLocaleString()}
                                    </span>

                                    {/* Like button + count */}
                                    <div style={styles.likeCell}>
                                        <button
                                            type="button"
                                            className="heart-btn"
                                            onClick={() => toggleLike(item)}
                                            style={styles.heartBtn}
                                            title={item.is_liked ? 'Unlike' : 'Like'}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24"
                                                fill={item.is_liked ? '#ff4d6d' : 'none'}
                                                stroke={item.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.5)'}
                                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                            >
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        </button>
                                        <span style={styles.likeCount}>{item.like_count}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    // ── Page wrapper (flex: sidebar + main) ──
    pageWrapper: { display: 'flex', minHeight: '100vh', background: '#0f0f1a', fontFamily: "'Poppins', sans-serif", color: '#ffffff' },

    // ── Sidebar ──
    sidebar: { width: 240, flexShrink: 0, background: '#13131f', borderRight: '1px solid rgba(167,139,250,0.15)', display: 'flex', flexDirection: 'column' as const, position: 'fixed' as const, top: 0, left: 0, bottom: 0, overflow: 'hidden', zIndex: 100 },
    sidebarTop: { padding: '24px 20px 16px', borderBottom: '1px solid rgba(167,139,250,0.1)' },
    sidebarLogo: { height: 36, width: 'auto', filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.3))' },
    sidebarNav: { display: 'flex', flexDirection: 'column' as const, gap: 4, padding: '16px 12px', flex: 1 },
    sidebarLink: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s', cursor: 'pointer' },
    sidebarIcon: { fontSize: 18, width: 24, textAlign: 'center' as const },
    sidebarBottom: { padding: '16px 12px 24px', borderTop: '1px solid rgba(167,139,250,0.1)' },
    tosLink: { display: 'block', textAlign: 'center' as const, marginTop: '10px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', textDecoration: 'none' },
    uploadBtn: { display: 'block', textAlign: 'center' as const, padding: '12px 20px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(167,139,250,0.3)', transition: 'all 0.2s', cursor: 'pointer', border: 'none', fontFamily: "'Poppins', sans-serif" },

    // ── Main area ──
    mainArea: { flex: 1, minWidth: 0, overflowY: 'auto' as const, marginLeft: 240, height: 'calc(100vh - 64px)' },
    main: { maxWidth: '960px', margin: '0 auto', padding: '32px 24px', position: 'relative' as const, zIndex: 1 },
    pageTitle: { fontSize: '24px', fontWeight: 700, marginBottom: '16px' },
    subtitle: { fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' },

    loadingWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', paddingTop: '80px', gap: '12px' },
    spinner: { width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: '14px' },

    emptyWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: '80px', gap: '12px', textAlign: 'center' as const },
    emptyTitle: { fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' },
    emptySubtext: { fontSize: '14px', color: 'rgba(255,255,255,0.4)', maxWidth: '360px' },
    exploreBtn: {
        marginTop: '12px', padding: '12px 28px', borderRadius: '9999px', border: 'none',
        background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)', color: '#fff',
        fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
    },

    listHeader: {
        display: 'grid', gridTemplateColumns: '48px 1fr 160px 80px 80px',
        gap: '8px', alignItems: 'center', padding: '8px 12px',
        borderBottom: '1px solid rgba(167,139,250,0.15)', marginBottom: '4px',
        fontSize: '12px', fontWeight: 500,
        color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    },
    headerNum: { textAlign: 'center' as const },
    headerTitle: {},
    headerArtist: {},
    headerPlays: { textAlign: 'center' as const },
    headerLikes: { textAlign: 'center' as const, display: 'flex', justifyContent: 'center' },

    row: {
        display: 'grid', gridTemplateColumns: '48px 1fr 160px 80px 80px',
        gap: '8px', alignItems: 'center', padding: '10px 12px',
        borderRadius: '8px', transition: 'background 0.15s',
        animation: 'fadeIn 0.3s ease-out both',
    },
    numCell: {
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', fontSize: '14px', fontFamily: "'Poppins', sans-serif",
    },
    rowNum: { fontSize: '14px' },

    titleCell: { display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' },
    coverImg: { width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover' as const, flexShrink: 0 },
    coverPlaceholder: {
        width: '44px', height: '44px', borderRadius: '6px', flexShrink: 0,
        background: 'rgba(30,25,50,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    titleInfo: { display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    songTitle: { fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    songDesc: { fontSize: '12px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

    artistCell: { fontSize: '13px', color: 'rgba(167,139,250,0.8)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    playsCell: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' as const },

    likeCell: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
    heartBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px', transition: 'transform 0.15s',
    },
    likeCount: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', minWidth: '16px' },
};

export default LibraryPage;
