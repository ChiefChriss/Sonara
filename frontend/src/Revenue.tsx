import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from './utils/api';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { getTrackGradient } from './utils/trackGradient';
import { useNotificationStore } from './stores/notificationStore';
import { fullBleedSafeArea } from './utils/safeArea';

interface Sale {
  id: number;
  item_type: 'track' | 'publication';
  item_title: string;
  item_id: number;
  buyer_username: string;
  buyer_display_name: string;
  amount: string;
  purchased_at: string;
}

const Revenue = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalRevenue, setTotalRevenue] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const { unreadCount, startPolling } = useNotificationStore();

  useEffect(() => {
    document.title = 'Revenue | Sonara';
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }

    const init = async () => {
      try {
        const profileRes = await apiFetch('/api/auth/profile/');
        if (!profileRes.ok) { navigate('/login'); return; }
        const profileData = await profileRes.json();
        setUsername(profileData.username);
        startPolling();

        const revenueRes = await apiFetch('/api/auth/revenue/');
        if (revenueRes.ok) {
          const data = await revenueRes.json();
          setSales(data.sales || []);
          setTotalRevenue(data.total_revenue || '0.00');
        }
      } catch {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const trackSales = sales.filter(s => s.item_type === 'track');
  const pubSales = sales.filter(s => s.item_type === 'publication');

  // Group by item for per-track breakdown
  const breakdown: Record<string, { title: string; type: string; id: number; count: number; total: number }> = {};
  sales.forEach(s => {
    const key = `${s.item_type}-${s.item_id}`;
    if (!breakdown[key]) {
      breakdown[key] = { title: s.item_title, type: s.item_type, id: s.item_id, count: 0, total: 0 };
    }
    breakdown[key].count++;
    breakdown[key].total += parseFloat(s.amount);
  });
  const breakdownList = Object.values(breakdown).sort((a, b) => b.total - a.total);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ ...styles.pageWrapper, ...fullBleedSafeArea }}>
      {/* Sidebar */}
      <aside className="desktop-sidebar" style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </div>
        <nav style={styles.sidebarNav}>
          <Link to="/home" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><HomeIcon /></span> Home
          </Link>
          <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><TrendingIcon /></span> Tracks
          </Link>
          <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MusicIcon /></span> Create Music
          </Link>
          <Link to="/marketplace" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MarketplaceIcon /></span> Marketplace
          </Link>
          <Link to="/notifications" className="sidebar-link" style={{ ...styles.sidebarLink, position: 'relative' }}>
            <span style={styles.sidebarIcon}><BellIcon /></span> Notifications
            {unreadCount > 0 && <span style={styles.notifBadge}>{unreadCount}</span>}
          </Link>
          <Link to={username ? `/@${username}` : '/profile'} className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><ProfileIcon /></span> Profile
          </Link>
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span> Revenue
          </div>
        </nav>
      </aside>

      {/* Main */}
      <div className="sidebar-main" style={styles.mainArea}>
        {/* Header */}
        <div style={styles.heroBanner}>
          <div style={styles.heroOverlay} />
          <div style={styles.heroContent}>
            <h1 style={styles.heroTitle}>Revenue</h1>
            <p style={styles.heroSubtitle}>Track your sales and earnings from the marketplace.</p>
          </div>
        </div>

        <div className="revenue-main-content" style={styles.mainContent}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>Loading revenue data...</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="revenue-stats" style={styles.statsRow}>
                <div style={{ ...styles.statCard, gridColumn: 'span 1' }}>
                  <span style={{ ...styles.statNum, color: '#34d399' }}>${totalRevenue}</span>
                  <span style={styles.statLabel}>Total Revenue</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statNum}>{sales.length}</span>
                  <span style={styles.statLabel}>Total Sales</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statNum}>{trackSales.length}</span>
                  <span style={styles.statLabel}>Track Sales</span>
                </div>
                <div style={styles.statCard}>
                  <span style={styles.statNum}>{pubSales.length}</span>
                  <span style={styles.statLabel}>Publication Sales</span>
                </div>
              </div>

              {sales.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
                  <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No sales yet</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                    Set a price on your tracks or publications in the marketplace to start earning.
                  </p>
                </div>
              ) : (
                <div className="revenue-two-col" style={styles.twoCol}>
                  {/* Sales feed */}
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Recent Sales</h2>
                    <div style={styles.saleList}>
                      {sales.map(sale => (
                        <div key={sale.id} style={styles.saleRow}>
                          <div style={{ ...styles.saleArt, background: getTrackGradient(sale.item_id) }}>
                            {sale.item_type === 'publication' ? '🎼' : '🎵'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.saleName}>{sale.item_title}</p>
                            <p style={styles.saleBuyer}>
                              Purchased by{' '}
                              <span
                                style={{ color: '#a78bfa', cursor: 'pointer' }}
                                onClick={() => navigate(`/@${sale.buyer_username}`)}
                              >
                                {sale.buyer_display_name || sale.buyer_username}
                              </span>
                            </p>
                            <p style={styles.saleDate}>{formatDate(sale.purchased_at)}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={styles.saleAmount}>
                              {parseFloat(sale.amount) === 0 ? 'Free' : `$${parseFloat(sale.amount).toFixed(2)}`}
                            </p>
                            <span style={{ ...styles.typeTag, background: sale.item_type === 'publication' ? 'rgba(236,72,153,0.2)' : 'rgba(99,102,241,0.2)', color: sale.item_type === 'publication' ? '#ec4899' : '#a78bfa' }}>
                              {sale.item_type === 'publication' ? 'PUB' : 'TRACK'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-item breakdown */}
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>By Item</h2>
                    <div style={styles.saleList}>
                      {breakdownList.map(item => (
                        <div key={`${item.type}-${item.id}`} style={styles.saleRow}>
                          <div style={{ ...styles.saleArt, background: getTrackGradient(item.id) }}>
                            {item.type === 'publication' ? '🎼' : '🎵'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.saleName}>{item.title}</p>
                            <p style={styles.saleBuyer}>{item.count} sale{item.count !== 1 ? 's' : ''}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ ...styles.saleAmount, color: '#34d399' }}>
                              {item.total === 0 ? 'Free' : `$${item.total.toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
        @media (max-width: 768px) {
          .revenue-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .revenue-two-col { grid-template-columns: 1fr !important; }
          .revenue-main-content { padding: 20px 16px 120px !important; }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: { display: 'flex', minHeight: '100vh', background: '#0f0f1a', fontFamily: "'Poppins', sans-serif", color: 'white' },
  sidebar: { width: 240, flexShrink: 0, background: '#13131f', borderRight: '1px solid rgba(167,139,250,0.15)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 },
  sidebarTop: { padding: '24px 20px 16px', borderBottom: '1px solid rgba(167,139,250,0.1)' },
  sidebarLogo: { height: 36, width: 'auto' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 12px', flex: 1 },
  sidebarLink: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s', cursor: 'pointer' },
  sidebarLinkActive: { color: '#ffffff', background: 'rgba(167,139,250,0.15)' },
  sidebarIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  notifBadge: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', minWidth: 20, textAlign: 'center' },
  mainArea: { flex: 1, marginLeft: 240, minHeight: '100vh', overflowY: 'auto' },
  heroBanner: { position: 'relative', height: 160, background: 'linear-gradient(135deg, #052e16 0%, #064e3b 50%, #065f46 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroOverlay: { position: 'absolute', inset: 0, background: 'rgba(15,15,26,0.4)', pointerEvents: 'none' },
  heroContent: { position: 'relative', zIndex: 1, textAlign: 'center' },
  heroTitle: { fontSize: 32, fontWeight: 800, marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },
  mainContent: { padding: '28px 32px 100px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  statCard: { background: '#1c1c2e', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  statNum: { fontSize: 26, fontWeight: 800, color: '#a78bfa' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  emptyState: { textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.7)' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 },
  section: {},
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.9)' },
  saleList: { display: 'flex', flexDirection: 'column', gap: 0 },
  saleRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  saleArt: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  saleName: { fontSize: 14, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  saleBuyer: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  saleDate: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  saleAmount: { fontSize: 16, fontWeight: 700, color: '#a78bfa' },
  typeTag: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase' as const },
};

export default Revenue;
