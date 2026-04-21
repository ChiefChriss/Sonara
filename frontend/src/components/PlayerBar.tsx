import { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayerStore, PlayerTrack } from '../stores/playerStore';
import { getTrackGradient } from '../utils/trackGradient';
import { useIsMobile } from '../hooks/useIsMobile';
import { apiFetch } from '../utils/api';

const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

const MOBILE_NAV_HEIGHT = 64;

const PlayerBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const timeBarRef = useRef<HTMLDivElement>(null);
    const mobileTimeBarRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const currentTrack = usePlayerStore((state) => state.currentTrack);
    const isPlaying = usePlayerStore((state) => state.isPlaying);
    const currentTime = usePlayerStore((state) => state.currentTime);
    const duration = usePlayerStore((state) => state.duration);
    const volume = usePlayerStore((state) => state.volume);
    const currentIndex = usePlayerStore((state) => state.currentIndex);
    const queue = usePlayerStore((state) => state.queue);
    const isShuffleEnabled = usePlayerStore((state) => state.isShuffleEnabled);
    const isLooping = usePlayerStore((state) => state.isLooping);
    const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
    const seek = usePlayerStore((state) => state.seek);
    const setVolume = usePlayerStore((state) => state.setVolume);
    const stop = usePlayerStore((state) => state.stop);
    const playNext = usePlayerStore((state) => state.playNext);
    const playPrevious = usePlayerStore((state) => state.playPrevious);
    const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
    const toggleLoop = usePlayerStore((state) => state.toggleLoop);

    // ── Like state ───────────────────────────────────────────────────────────
    const [isLiked, setIsLiked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);

    // Reset like state when the track changes & check if already liked
    useEffect(() => {
        if (!currentTrack) { setIsLiked(false); return; }
        setIsLiked(false);
        const checkLiked = async () => {
            try {
                const endpoint = currentTrack.type === 'track'
                    ? `/api/auth/tracks/${currentTrack.id}/detail/`
                    : `/api/auth/publications/${currentTrack.id}/detail/`;
                const res = await apiFetch(endpoint);
                if (res.ok) {
                    const data = await res.json();
                    setIsLiked(!!data.is_liked);
                }
            } catch { /* silent */ }
        };
        checkLiked();
    }, [currentTrack?.id, currentTrack?.type]);

    const handleToggleLike = async () => {
        if (!currentTrack || likeLoading) return;
        setLikeLoading(true);
        try {
            const endpoint = currentTrack.type === 'track'
                ? `/api/auth/tracks/${currentTrack.id}/like/`
                : `/api/auth/publications/${currentTrack.id}/like/`;
            const res = await apiFetch(endpoint, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setIsLiked(data.liked);
            }
        } catch { /* silent */ }
        setLikeLoading(false);
    };

    // ── Seek helpers (click + drag, works for both desktop and mobile) ───────
    const seekFromRef = useCallback(
        (clientX: number, ref: React.RefObject<HTMLDivElement | null>) => {
            if (!ref.current || !duration) return;
            const rect = ref.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            seek(pct * duration);
        },
        [duration, seek],
    );

    const handleTimeBarMouseDown = useCallback(
        (e: React.MouseEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
            e.preventDefault();
            isDraggingRef.current = true;
            seekFromRef(e.clientX, ref);

            const onMouseMove = (ev: MouseEvent) => {
                if (isDraggingRef.current) seekFromRef(ev.clientX, ref);
            };
            const onMouseUp = () => {
                isDraggingRef.current = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        },
        [seekFromRef],
    );

    // Touch-based seeking for mobile
    const handleTimeBarTouchStart = useCallback(
        (e: React.TouchEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
            isDraggingRef.current = true;
            const touch = e.touches[0];
            seekFromRef(touch.clientX, ref);

            const onTouchMove = (ev: TouchEvent) => {
                if (isDraggingRef.current && ev.touches[0]) {
                    ev.preventDefault();
                    seekFromRef(ev.touches[0].clientX, ref);
                }
            };
            const onTouchEnd = () => {
                isDraggingRef.current = false;
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
            };
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
        },
        [seekFromRef],
    );

    const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/'];
    if (authRoutes.includes(location.pathname) || location.pathname.startsWith('/workstation') || !currentTrack) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const safeQueue = Array.isArray(queue) ? queue : [];
    const hasPrevious = currentIndex > 0 || currentTime > 3;
    const hasNext = safeQueue.length > 1 && (isShuffleEnabled || currentIndex < safeQueue.length - 1);

    /* ── Mobile layout ─────────────────────────────────────────────────────── */
    if (isMobile) {
        return (
            <>
                <style>{`
          @keyframes heart-pop {
            0% { transform: scale(1); }
            30% { transform: scale(1.3); }
            60% { transform: scale(0.95); }
            100% { transform: scale(1); }
          }
          .heart-pop { animation: heart-pop 0.35s ease-out; }
          .mobile-bar-area { -webkit-tap-highlight-color: transparent; }
        `}</style>
                <div className="mobile-bar-area" style={mobileStyles.wrapper}>
                    {/* ── Mini progress strip at top of bar ──────────────────────── */}
                    <div
                        ref={mobileTimeBarRef}
                        onMouseDown={(e) => handleTimeBarMouseDown(e, mobileTimeBarRef)}
                        onTouchStart={(e) => handleTimeBarTouchStart(e, mobileTimeBarRef)}
                        style={mobileStyles.progressStrip}
                    >
                        <div style={mobileStyles.progressRail} />
                        <div
                            style={{
                                ...mobileStyles.progressFill,
                                width: `${progress}%`,
                            }}
                        />
                    </div>

                    {/* ── Top row: cover, info, heart, play/pause, close ─────────── */}
                    <div style={mobileStyles.topRow}>
                        <div
                            style={mobileStyles.trackSection}
                            onClick={() => navigate(`/${currentTrack.type}/${currentTrack.id}`)}
                        >
                            {currentTrack.coverImage ? (
                                <img src={currentTrack.coverImage} alt="" style={mobileStyles.cover} />
                            ) : (
                                <div style={{ ...mobileStyles.coverPh, background: getTrackGradient(currentTrack.id) }} />
                            )}
                            <div style={mobileStyles.trackInfo}>
                                <span style={mobileStyles.trackTitle}>{currentTrack.title}</span>
                                <span
                                    style={mobileStyles.trackArtist}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/@${currentTrack.artistHandle}`);
                                    }}
                                >
                                    {currentTrack.artist}
                                </span>
                            </div>
                        </div>

                        <div style={mobileStyles.actions}>
                            <button
                                type="button"
                                onClick={handleToggleLike}
                                style={{
                                    ...mobileStyles.iconBtn,
                                    color: isLiked ? '#ff4d6d' : 'rgba(255,255,255,0.6)',
                                }}
                            >
                                <HeartIcon liked={isLiked} size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={togglePlayPause}
                                style={mobileStyles.playPauseBtn}
                            >
                                {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                            </button>
                            <button type="button" onClick={stop} style={mobileStyles.iconBtn}>
                                <CloseIcon />
                            </button>
                        </div>
                    </div>

                    {/* ── Bottom row: transport controls ──────────────────────────── */}
                    <div style={mobileStyles.transportRow}>
                        <button
                            type="button"
                            onClick={toggleShuffle}
                            style={{
                                ...mobileStyles.transportBtn,
                                ...(isShuffleEnabled ? { color: '#a78bfa' } : {}),
                            }}
                        >
                            <ShuffleIcon active={isShuffleEnabled} size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={playPrevious}
                            disabled={!hasPrevious}
                            style={{
                                ...mobileStyles.transportBtn,
                                ...(!hasPrevious ? { opacity: 0.35 } : {}),
                            }}
                        >
                            <PreviousIcon size={16} />
                        </button>
                        <span style={mobileStyles.timeText}>{formatTime(currentTime)}</span>
                        <span style={mobileStyles.timeSep}>/</span>
                        <span style={mobileStyles.timeText}>{formatTime(duration)}</span>
                        <button
                            type="button"
                            onClick={playNext}
                            disabled={!hasNext}
                            style={{
                                ...mobileStyles.transportBtn,
                                ...(!hasNext ? { opacity: 0.35 } : {}),
                            }}
                        >
                            <NextIcon size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={toggleLoop}
                            style={{
                                ...mobileStyles.transportBtn,
                                ...(isLooping ? { color: '#a78bfa' } : {}),
                            }}
                        >
                            <LoopIcon active={isLooping} size={14} />
                        </button>
                    </div>
                </div>
            </>
        );
    }

    /* ── Desktop layout ────────────────────────────────────────────────────── */
    return (
        <>
            <style>{`
        .player-transport-btn:hover { color: #fff !important; background: rgba(255,255,255,0.06) !important; }
        .player-vol-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #fff; cursor: pointer; margin-top: -4px;
          box-shadow: 0 0 6px rgba(0,212,255,0.4);
        }
        .player-vol-slider::-webkit-slider-runnable-track {
          height: 4px; border-radius: 2px;
          background: linear-gradient(to right, rgba(0,212,255,0.8) 0%, rgba(0,212,255,0.8) var(--vol-pct), rgba(255,255,255,0.2) var(--vol-pct), rgba(255,255,255,0.2) 100%);
        }
        .player-vol-slider::-moz-range-thumb {
          width: 12px; height: 12px; border: none;
          border-radius: 50%; background: #fff; cursor: pointer;
          box-shadow: 0 0 6px rgba(0,212,255,0.4);
        }
        .player-vol-slider::-moz-range-track {
          height: 4px; border-radius: 2px; border: none;
          background: rgba(255,255,255,0.2);
        }
        .player-vol-slider::-moz-range-progress {
          height: 4px; border-radius: 2px;
          background: rgba(0,212,255,0.8);
        }
        .heart-btn:hover .heart-icon-svg {
          transform: scale(1.2);
        }
        .heart-btn:active .heart-icon-svg {
          transform: scale(0.9);
        }
        @keyframes heart-pop {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          60% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .heart-pop {
          animation: heart-pop 0.35s ease-out;
        }
        .time-bar-area:hover .time-bar-thumb { opacity: 1 !important; }
        .time-bar-area:hover .time-bar-fill-bar { background: linear-gradient(90deg, #00d4ff, #a78bfa, #ec4899) !important; }
      `}</style>
            <div style={styles.bar}>
                {/* ── Left: cover art, track info, heart ─────────────────────── */}
                <div style={styles.left}>
                    <div
                        style={{ ...styles.leftInner, cursor: 'pointer' }}
                        onClick={() => navigate(`/${currentTrack.type}/${currentTrack.id}`)}
                    >
                        {currentTrack.coverImage ? (
                            <img src={currentTrack.coverImage} alt="" style={styles.cover} />
                        ) : (
                            <div style={{ ...styles.coverPlaceholder, background: getTrackGradient(currentTrack.id) }} />
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
                    <button
                        type="button"
                        className="heart-btn"
                        onClick={handleToggleLike}
                        style={{
                            ...styles.heartBtn,
                            color: isLiked ? '#ff4d6d' : 'rgba(255,255,255,0.6)',
                        }}
                        title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                    >
                        <HeartIcon liked={isLiked} />
                    </button>
                </div>

                {/* ── Center: transport controls & interactive time bar ───────── */}
                <div style={styles.center}>
                    <div style={styles.transportRow}>
                        <button
                            type="button"
                            className="player-transport-btn"
                            onClick={toggleShuffle}
                            style={{ ...styles.transportBtn, ...(isShuffleEnabled ? styles.transportBtnActive : {}) }}
                            title="Shuffle"
                        >
                            <ShuffleIcon active={isShuffleEnabled} />
                        </button>
                        <button
                            type="button"
                            className="player-transport-btn"
                            onClick={playPrevious}
                            disabled={!hasPrevious}
                            style={{ ...styles.transportBtn, ...(!hasPrevious ? styles.transportBtnDisabled : {}) }}
                            title="Previous"
                        >
                            <PreviousIcon />
                        </button>
                        <button type="button" onClick={togglePlayPause} style={styles.playPauseBtn}>
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                        <button
                            type="button"
                            className="player-transport-btn"
                            onClick={playNext}
                            disabled={!hasNext}
                            style={{ ...styles.transportBtn, ...(!hasNext ? styles.transportBtnDisabled : {}) }}
                            title="Next"
                        >
                            <NextIcon />
                        </button>
                        <button
                            type="button"
                            className="player-transport-btn"
                            onClick={toggleLoop}
                            style={{ ...styles.transportBtn, ...(isLooping ? styles.transportBtnActive : {}) }}
                            title={isLooping ? 'Disable loop' : 'Enable loop'}
                        >
                            <LoopIcon active={isLooping} />
                        </button>
                    </div>

                    <div style={styles.playbackRow}>
                        <span style={styles.time}>{formatTime(currentTime)}</span>
                        <div
                            ref={timeBarRef}
                            className="time-bar-area"
                            onMouseDown={(e) => handleTimeBarMouseDown(e, timeBarRef)}
                            style={styles.timeBarWrap}
                        >
                            <div style={styles.timeBarRail} />
                            <div
                                className="time-bar-fill-bar"
                                style={{
                                    ...styles.timeBarFill,
                                    width: `${progress}%`,
                                }}
                            />
                            <div
                                className="time-bar-thumb"
                                style={{
                                    ...styles.timeBarThumb,
                                    left: `${progress}%`,
                                }}
                            />
                        </div>
                        <span style={styles.time}>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* ── Right: volume & close ────────────────────────────────────── */}
                <div style={styles.right}>
                    <VolumeIcon volume={volume} />
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
                        <CloseIcon />
                    </button>
                </div>
            </div>
        </>
    );
};

/* ── Icons ─────────────────────────────────────────────────────────────────── */

const PlayIcon = ({ size = 22 }: { size?: number; mobile?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" stroke="none">
        <polygon points="5,3 19,12 5,21" />
    </svg>
);

const PauseIcon = ({ size = 22 }: { size?: number; mobile?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" stroke="none">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
);

const PreviousIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 5h2v14H6zM18.5 6.5 10 12l8.5 5.5z" />
    </svg>
);

const NextIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 5h2v14h-2zM5.5 6.5 14 12l-8.5 5.5z" />
    </svg>
);

const ShuffleIcon = ({ active, size = 16 }: { active?: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5" />
        <path d="M4 20 21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15 21 21" />
        <path d="M4 4 9 9" />
    </svg>
);

const LoopIcon = ({ active, size = 16 }: { active?: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? '#a78bfa' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2l4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="M7 22l-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
);

const HeartIcon = ({ liked, size = 18 }: { liked: boolean; size?: number }) => (
    <svg
        className={`heart-icon-svg${liked ? ' heart-pop' : ''}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={liked ? '#ff4d6d' : 'none'}
        stroke={liked ? '#ff4d6d' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'transform 0.15s, fill 0.15s, stroke 0.15s' }}
    >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const VolumeIcon = ({ volume }: { volume: number }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
        {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
    </svg>
);

/* ── Mobile styles ─────────────────────────────────────────────────────────── */

const mobileStyles: Record<string, React.CSSProperties> = {
    wrapper: {
        position: 'fixed',
        bottom: MOBILE_NAV_HEIGHT,
        left: 0,
        right: 0,
        background: 'rgba(12, 12, 28, 0.97)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(167, 139, 250, 0.12)',
        zIndex: 9999,
        fontFamily: "'Poppins', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 6px 0',
    },
    // ── Progress strip ──────────────────────────────────────────────────
    progressStrip: {
        position: 'relative',
        width: '100%',
        height: '10px',
        cursor: 'pointer',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'flex-start',
    },
    progressRail: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        borderRadius: '0 0 2px 2px',
        background: 'rgba(255,255,255,0.1)',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '3px',
        borderRadius: '0 0 2px 2px',
        background: 'linear-gradient(90deg, #00d4ff, #a78bfa, #ec4899)',
        transition: 'width 0.08s linear',
        pointerEvents: 'none',
    },
    // ── Top row ─────────────────────────────────────────────────────────
    topRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '8px',
    },
    trackSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
    },
    cover: {
        width: 40,
        height: 40,
        borderRadius: 6,
        objectFit: 'cover' as const,
        flexShrink: 0,
    },
    coverPh: {
        width: 40,
        height: 40,
        borderRadius: 6,
        flexShrink: 0,
    },
    trackInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1px',
        overflow: 'hidden',
        minWidth: 0,
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
        fontSize: '11px',
        color: 'rgba(0,212,255,0.7)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
    },
    iconBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        WebkitTapHighlightColor: 'transparent',
        color: 'rgba(255,255,255,0.6)',
    },
    playPauseBtn: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(167,139,250,0.3)',
        WebkitTapHighlightColor: 'transparent',
    },
    // ── Transport row  ──────────────────────────────────────────────────
    transportRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '0 12px',
    },
    transportBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '4px',
        WebkitTapHighlightColor: 'transparent',
    },
    timeText: {
        fontSize: '10px',
        fontVariantNumeric: 'tabular-nums',
        color: 'rgba(255,255,255,0.4)',
    },
    timeSep: {
        fontSize: '10px',
        color: 'rgba(255,255,255,0.2)',
    },
};

/* ── Desktop styles ────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
    bar: {
        position: 'sticky',
        bottom: 0,
        height: '80px',
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
    cover: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
    coverPlaceholder: { width: 48, height: 48, borderRadius: 6, flexShrink: 0 },
    trackInfo: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: '2px',
    },
    trackTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#fff',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    trackArtist: {
        fontSize: '12px',
        color: 'rgba(0,212,255,0.7)',
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    heartBtn: {
        background: 'none',
        border: 'none',
        marginLeft: '14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'color 0.15s',
    },
    center: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        maxWidth: '722px',
        width: '40%',
        flex: '0 0 auto',
    },
    transportRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    transportBtn: {
        width: 30,
        height: 30,
        borderRadius: 9999,
        border: 'none',
        background: 'transparent',
        color: 'rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
    },
    transportBtnActive: {
        color: '#a78bfa',
    },
    transportBtnDisabled: {
        opacity: 0.35,
        cursor: 'not-allowed',
    },
    playPauseBtn: {
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(167,139,250,0.35)',
        transition: 'transform 0.1s',
    },
    playbackRow: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        gap: '8px',
    },
    timeBarWrap: {
        position: 'relative',
        flex: 1,
        height: '14px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
    },
    timeBarRail: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: '4px',
        borderRadius: 2,
        background: 'rgba(255,255,255,0.15)',
    },
    timeBarFill: {
        position: 'absolute',
        left: 0,
        height: '4px',
        borderRadius: 2,
        background: 'rgba(255,255,255,0.55)',
        transition: 'width 0.08s linear',
        pointerEvents: 'none',
    },
    timeBarThumb: {
        position: 'absolute',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #5ee7ff, #c084fc)',
        boxShadow: '0 0 8px rgba(167, 139, 250, 0.55)',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.15s',
        zIndex: 2,
    },
    time: {
        fontSize: '11px',
        color: 'rgba(255,255,255,0.45)',
        whiteSpace: 'nowrap',
        minWidth: '40px',
        textAlign: 'center',
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
