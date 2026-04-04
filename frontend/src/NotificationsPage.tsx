import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { useNotificationStore } from './stores/notificationStore';
import { apiFetch } from './utils/api';

interface Notification {
  id: number;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  sender_username: string;
  sender_display_name: string;
  sender_profile_picture: string | null;
  track_title: string | null;
  track_id: number | null;
  publication_title: string | null;
  publication_id: number | null;
}

type TabFilter = 'all' | 'likes' | 'follows';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const { clearCount, startPolling, fetchUnreadCount } = useNotificationStore();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    document.title = 'Notifications | Sonara';
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }

    const init = async () => {
      try {
        const profileRes = await apiFetch('/api/auth/profile/');
        if (!profileRes.ok) return;
        const profileData = await profileRes.json();
        setUsername(profileData.username);
        startPolling();

        const notifRes = await apiFetch('/api/auth/notifications/');
        if (notifRes.ok) {
          const notifs: Notification[] = await notifRes.json();
          setNotifications(notifs);
          setUnreadIds(new Set(notifs.filter((n) => !n.is_read).map((n) => n.id)));
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Poll for new notifications every 15 seconds
    const pollId = setInterval(async () => {
      if (!localStorage.getItem('accessToken')) return;
      try {
        const res = await apiFetch('/api/auth/notifications/');
        if (!res.ok) return;
        const notifs: Notification[] = await res.json();
        setNotifications(notifs);
        // Add any new unread ones to the highlighted set
        setUnreadIds((prev) => {
          const next = new Set(prev);
          notifs.forEach((n) => { if (!n.is_read) next.add(n.id); });
          return next;
        });
      } catch { /* silently fail */ }
    }, 15000);

    return () => clearInterval(pollId);
  }, []);

  const filtered = notifications.filter((n) => {
    if (activeTab === 'likes') return n.notification_type === 'like_track' || n.notification_type === 'like_publication';
    if (activeTab === 'follows') return n.notification_type === 'follow';
    return true;
  });


  // Mark all as read when refreshing / closing the tab
  useEffect(() => {
    const markAllRead = () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        fetch(`${API_BASE_URL}/api/auth/notifications/mark-all-read/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
        clearCount();
      }
    };

    window.addEventListener('beforeunload', markAllRead);
    return () => {
      window.removeEventListener('beforeunload', markAllRead);
    };
  }, []);

  // Mark all as read when navigating away via React Router
  const isRealMount = useRef(false);
  useEffect(() => {
    // Skip the first strict mode mount/unmount cycle
    const timer = setTimeout(() => { isRealMount.current = true; }, 100);
    return () => {
      clearTimeout(timer);
      if (isRealMount.current) {
        const token = localStorage.getItem('accessToken');
        if (token) {
          fetch(`${API_BASE_URL}/api/auth/notifications/mark-all-read/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          clearCount();
        }
      }
    };
  }, []);

  const handleNotificationClick = (n: Notification) => {
    if (unreadIds.has(n.id)) {
      // Remove from unread set visually
      setUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
      // Mark as read on server, then update sidebar badge
      const token = localStorage.getItem('accessToken');
      if (token) {
        fetch(`${API_BASE_URL}/api/auth/notifications/${n.id}/read/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).then(() => fetchUnreadCount());
      }
    }
    navigate(getNotificationLink(n));
  };

  const getNotificationText = (n: Notification) => {
    const name = n.sender_display_name || n.sender_username;
    switch (n.notification_type) {
      case 'like_track':
        return <><strong>{name}</strong> liked your track <strong>{n.track_title}</strong></>;
      case 'like_publication':
        return <><strong>{name}</strong> liked your publication <strong>{n.publication_title}</strong></>;
      case 'follow':
        return <><strong>{name}</strong> started following you</>;
      case 'comment':
        return <><strong>{name}</strong> commented on your song</>;
      case 'repost':
        return <><strong>{name}</strong> reposted your song</>;
      default:
        return <><strong>{name}</strong> interacted with your content</>;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like_track':
      case 'like_publication':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4d6d" stroke="#ff4d6d" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      case 'follow':
        return <ProfileIcon color="#fff" />;
      case 'comment':
        return <span style={{ fontSize: 14 }}>💬</span>;
      case 'repost':
        return <span style={{ fontSize: 14 }}>🔁</span>;
      default:
        return <span style={{ fontSize: 14 }}>🔔</span>;
    }
  };

  const getNotificationLink = (n: Notification) => {
    if (n.notification_type === 'follow') return `/@${n.sender_username}`;
    if (n.track_id) return `/track/${n.track_id}`;
    if (n.publication_id) return `/publication/${n.publication_id}`;
    return `/@${n.sender_username}`;
  };

  const timeAgo = (dateStr: string) => {
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

  const isUnread = (n: Notification) => unreadIds.has(n.id);

  const unreadAll = notifications.filter((n) => isUnread(n)).length;
  const unreadLikes = notifications.filter((n) => isUnread(n) && (n.notification_type === 'like_track' || n.notification_type === 'like_publication')).length;
  const unreadFollows = notifications.filter((n) => isUnread(n) && n.notification_type === 'follow').length;

  return (
    <div style={styles.pageWrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
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
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><BellIcon /></span> Notifications
          </div>
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

      {/* Main area */}
      <div style={styles.mainArea}>
        <header style={styles.topBar}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Notifications</h1>
        </header>

        <div style={styles.contentWrapper}>
          <div style={styles.mainContent}>
            {/* Tabs */}
            <div style={styles.tabBar}>
              {([
                { key: 'all' as TabFilter, label: 'All', count: unreadAll },
                { key: 'likes' as TabFilter, label: 'Likes', count: unreadLikes },
                { key: 'follows' as TabFilter, label: 'Follows', count: unreadFollows },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="notif-tab"
                  style={{
                    ...styles.tab,
                    ...(activeTab === tab.key ? styles.tabActive : {}),
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      ...styles.tabBadge,
                      ...(activeTab === tab.key ? styles.tabBadgeActive : {}),
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={styles.scrollArea}>
            {loading ? (
              <div style={styles.emptyState}>
                <div style={styles.loadingPulse} />
                <p style={{ fontSize: 14, opacity: 0.6 }}>Loading notifications...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIconWrap}>
                  <span style={{ fontSize: 56 }}>
                    {activeTab === 'likes' ? '❤️' : activeTab === 'follows' ? '👥' : '🔔'}
                  </span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 600, marginTop: 20 }}>
                  {activeTab === 'all' && 'No notifications yet'}
                  {activeTab === 'likes' && 'No likes yet'}
                  {activeTab === 'follows' && 'No new followers'}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8, maxWidth: 320, lineHeight: 1.5 }}>
                  {activeTab === 'all' && 'When someone likes your song, follows you, or interacts with your content, it\'ll show up here.'}
                  {activeTab === 'likes' && 'When someone likes one of your tracks or publications, you\'ll see it here.'}
                  {activeTab === 'follows' && 'When someone follows you, you\'ll see it here.'}
                </p>
              </div>
            ) : (
              <div style={styles.notifList}>
                {filtered.map((n) => (
                  <div
                    key={n.id}
                    className="notif-row"
                    style={{
                      ...styles.notifRow,
                      ...(isUnread(n) ? styles.notifRowUnread : styles.notifRowRead),
                    }}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {isUnread(n) && <div style={styles.unreadDot} />}
                    <div style={styles.notifAvatar}>
                      {n.sender_profile_picture ? (
                        <img src={n.sender_profile_picture} alt="" style={{
                          ...styles.notifAvatarImg,
                          borderColor: isUnread(n) ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.2)',
                        }} />
                      ) : (
                        <div style={styles.notifAvatarPh}><ProfileIcon color="#ec4899" /></div>
                      )}
                      <div style={styles.notifIconBadge}>
                        {getNotificationIcon(n.notification_type)}
                      </div>
                    </div>
                    <div style={styles.notifBody}>
                      <p style={{
                        ...styles.notifText,
                        color: isUnread(n) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)',
                        fontWeight: isUnread(n) ? 500 : 400,
                      }}>{getNotificationText(n)}</p>
                      <p style={styles.notifTime}>{timeAgo(n.created_at)}</p>
                    </div>
                    <div style={styles.notifArrow}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
        .notif-row:hover { background: rgba(167,139,250,0.12) !important; }
        .notif-tab:hover { color: #fff !important; background: rgba(167,139,250,0.08); }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
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
  mainArea: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
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
  contentWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 32px',
    overflow: 'hidden',
  },
  mainContent: {
    width: '100%',
    maxWidth: 680,
    paddingTop: 32,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 120,
  },

  // Tabs
  tabBar: {
    display: 'flex',
    gap: 6,
    padding: '4px',
    background: 'rgba(28,28,46,0.5)',
    borderRadius: 14,
    marginBottom: 28,
    border: '1px solid rgba(167,139,250,0.1)',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabActive: {
    background: 'rgba(167,139,250,0.2)',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(167,139,250,0.15)',
  },
  tabBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 9999,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)',
  },
  tabBadgeActive: {
    background: 'rgba(167,139,250,0.3)',
    color: '#a78bfa',
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    background: 'rgba(167,139,250,0.08)',
    border: '1px solid rgba(167,139,250,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingPulse: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '3px solid rgba(167,139,250,0.15)',
    borderTopColor: '#a78bfa',
    animation: 'spin 0.8s linear infinite',
  },

  // Notification list
  notifList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  notifRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 22px',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  notifRowUnread: {
    background: 'rgba(167,139,250,0.1)',
    border: '1px solid rgba(167,139,250,0.25)',
    boxShadow: '0 0 12px rgba(167,139,250,0.08)',
  },
  notifRowRead: {
    background: 'rgba(28,28,46,0.3)',
    border: '1px solid rgba(167,139,250,0.06)',
  },
  unreadDot: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    boxShadow: '0 0 6px rgba(167,139,250,0.5)',
  },
  notifAvatar: {
    position: 'relative',
    flexShrink: 0,
  },
  notifAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(167,139,250,0.2)',
  },
  notifAvatarPh: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(236,72,153,0.15))',
    border: '2px solid rgba(167,139,250,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },
  notifIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#1c1c2e',
    border: '2px solid #0f0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.5,
  },
  notifTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  notifArrow: {
    flexShrink: 0,
    opacity: 0.5,
  },
};

export default NotificationsPage;
