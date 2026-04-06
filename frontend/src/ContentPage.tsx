import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePlayerStore } from './stores/playerStore';
import { useNotificationStore } from './stores/notificationStore';
import { apiFetch } from './utils/api';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import TrackPageWaveform from './components/TrackPageWaveform';
import RepostIcon from './components/RepostIcon';

const COMMENT_MAX = 500;

interface TrackComment {
    id: number;
    body: string;
    created_at: string;
    parent_id: number | null;
    username: string;
    display_name: string;
    profile_picture: string | null;
    like_count: number;
    is_liked: boolean;
}

function formatCommentApiError(err: Record<string, unknown>): string {
    const detail = err.detail;
    if (typeof detail === 'string' && detail) return detail;
    for (const key of ['body', 'parent_id'] as const) {
        const v = err[key];
        if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
        if (typeof v === 'string') return v;
    }
    const bodyErr = err.body;
    if (Array.isArray(bodyErr) && typeof bodyErr[0] === 'string') return bodyErr[0];
    if (typeof bodyErr === 'object' && bodyErr !== null && 'non_field_errors' in bodyErr) {
        const nfe = (bodyErr as { non_field_errors?: string[] }).non_field_errors;
        if (Array.isArray(nfe) && typeof nfe[0] === 'string') return nfe[0];
    }
    return 'Could not post comment.';
}

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
    repost_count?: number;
    is_reposted?: boolean;
    uploaded_at?: string;
    published_at?: string;
}

const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const mediaUrl = (base: string, path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base.replace(/\/$/, '')}${p}`;
};

const commentTimeAgo = (dateStr: string) => {
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

const ContentPage = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<ContentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [username, setUsername] = useState('');
    const { currentTrack, isPlaying, play, togglePlayPause } = usePlayerStore();
    const { unreadCount, startPolling, fetchUnreadCount } = useNotificationStore();

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    const [comments, setComments] = useState<TrackComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [commentBody, setCommentBody] = useState('');
    const [commentPosting, setCommentPosting] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [replyingToId, setReplyingToId] = useState<number | null>(null);
    const [replyBody, setReplyBody] = useState('');
    const [replyPosting, setReplyPosting] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [commentDeletingId, setCommentDeletingId] = useState<number | null>(null);
    const [commentLikingId, setCommentLikingId] = useState<number | null>(null);

    const commentsByParent = useMemo(() => {
        const map = new Map<number | null, TrackComment[]>();
        for (const c of comments) {
            const k = c.parent_id;
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(c);
        }
        for (const arr of map.values()) {
            arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        return map;
    }, [comments]);

    const rootComments = commentsByParent.get(null) ?? [];

    const loadComments = useCallback(async () => {
        if (!type || !id || (type !== 'track' && type !== 'publication')) return;
        setCommentsLoading(true);
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const token = localStorage.getItem('accessToken');
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`${API_BASE_URL}/api/auth/${endpoint}/${id}/comments/`, { headers });
            if (res.ok) {
                const rows: TrackComment[] = await res.json();
                setComments(
                    rows.map((r) => ({
                        ...r,
                        like_count: r.like_count ?? 0,
                        is_liked: r.is_liked ?? false,
                    })),
                );
            } else {
                setComments([]);
            }
        } catch {
            setComments([]);
        } finally {
            setCommentsLoading(false);
        }
    }, [type, id, API_BASE_URL]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

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
                        const profileRes = await apiFetch('/api/auth/profile/');
                        if (profileRes.ok) {
                            const profileData = await profileRes.json();
                            setUsername(profileData.username);
                        }
                        startPolling();
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
                    <span style={styles.sidebarIcon}><HomeIcon /></span> Home
                </Link>
                <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
                    <span style={styles.sidebarIcon}><TrendingIcon /></span> Trending
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

    const handleRepostToggle = async () => {
        if (type !== 'track' || !id) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const res = await apiFetch(`/api/auth/tracks/${id}/repost/`, { method: 'POST', body: '{}' });
            if (res.ok) {
                const json = (await res.json()) as { reposted: boolean; repost_count: number };
                setData({
                    ...data,
                    is_reposted: json.reposted,
                    repost_count: json.repost_count,
                });
                fetchUnreadCount();
            }
        } catch { /* silently fail */ }
    };

    const coverUrl = data.cover_image || null;
    const dateStr = data.published_at || data.uploaded_at;
    const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString() : '';

    const handlePostComment = async () => {
        const text = commentBody.trim();
        if (!text || !type || !id) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login');
            return;
        }
        setCommentPosting(true);
        setCommentError(null);
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const res = await apiFetch(`/api/auth/${endpoint}/${id}/comments/`, {
                method: 'POST',
                body: JSON.stringify({ body: text }),
            });
            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                setCommentError(formatCommentApiError(err));
                return;
            }
            const created: TrackComment = await res.json();
            setComments((prev) => [
                ...prev,
                {
                    ...created,
                    like_count: created.like_count ?? 0,
                    is_liked: created.is_liked ?? false,
                },
            ]);
            setCommentBody('');
            fetchUnreadCount();
        } catch {
            setCommentError('Could not post comment.');
        } finally {
            setCommentPosting(false);
        }
    };

    const handlePostReply = async (parentId: number) => {
        const text = replyBody.trim();
        if (!text || !type || !id) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login');
            return;
        }
        setReplyPosting(true);
        setReplyError(null);
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const res = await apiFetch(`/api/auth/${endpoint}/${id}/comments/`, {
                method: 'POST',
                body: JSON.stringify({ body: text, parent_id: parentId }),
            });
            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                setReplyError(formatCommentApiError(err));
                return;
            }
            const created: TrackComment = await res.json();
            setComments((prev) => [
                ...prev,
                {
                    ...created,
                    like_count: created.like_count ?? 0,
                    is_liked: created.is_liked ?? false,
                },
            ]);
            setReplyBody('');
            setReplyingToId(null);
            fetchUnreadCount();
        } catch {
            setReplyError('Could not post reply.');
        } finally {
            setReplyPosting(false);
        }
    };

    const openReply = (commentId: number, parentHandle: string) => {
        setReplyingToId(commentId);
        const mention = parentHandle.startsWith('@') ? parentHandle.slice(1) : parentHandle;
        setReplyBody(`@${mention} `);
        setReplyError(null);
    };

    const cancelReply = () => {
        setReplyingToId(null);
        setReplyBody('');
        setReplyError(null);
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!type || !id) return;
        const token = localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login');
            return;
        }
        setCommentDeletingId(commentId);
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const res = await apiFetch(`/api/auth/${endpoint}/${id}/comments/${commentId}/`, {
                method: 'DELETE',
            });
            if (res.ok) {
                if (replyingToId === commentId) cancelReply();
                await loadComments();
                fetchUnreadCount();
            }
        } catch {
            /* ignore */
        } finally {
            setCommentDeletingId(null);
        }
    };

    const handleToggleCommentLike = async (commentId: number) => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login');
            return;
        }
        if (!type || !id) return;
        setCommentLikingId(commentId);
        try {
            const endpoint = type === 'track' ? 'tracks' : 'publications';
            const res = await apiFetch(`/api/auth/${endpoint}/${id}/comments/${commentId}/like/`, {
                method: 'POST',
                body: '{}',
            });
            if (!res.ok) return;
            const json = (await res.json()) as { liked: boolean; like_count: number };
            setComments((prev) =>
                prev.map((row) =>
                    row.id === commentId
                        ? { ...row, is_liked: json.liked, like_count: json.like_count }
                        : row,
                ),
            );
        } catch {
            /* ignore */
        } finally {
            setCommentLikingId(null);
        }
    };

    const renderCommentBlock = (c: TrackComment, opts: { isReply: boolean; threadParent?: TrackComment }) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        const replies = commentsByParent.get(c.id) ?? [];
        const threadParent = opts.threadParent;
        return (
            <div style={opts.isReply ? styles.commentReplyBlock : undefined}>
                <div style={{ ...styles.commentItem, ...(opts.isReply ? styles.commentItemReply : {}) }}>
                    <div
                        style={styles.commentAvatar}
                        onClick={() => navigate(`/@${c.username}`)}
                        role="presentation"
                    >
                        {c.profile_picture ? (
                            <img
                                src={mediaUrl(API_BASE_URL, c.profile_picture) || ''}
                                alt=""
                                style={opts.isReply ? styles.commentAvatarImgSmall : styles.commentAvatarImg}
                            />
                        ) : (
                            <div style={opts.isReply ? styles.commentAvatarPhSmall : styles.commentAvatarPh}>
                                <ProfileIcon color="#a78bfa" />
                            </div>
                        )}
                    </div>
                    <div style={styles.commentBody}>
                        {opts.isReply && threadParent && (
                            <div style={styles.replyToBadge}>
                                <span style={styles.replyToArrow} aria-hidden>
                                    ↪
                                </span>
                                <span style={styles.replyToLabel}>Reply to</span>
                                <button
                                    type="button"
                                    style={styles.replyToAuthor}
                                    onClick={() => navigate(`/@${threadParent.username}`)}
                                >
                                    @{threadParent.username}
                                </button>
                            </div>
                        )}
                        <div style={styles.commentTopRow}>
                            <div style={styles.commentMeta}>
                                <button
                                    type="button"
                                    style={styles.commentAuthor}
                                    onClick={() => navigate(`/@${c.username}`)}
                                >
                                    {c.display_name || c.username}
                                </button>
                                <span style={styles.commentTime}>{commentTimeAgo(c.created_at)}</span>
                            </div>
                            <button
                                type="button"
                                style={{
                                    ...styles.commentLikeBtn,
                                    opacity: commentLikingId === c.id ? 0.55 : 1,
                                }}
                                disabled={!!token && commentLikingId === c.id}
                                onClick={() => handleToggleCommentLike(c.id)}
                                title={token ? (c.is_liked ? 'Unlike' : 'Like') : 'Log in to like'}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill={c.is_liked ? '#ff4d6d' : 'none'}
                                    stroke={c.is_liked ? '#ff4d6d' : 'rgba(255,255,255,0.45)'}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                <span style={styles.commentLikeCount}>{c.like_count}</span>
                            </button>
                        </div>
                        <p style={styles.commentText}>{c.body}</p>
                        <div style={styles.commentActions}>
                            {!opts.isReply && token && (
                                <button
                                    type="button"
                                    style={styles.commentReplyBtn}
                                    onClick={() =>
                                        replyingToId === c.id ? cancelReply() : openReply(c.id, c.username)
                                    }
                                >
                                    {replyingToId === c.id ? 'Cancel' : 'Reply'}
                                </button>
                            )}
                            {token && username && c.username === username && (
                                <button
                                    type="button"
                                    style={styles.commentDeleteBtn}
                                    disabled={commentDeletingId === c.id}
                                    onClick={() => handleDeleteComment(c.id)}
                                >
                                    {commentDeletingId === c.id ? '…' : 'Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                {!opts.isReply && replyingToId === c.id && token && (
                    <div style={styles.replyInlineBox}>
                        {replyError && <span style={styles.replyInlineError}>{replyError}</span>}
                        <textarea
                            style={styles.replyTextarea}
                            placeholder={`Reply to ${c.display_name || c.username}…`}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value.slice(0, COMMENT_MAX))}
                            maxLength={COMMENT_MAX}
                            rows={2}
                            disabled={replyPosting}
                        />
                        <div style={styles.replyInlineFooter}>
                            <span style={styles.replyCharCount}>
                                {replyBody.length}/{COMMENT_MAX}
                            </span>
                            <div style={styles.replyInlineActions}>
                                <button type="button" style={styles.replyCancelBtn} onClick={cancelReply} disabled={replyPosting}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        ...styles.replySubmitBtn,
                                        opacity: replyPosting || !replyBody.trim() ? 0.5 : 1,
                                    }}
                                    disabled={replyPosting || !replyBody.trim()}
                                    onClick={() => handlePostReply(c.id)}
                                >
                                    {replyPosting ? '…' : 'Reply'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {replies.length > 0 && (
                    <div style={styles.commentReplies} role="list">
                        <div style={styles.threadSpine} aria-hidden />
                        {replies.map((r, idx) => {
                            const isLast = idx === replies.length - 1;
                            return (
                                <div
                                    key={r.id}
                                    role="listitem"
                                    style={{
                                        ...styles.threadListItem,
                                        marginBottom: isLast ? 0 : 10,
                                    }}
                                >
                                    <div style={styles.threadArmCell} aria-hidden>
                                        <div style={styles.threadHorizontalSegment} />
                                    </div>
                                    <div style={styles.threadRowMain}>
                                        {renderCommentBlock(r, { isReply: true, threadParent: c })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={styles.pageWrapper}>
            {sidebar}
            <div style={styles.mainArea}>
                {/* Hero Banner Area */}
                <div style={styles.heroBox}>
                    {coverUrl && (
                        <div style={{ ...styles.heroBgBlur, backgroundImage: `url(${coverUrl})` }} />
                    )}

                    <div style={styles.heroOuter}>
                        <div style={styles.heroCard}>
                            <div style={styles.heroTopRow}>
                                <div style={styles.coverWrapper}>
                                    {coverUrl ? (
                                        <img src={coverUrl} alt="Cover" style={styles.coverImg} />
                                    ) : (
                                        <div style={styles.coverPlaceholder}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                        </div>
                                    )}
                                </div>

                                <div style={styles.infoWrapper}>
                                    <span style={styles.typeBadge}>{type === 'track' ? 'Track' : 'Publication'}</span>
                                    <div style={styles.titleRow}>
                                        <button type="button" onClick={handlePlayToggle} style={styles.bigPlayBtn}>
                                            {isThisItemPlaying && isPlaying ? (
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                            ) : (
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="none" style={{ marginLeft: '4px' }}><polygon points="5,3 19,12 5,21" /></svg>
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
                                            type="button"
                                            onClick={handleLikeToggle}
                                            style={{ ...styles.actionBtn, ...(data.is_liked ? { color: '#ff4d6d', borderColor: 'rgba(255,77,109,0.5)' } : {}) }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill={data.is_liked ? '#ff4d6d' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                            {formatNumber(data.like_count)}
                                        </button>
                                        {type === 'track' && (
                                            <button
                                                type="button"
                                                onClick={handleRepostToggle}
                                                title={
                                                    data.is_reposted
                                                        ? 'Remove from your profile'
                                                        : 'Add to your profile reposts'
                                                }
                                                style={{
                                                    ...styles.actionBtn,
                                                    ...(data.is_reposted
                                                        ? { color: '#5eead4', borderColor: 'rgba(94, 234, 212, 0.45)' }
                                                        : { color: 'rgba(196, 181, 253, 0.95)' }),
                                                }}
                                            >
                                                <span style={{ marginRight: 6, display: 'flex', alignItems: 'center' }}>
                                                    <RepostIcon size={17} active={!!data.is_reposted} />
                                                </span>
                                                {formatNumber(data.repost_count ?? 0)}
                                            </button>
                                        )}
                                        <div style={styles.statPill} title="Plays">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><polygon points="5 3 19 12 5 21"></polygon></svg>
                                            {formatNumber(data.play_count)}
                                        </div>
                                        <div style={styles.statPill}>{dateFormatted}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.heroWaveBand}>
                                <TrackPageWaveform
                                    audioUrl={data.audio_file}
                                    isActive={isThisItemPlaying}
                                    waveHeight={118}
                                    variant="hero"
                                />
                            </div>

                            <div style={styles.heroDescription}>
                                {data.description || 'No description provided.'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.commentsOuter}>
                    <div style={styles.commentsInner}>
                        <h2 style={styles.commentsHeading}>
                            Comments <span style={styles.commentsCount}>{comments.length}</span>
                        </h2>

                        <div style={styles.commentComposer}>
                            <textarea
                                style={styles.commentTextarea}
                                placeholder={localStorage.getItem('accessToken') ? 'Write a comment…' : 'Log in to comment'}
                                value={commentBody}
                                onChange={(e) => setCommentBody(e.target.value.slice(0, COMMENT_MAX))}
                                maxLength={COMMENT_MAX}
                                rows={3}
                                disabled={!localStorage.getItem('accessToken')}
                            />
                            <div style={styles.commentComposerMeta}>
                                <span style={styles.commentCharCount}>
                                    {commentBody.length}/{COMMENT_MAX}
                                </span>
                            </div>
                            <div style={styles.commentComposerRow}>
                                {commentError && <span style={styles.commentError}>{commentError}</span>}
                                <button
                                    type="button"
                                    style={{
                                        ...styles.commentSubmit,
                                        opacity: commentPosting || !commentBody.trim() ? 0.5 : 1,
                                    }}
                                    disabled={commentPosting || !commentBody.trim()}
                                    onClick={() => {
                                        if (!localStorage.getItem('accessToken')) {
                                            navigate('/login');
                                            return;
                                        }
                                        handlePostComment();
                                    }}
                                >
                                    {commentPosting ? 'Posting…' : 'Post comment'}
                                </button>
                            </div>
                        </div>

                        {commentsLoading ? (
                            <p style={styles.commentsLoading}>Loading comments…</p>
                        ) : rootComments.length === 0 ? (
                            <p style={styles.commentsEmpty}>No comments yet. Be the first to say something.</p>
                        ) : (
                            <ul style={styles.commentList}>
                                {rootComments.map((c) => (
                                    <li key={c.id} style={styles.commentRootLi}>
                                        {renderCommentBlock(c, { isReply: false })}
                                    </li>
                                ))}
                            </ul>
                        )}
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
        minHeight: 'auto',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(167,139,250,0.12)',
        padding: '32px 24px 40px',
    },
    heroBgBlur: {
        position: 'absolute',
        top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(60px) brightness(0.4)',
        zIndex: 0,
    },
    heroOuter: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 1080,
        margin: '0 auto',
    },
    heroCard: {
        width: '100%',
        borderRadius: 20,
        padding: '28px 32px 32px',
        background: 'linear-gradient(145deg, rgba(22,22,38,0.92) 0%, rgba(15,15,26,0.88) 100%)',
        border: '1px solid rgba(167, 139, 250, 0.18)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
    },
    heroTopRow: {
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'flex-start',
        gap: 36,
        width: '100%',
    },
    coverWrapper: {
        width: 260,
        height: 260,
        borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.12)',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'linear-gradient(135deg, #2a2142 0%, #1a1a2e 50%, #16213e 100%)',
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
        gap: 16,
        minWidth: 0,
        paddingTop: 4,
    },
    typeBadge: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase' as const,
        color: 'rgba(167, 139, 250, 0.85)',
        marginBottom: 4,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 20,
    },
    bigPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 45%, #ec4899 100%)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 28px rgba(139, 92, 246, 0.35)',
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
        fontSize: 18,
        fontWeight: 500,
        color: 'rgba(236, 72, 153, 0.92)',
        margin: 0,
        cursor: 'pointer',
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
    },
    statsRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap' as const,
        paddingTop: 4,
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
    heroWaveBand: {
        width: '100%',
        marginTop: 28,
        paddingTop: 24,
        borderTop: '1px solid rgba(167, 139, 250, 0.12)',
    },
    heroDescription: {
        marginTop: 22,
        color: 'rgba(255,255,255,0.48)',
        fontSize: 13,
        lineHeight: 1.6,
    },
    commentsOuter: {
        width: '100%',
        padding: '32px 24px 48px',
        display: 'flex',
        justifyContent: 'center',
    },
    commentsInner: {
        width: '100%',
        maxWidth: 1080,
    },
    commentsHeading: {
        fontSize: 20,
        fontWeight: 700,
        margin: '0 0 20px',
        color: '#fff',
    },
    commentsCount: {
        color: 'rgba(167, 139, 250, 0.85)',
        fontWeight: 600,
    },
    commentComposer: {
        marginBottom: 28,
        padding: 16,
        borderRadius: 14,
        background: 'rgba(19, 19, 31, 0.85)',
        border: '1px solid rgba(167, 139, 250, 0.15)',
    },
    commentTextarea: {
        width: '100%',
        resize: 'vertical' as const,
        minHeight: 72,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(167, 139, 250, 0.2)',
        background: 'rgba(10, 10, 20, 0.6)',
        color: '#fff',
        fontSize: 14,
        fontFamily: "'Poppins', sans-serif",
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    commentComposerMeta: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 6,
    },
    commentCharCount: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
    },
    commentComposerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 12,
        flexWrap: 'wrap' as const,
    },
    commentSubmit: {
        padding: '10px 22px',
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 13,
        fontFamily: "'Poppins', sans-serif",
        background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #ec4899 100%)',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(139, 92, 246, 0.25)',
    },
    commentError: {
        fontSize: 13,
        color: '#f87171',
        marginRight: 'auto',
    },
    commentsLoading: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
    },
    commentsEmpty: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        lineHeight: 1.5,
    },
    commentList: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 16,
    },
    commentRootLi: {
        listStyle: 'none',
    },
    commentReplyBlock: {
        width: '100%',
    },
    commentItem: {
        display: 'flex',
        gap: 14,
        padding: 16,
        borderRadius: 14,
        background: 'rgba(19, 19, 31, 0.55)',
        border: '1px solid rgba(167, 139, 250, 0.1)',
    },
    commentItemReply: {
        padding: '12px 12px',
        gap: 10,
        background: 'rgba(14, 14, 26, 0.45)',
    },
    commentReplies: {
        position: 'relative' as const,
        margin: '14px 0 0 0',
        padding: '0 0 0 26px',
    },
    threadSpine: {
        position: 'absolute',
        left: 10,
        top: -14,
        bottom: 0,
        width: 2,
        borderRadius: 1,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(167,139,250,0.55) 0%, rgba(99,102,241,0.28) 100%)',
    },
    threadListItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        position: 'relative' as const,
    },
    threadArmCell: {
        width: 16,
        flexShrink: 0,
        paddingTop: 17,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
    },
    threadHorizontalSegment: {
        width: 14,
        height: 2,
        borderRadius: 1,
        background: 'rgba(167, 139, 250, 0.48)',
    },
    threadRowMain: {
        flex: 1,
        minWidth: 0,
    },
    replyToBadge: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: 6,
        marginBottom: 8,
    },
    replyToArrow: {
        fontSize: 13,
        color: 'rgba(167, 139, 250, 0.75)',
        lineHeight: 1,
    },
    replyToLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.42)',
    },
    replyToAuthor: {
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(196, 181, 253, 0.95)',
        fontFamily: "'Poppins', sans-serif",
    },
    commentActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 8,
        flexWrap: 'wrap' as const,
    },
    commentReplyBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(167, 139, 250, 0.9)',
        fontFamily: "'Poppins', sans-serif",
    },
    commentDeleteBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(248, 113, 113, 0.88)',
        fontFamily: "'Poppins', sans-serif",
    },
    replyInlineBox: {
        marginTop: 6,
        marginLeft: 58,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(10, 10, 22, 0.95)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        maxWidth: 400,
    },
    replyTextarea: {
        width: '100%',
        boxSizing: 'border-box' as const,
        minHeight: 44,
        maxHeight: 68,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid rgba(167, 139, 250, 0.18)',
        background: 'rgba(8, 8, 18, 0.85)',
        color: '#fff',
        fontSize: 13,
        fontFamily: "'Poppins', sans-serif",
        outline: 'none',
        resize: 'none' as const,
        lineHeight: 1.4,
        display: 'block',
    },
    replyInlineFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        gap: 10,
        flexWrap: 'wrap' as const,
    },
    replyCharCount: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.38)',
    },
    replyInlineActions: {
        display: 'flex',
        gap: 8,
    },
    replyCancelBtn: {
        padding: '5px 12px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'transparent',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
    },
    replySubmitBtn: {
        padding: '5px 14px',
        borderRadius: 8,
        border: 'none',
        background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
    },
    replyInlineError: {
        display: 'block',
        fontSize: 12,
        color: '#f87171',
        marginBottom: 6,
    },
    commentAvatarImgSmall: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        objectFit: 'cover' as const,
        border: '2px solid rgba(167, 139, 250, 0.2)',
    },
    commentAvatarPhSmall: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(167, 139, 250, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentAvatar: {
        flexShrink: 0,
        cursor: 'pointer',
    },
    commentAvatarImg: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        objectFit: 'cover' as const,
        border: '2px solid rgba(167, 139, 250, 0.25)',
    },
    commentAvatarPh: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'rgba(167, 139, 250, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentBody: { flex: 1, minWidth: 0 },
    commentTopRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        marginBottom: 6,
    },
    commentMeta: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap' as const,
        minWidth: 0,
    },
    commentLikeBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        background: 'none',
        border: 'none',
        padding: '2px 4px',
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
    },
    commentLikeCount: {
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        fontVariantNumeric: 'tabular-nums',
    },
    commentAuthor: {
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: '#e9d5ff',
        fontWeight: 600,
        fontSize: 14,
        fontFamily: "'Poppins', sans-serif",
    },
    commentTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
    },
    commentText: {
        margin: 0,
        fontSize: 14,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.88)',
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-word' as const,
    },
};

export default ContentPage;
