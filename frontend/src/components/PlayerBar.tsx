import { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayerStore, PlayerTrack } from '../stores/playerStore';

const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

const PlayerBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentTrack, isPlaying, currentTime, duration, volume, togglePlayPause, seek, setVolume, stop } = usePlayerStore();
    const progressRef = useRef<HTMLDivElement>(null);

    const handleProgressClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!progressRef.current || !duration) return;
            const rect = progressRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            seek(pct * duration);
        },
        [duration, seek],
    );

    const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];
    if (authRoutes.includes(location.pathname) || !currentTrack) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const gradientInnerPct = progress > 0 ? Math.min(50000, 10000 / Math.max(progress, 0.02)) : 0;

    return (
        <>
            <style>{`
        body { padding-bottom: 72px; }
        .player-bar-progress:hover { height: 6px !important; }
        .player-bar-progress:hover .progress-thumb { opacity: 1 !important; }
        .player-vol-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #fff; cursor: pointer; margin-top: -4px;
        }
        .player-vol-slider::-webkit-slider-runnable-track {
          height: 4px; border-radius: 2px;
          background: linear-gradient(to right, rgba(0,212,255,0.8) 0%, rgba(0,212,255,0.8) var(--vol-pct), rgba(255,255,255,0.2) var(--vol-pct), rgba(255,255,255,0.2) 100%);
        }
      `}</style>
            <div style={styles.bar}>
                <div
                    ref={progressRef}
                    className="player-bar-progress"
                    onClick={handleProgressClick}
                    style={styles.progressTrack}
                >
                    <div style={styles.progressTrackRail} aria-hidden />
                    <div
                        style={{
                            ...styles.progressClip,
                            width: `${progress}%`,
                            transition: 'width 0.08s linear',
                        }}
                    >
                        <div
                            style={{
                                ...styles.progressGradient,
                                width: gradientInnerPct > 0 ? `${gradientInnerPct}%` : '0%',
                            }}
                        />
                    </div>
                    <div
                        className="progress-thumb"
                        style={{
                            ...styles.progressThumb,
                            left: `${progress}%`,
                            opacity: progress > 0 ? 1 : 0,
                        }}
                        aria-hidden
                    />
                </div>

                <div style={styles.left}>
                    <div
                        style={{ ...styles.leftInner, cursor: 'pointer' }}
                        onClick={() => navigate(`/${currentTrack.type}/${currentTrack.id}`)}
                    >
                        {currentTrack.coverImage ? (
                            <img src={currentTrack.coverImage} alt="" style={styles.cover} />
                        ) : (
                            <div style={styles.coverPlaceholder}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                        )}
                        <div style={styles.trackInfo}>
                            <span style={styles.trackTitle}>{currentTrack.title}</span>
                            <span
                                style={styles.trackArtist}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/@${currentTrack.artistHandle}`);
                                }}
                            >
                                {currentTrack.artist}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={styles.center}>
                    <button type="button" onClick={togglePlayPause} style={styles.playPauseBtn}>
                        {isPlaying ? (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="none">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                        ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="none">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        )}
                    </button>
                    <span style={styles.time}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>

                <div style={styles.right}>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                    >
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                        {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                    </svg>
                    <input
                        type="range"
                        className="player-vol-slider"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        style={{ ...styles.volSlider, '--vol-pct': `${volume * 100}%` } as React.CSSProperties}
                    />
                    <button type="button" onClick={stop} style={styles.closeBtn} title="Close player">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
};

const styles: Record<string, React.CSSProperties> = {
    bar: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '72px',
        background: 'rgba(10, 10, 26, 0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(100, 150, 200, 0.15)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 9999,
        fontFamily: "'Poppins', sans-serif",
        gap: '16px',
    },
    progressTrack: {
        position: 'absolute',
        top: '-2px',
        left: 0,
        right: 0,
        height: '4px',
        cursor: 'pointer',
        transition: 'height 0.15s',
    },
    progressTrackRail: {
        position: 'absolute',
        inset: 0,
        borderRadius: 2,
        background: 'linear-gradient(90deg, rgba(0,212,255,0.08) 0%, rgba(99,102,241,0.08) 50%, rgba(236,72,153,0.08) 100%)',
        pointerEvents: 'none',
    },
    progressClip: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'hidden',
        borderRadius: '0 2px 2px 0',
        pointerEvents: 'none',
    },
    progressGradient: {
        height: '100%',
        background: 'linear-gradient(90deg, #00d4ff 0%, #22d3ee 18%, #6366f1 42%, #a78bfa 68%, #ec4899 100%)',
        boxShadow: '0 0 12px rgba(0, 212, 255, 0.25)',
    },
    progressThumb: {
        position: 'absolute',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #5ee7ff, #c084fc)',
        pointerEvents: 'none',
        transition: 'opacity 0.15s, left 0.08s linear',
        boxShadow: '0 0 8px rgba(167, 139, 250, 0.55)',
        zIndex: 2,
    },
    left: {
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 30%',
        overflow: 'hidden',
        minWidth: 0,
    },
    leftInner: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: 0,
    },
    cover: {
        width: '48px',
        height: '48px',
        borderRadius: '6px',
        objectFit: 'cover' as const,
        flexShrink: 0,
    },
    coverPlaceholder: {
        width: '48px',
        height: '48px',
        borderRadius: '6px',
        flexShrink: 0,
        background: 'rgba(30,45,80,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        gap: '2px',
    },
    trackTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#fff',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    trackArtist: {
        fontSize: '12px',
        color: 'rgba(0,212,255,0.7)',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    center: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        flex: '0 0 auto',
    },
    playPauseBtn: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #00d4ff, #0096c7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,212,255,0.3)',
        transition: 'transform 0.1s',
    },
    time: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.45)',
        whiteSpace: 'nowrap' as const,
        minWidth: '80px',
        fontVariantNumeric: 'tabular-nums',
    },
    right: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '8px',
        flex: '1 1 30%',
    },
    volSlider: {
        WebkitAppearance: 'none' as unknown as React.CSSProperties,
        appearance: 'none' as unknown as React.CSSProperties,
        width: '80px',
        height: '4px',
        background: 'transparent',
        cursor: 'pointer',
        outline: 'none',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        marginLeft: '4px',
    },
};

export default PlayerBar;
export type { PlayerTrack };
