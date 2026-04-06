import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/playerStore';
import { apiFetch } from '../utils/api';
import { getUserGradient } from '../utils/userGradient';
// getTrackGradient available if track cover placeholders are added to search results
// import { getTrackGradient } from '../utils/trackGradient';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface SearchUser {
  id: number;
  username: string;
  profile_picture: string | null;
  role: string;
}

interface SearchResult {
  id: number;
  title: string;
  username: string;
  cover_image?: string | null;
  profile_picture?: string | null;
  audio_file?: string;
  type: 'track' | 'publication';
}

// ── Component ───────────────────────────────────────────────────────────────

const TopBar = () => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  // Profile state
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // ── Fetch profile on mount ────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const init = async () => {
      try {
        const res = await apiFetch('/api/auth/profile/');
        if (!res.ok) return;
        const data = await res.json();
        setUsername(data.username);
        setProfilePicture(data.profile_picture || null);
        setHeaderImage(data.header_image || null);
      } catch { /* silent */ }
    };
    init();
  }, []);

  // ── Close search dropdown on outside click ────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node))
        setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Close profile menu on outside click ───────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node))
        setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search logic ──────────────────────────────────────────────────────────

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

  // ── Play track from search results ────────────────────────────────────────

  const playTrack = (item: SearchResult) => {
    usePlayerStore.getState().play({
      id: item.id,
      title: item.title,
      artist: item.username,
      artistHandle: item.username,
      audioUrl: item.audio_file || '',
      coverImage: item.cover_image || item.profile_picture || null,
      type: item.type,
    });
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    usePlayerStore.getState().stop();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    navigate('/login');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
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

        {/* Search dropdown */}
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
                      : <div style={{...styles.dropAvatarPh, background: getUserGradient(u.username), color: '#fff', fontWeight: 700, fontFamily: "'Poppins', sans-serif", fontSize: 14}}>{u.username ? u.username[0].toUpperCase() : '?'}</div>}
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

      <div ref={profileMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          style={styles.profileAvatarBtn}
        >
          {profilePicture ? (
            <img src={profilePicture} alt="" style={styles.profileAvatarImg} />
          ) : (
            <div style={{...styles.profileAvatarPlaceholder, background: getUserGradient(username)}}>
              {username ? username[0].toUpperCase() : '?'}
            </div>
          )}
        </button>
        {profileMenuOpen && (
          <div style={styles.profileDropdown}>
            {/* Banner */}
            <div style={styles.profileDropdownBanner}>
              {headerImage ? (
                <img src={headerImage} alt="" style={styles.profileDropdownBannerImg} />
              ) : (
                <div style={{...styles.profileDropdownBannerFallback, background: getUserGradient(username)}} />
              )}
            </div>
            {/* Avatar overlapping banner */}
            <div style={styles.profileDropdownAvatarWrap}>
              {profilePicture ? (
                <img src={profilePicture} alt="" style={styles.profileDropdownAvatarImg} />
              ) : (
                <div style={{...styles.profileDropdownAvatarPlaceholder, background: getUserGradient(username)}}>
                  {username ? username[0].toUpperCase() : '?'}
                </div>
              )}
            </div>
            {/* Name */}
            <div style={styles.profileDropdownHeader}>
              <span style={styles.profileDropdownName}>{username}</span>
            </div>
            {/* Menu items */}
            <div style={styles.profileDropdownDivider} />
            <div
              style={styles.profileDropdownItem}
              onClick={() => { setProfileMenuOpen(false); navigate(`/@${username}`); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(167,139,250,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </div>
            <div
              style={styles.profileDropdownItem}
              onClick={() => { setProfileMenuOpen(false); /* settings page placeholder */ }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(167,139,250,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </div>
            <div style={styles.profileDropdownDivider} />
            <div
              style={{ ...styles.profileDropdownItem, color: '#ff6b6b' }}
              onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,107,107,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    flexShrink: 0,
    padding: '0 32px',
    background: 'rgba(19,19,31,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(167,139,250,0.12)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    marginLeft: 240,
    fontFamily: "'Poppins', sans-serif",
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
  profileAvatarBtn: {
    background: 'none',
    border: '2px solid rgba(167,139,250,0.3)',
    borderRadius: '50%',
    width: 38,
    height: 38,
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    marginLeft: 16,
    flexShrink: 0,
    transition: 'border-color 0.2s',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
  },
  profileAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
  },
  profileDropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 280,
    background: 'rgba(19,19,31,0.98)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(167,139,250,0.2)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 1000,
    overflow: 'hidden',
    fontFamily: "'Poppins', sans-serif",
  },
  profileDropdownBanner: {
    width: '100%',
    height: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  profileDropdownBannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  profileDropdownBannerFallback: {
    width: '100%',
    height: '100%',
  },
  profileDropdownAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '3px solid rgba(19,19,31,0.98)',
    overflow: 'hidden',
    marginTop: -24,
    marginLeft: 16,
    position: 'relative',
    zIndex: 1,
    background: '#13131f',
  },
  profileDropdownAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  profileDropdownAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  profileDropdownHeader: {
    padding: '2px 16px 6px',
  },
  profileDropdownName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
  },
  profileDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  profileDropdownDivider: {
    height: 1,
    background: 'rgba(167,139,250,0.12)',
    margin: '4px 0',
  },
};

export default TopBar;
