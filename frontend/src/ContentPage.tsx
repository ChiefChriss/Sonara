import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePlayerStore } from './stores/playerStore';
import sonaraLogo from './assets/sonara_logo.svg';

interface ContentData {
    id: number;
    title: string;
    display_name?: string;
    username: string;
    audio_file: string;
    cover_image?: string | null;
    description?: string;
    play_count: number;
    like_count: number;
    is_liked: boolean;
    uploaded_at?: string;
    published_at?: string;
}

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const ContentPage = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<ContentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [username, setUsername] = useState('');
    const { currentTrack, isPlaying, play, togglePlayPause } = usePlayerStore();

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    useEffect(() => {
        if (!type || !id || (type !== 'track' && type !== 'publication')) {
            setError(true);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('accessToken');
                const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

                // Fetch profile for sidebar username
                if (token) {
                    try {
                        const profileRes = await fetch(`${API_BASE_URL}/api/auth/profile/`, { headers });
                        if (profileRes.ok) {
                            const profileData = await profileRes.json();
                            setUsername(profileData.username);
                        }
                    } catch { /* silently fail */ }
                }

                const endpoint = type === 'track' ? 'tracks' : 'publications';
                const res = await fetch(`${API_BASE_URL}/api/auth/${endpoint}/${id}/detail/`, { headers });
                if (!res.ok) throw new Error('Not found');
                const json = await res.json();
                setData(json);
                document.title = `${json.title} by ${json.display_name || json.username} | Sonara`;
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [type, id, API_BASE_URL]);

    const sidebar = (
        <aside style={styles.sidebar}>
            <style>{`.sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }`}</style>
            <div style={styles.sidebarTop}>
                <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
            </div>

            <nav style={styles.sidebarNav}>
                <Link to="/home" className="sidebar-link" style={styles.sidebarLink}>
                    <span style={styles.sidebarIcon}>🏠</span> Home
                </Link>
                <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
                    <span style={styles.sidebarIcon}>🔥</span> Trending
                </Link>
                <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
                    <span style={styles.sidebarIcon}>🎵</span> Create Music
                </Link>
                <div style={{ ...styles.sidebarLink, opacity: 0.35, cursor: 'default' }}>
                    <span style={styles.sidebarIcon}>🛒</span> Marketplace
                </div>
                <Link to={username ? `/@${username}` : '/profile'} className="sidebar-link" style={styles.sidebarLink}>
                    <span style={styles.sidebarIcon}>👤</span> Profile
                </Link>
            </nav>

            <div style={styles.sidebarBottom}>
                <Link to="/create" style={styles.uploadBtn}>
                    + Upload Track
                </Link>
            </div>
        </aside>
    );

    if (loading) {
        return (
            <div style={styles.pageWrapper}>
                {sidebar}
                <div style={styles.mainArea}>
                    <div style={styles.loadingWrap}>
                        <div style={styles.spinner} />
                        <span style={styles.loadingText}>Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={styles.pageWrapper}>
                {sidebar}
                <div style={styles.mainArea}>
                    <div style={styles.loadingWrap}>
                        <h2>Track not found</h2>
                        <button onClick={() => navigate(-1)} style={styles.backBtn}>Go Back</button>
                    </div>
                </div>
            </div>
        );
    }

    const isThisItemPlaying = currentTrack?.id === data.id && currentTrack?.type === type;

    const handlePlayToggle = () => {
        if (isThisItemPlaying) {
            togglePlayPause();
        } else {
            play({
                id: data.id,
                type: type as 'track' | 'publication',
                title: data.title,
                artist: data.display_name || data.username,
                audioUrl: data.audio_file,
                coverImage: data.cover_image || null,
                artistHandle: data.username,
            });
            setData({ ...data, play_count: data.play_count + 1 });
        }
    };

    const handleLikeToggle = async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) { navigate('/login'); return; }
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const res = await fetch(`${API_BASE_URL}/api/auth/${endpoint}/${id}/like/`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const json = await res.json();
                setData({ ...data, is_liked: json.liked, like_count: json.like_count });
            }
        } catch { /* silently fail */ }
    };

    const coverUrl = data.cover_image || null;
    const dateStr = data.published_at || data.uploaded_at;
    const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString() : '';

    return (
        <div style={styles.pageWrapper}>
            {sidebar}
            <div style={styles.mainArea}>
                {/* Hero Banner Area */}
                <div style={styles.heroBox}>
                    {/* Blurred background extracted from cover image */}
                    {coverUrl && (
                        <div style={{ ...styles.heroBgBlur, backgroundImage: `url(${coverUrl})` }} />
                    )}

                    <div style={styles.heroContent}>
                        {/* Large cover image */}
                        <div style={styles.coverWrapper}>
                            {coverUrl ? (
                                <img src={coverUrl} alt="Cover" style={styles.coverImg} />
                            ) : (
                                <div style={styles.coverPlaceholder}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                </div>
                            )}
                        </div>

                        {/* Info section */}
                        <div style={styles.infoWrapper}>
                            <div style={styles.titleRow}>
                                <button onClick={handlePlayToggle} style={styles.bigPlayBtn}>
                                    {isThisItemPlaying && isPlaying ? (
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#000" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                    ) : (
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#000" stroke="none" style={{ marginLeft: '4px' }}><polygon points="5,3 19,12 5,21" /></svg>
                                    )}
                                </button>
                                <div style={styles.textStack}>
                                    <h1 style={styles.heroTitle}>{data.title}</h1>
                                    <h2 style={styles.heroArtist} onClick={() => navigate(`/@${data.username}`)}>
                                        {data.display_name || data.username}
                                    </h2>
                                </div>
                            </div>

                            <div style={styles.statsRow}>
                                <button
                                    onClick={handleLikeToggle}
                                    style={{ ...styles.actionBtn, ...(data.is_liked ? { color: '#ff4d6d', borderColor: 'rgba(255,77,109,0.5)' } : {}) }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill={data.is_liked ? '#ff4d6d' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                    {formatNumber(data.like_count)}
                                </button>
                                <div style={styles.statPill} title="Plays">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><polygon points="5 3 19 12 5 21"></polygon></svg>
                                    {formatNumber(data.play_count)}
                                </div>
                                <div style={styles.statPill}>
                                    {dateFormatted}
                                </div>
                            </div>

                            {/* Description placeholder, fake waveform container */}
                            <div style={styles.waveformContainer}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontStyle: 'italic', marginBottom: '8px' }}>
                                    {data.description || 'No description provided.'}
                                </div>
                                <div style={styles.fakeWaveform}>
                                    {[...Array(60)].map((_, i) => (
                                        <div key={i} style={{
                                            width: '3px',
                                            height: `${20 + Math.random() * 80}%`,
                                            background: 'rgba(255,255,255,0.3)',
                                            borderRadius: '2px'
                                        }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    // ── Sidebar + Layout ──────────────────────────────────────────────────────
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
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
    },
    sidebarTop: { padding: '24px 20px 16px', borderBottom: '1px solid rgba(167,139,250,0.1)' },
    sidebarLogo: { height: 36, width: 'auto', filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.3))' },
    sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 12px', flex: 1 },
    sidebarLink: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s', cursor: 'pointer' },
    sidebarIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    sidebarBottom: { padding: '16px 12px 24px', borderTop: '1px solid rgba(167,139,250,0.1)' },
    uploadBtn: { display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(167,139,250,0.3)', transition: 'all 0.2s', cursor: 'pointer', border: 'none', fontFamily: "'Poppins', sans-serif" },
    mainArea: { flex: 1, minWidth: 0, overflowY: 'auto' },

    // ── Content styles ────────────────────────────────────────────────────────
    loadingWrap: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: '12px',
    },
    spinner: {
        width: '32px', height: '32px',
        border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#a78bfa',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    loadingText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' },
    backBtn: {
        marginTop: '16px', padding: '8px 24px', background: 'rgba(255,255,255,0.1)',
        border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer',
    },
    heroBox: {
        width: '100%',
        height: '420px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(167,139,250,0.1)',
    },
    heroBgBlur: {
        position: 'absolute',
        top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(60px) brightness(0.4)',
        zIndex: 0,
    },
    heroContent: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '1000px',
        padding: '0 40px',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
    },
    coverWrapper: {
        width: '280px',
        height: '280px',
        borderRadius: '8px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        flexShrink: 0,
        background: '#1a1a2e',
    },
    coverImg: {
        width: '100%', height: '100%', objectFit: 'cover' as const,
    },
    coverPlaceholder: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    infoWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    bigPlayBtn: {
        width: '64px', height: '64px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
        border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(167,139,250,0.4)',
        flexShrink: 0,
    },
    textStack: {
        display: 'flex', flexDirection: 'column' as const, gap: '4px',
    },
    heroTitle: {
        fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1.2,
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    },
    heroArtist: {
        fontSize: '18px', fontWeight: 400, color: 'rgba(255,255,255,0.8)',
        margin: 0, cursor: 'pointer',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    },
    statsRow: {
        display: 'flex', alignItems: 'center', gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '20px',
    },
    actionBtn: {
        display: 'flex', alignItems: 'center',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '4px',
        padding: '6px 12px',
        color: '#fff', fontSize: '14px', cursor: 'pointer',
        transition: 'all 0.2s',
    },
    statPill: {
        display: 'flex', alignItems: 'center',
        color: 'rgba(255,255,255,0.6)', fontSize: '14px',
    },
    waveformContainer: {
        marginTop: '10px',
        display: 'flex', flexDirection: 'column' as const, gap: '8px',
    },
    fakeWaveform: {
        height: '60px', width: '100%',
        display: 'flex', alignItems: 'center', gap: '2px',
        opacity: 0.6,
    }
};

export default ContentPage;
