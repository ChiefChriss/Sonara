import { useLocation, useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../stores/notificationStore';
import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationStore();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    apiFetch('/api/auth/profile/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.username) setUsername(data.username); })
      .catch(() => {});
  }, []);

  const hiddenRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/', '/terms-of-service'];
  if (hiddenRoutes.includes(location.pathname) || location.pathname.startsWith('/workstation')) return null;

  const tabs = [
    { key: 'home', label: 'Home', path: '/home', icon: homeSvg },
    { key: 'explore', label: 'Tracks', path: '/explore', icon: trendingSvg },
    { key: 'create', label: 'Create', path: '/create', icon: createSvg },
    { key: 'notifications', label: 'Alerts', path: '/notifications', icon: bellSvg, badge: unreadCount },
    { key: 'profile', label: 'Profile', path: username ? `/@${username}` : '/profile', icon: profileSvg },
  ];

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home';
    if (path.startsWith('/@')) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav style={styles.nav}>
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        const isCreate = tab.key === 'create';
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
          >
            {isCreate ? (
              <span style={styles.createBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            ) : (
              <span
                style={styles.iconWrap}
                dangerouslySetInnerHTML={{ __html: tab.icon(active) }}
              />
            )}
            {tab.badge && tab.badge > 0 ? (
              <span style={styles.badge}>{tab.badge > 99 ? '99+' : tab.badge}</span>
            ) : null}
            {!isCreate && (
              <span style={{ ...styles.label, ...(active ? styles.labelActive : {}) }}>{tab.label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

const homeSvg = (active: boolean) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${active ? '#a78bfa' : 'none'}" stroke="${active ? '#a78bfa' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

const trendingSvg = (active: boolean) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${active ? '#a78bfa' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

const createSvg = (_active: boolean) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#cg)" stroke-width="2.5" stroke-linecap="round"><defs><linearGradient id="cg" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const bellSvg = (active: boolean) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${active ? '#a78bfa' : 'none'}" stroke="${active ? '#a78bfa' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

const profileSvg = (active: boolean) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${active ? '#a78bfa' : 'none'}" stroke="${active ? '#a78bfa' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
    height: 'auto',
    boxSizing: 'border-box',
    background: 'rgba(13,13,25,0.97)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(167,139,250,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 9998,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    fontFamily: "'Poppins', sans-serif",
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 12px',
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
  },
  tabActive: {},
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  label: {
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: '#a78bfa',
    fontWeight: 600,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(167,139,250,0.4)',
    marginBottom: -2,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
};

export default MobileNav;
