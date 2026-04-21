import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from './utils/api';
import sonaraLogo from './assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from './components/SidebarIcons';
import { getTrackGradient } from './utils/trackGradient';
import { useNotificationStore } from './stores/notificationStore';
import { usePlayerStore } from './stores/playerStore';
import { fullBleedSafeArea } from './utils/safeArea';
import { PlayGlyph, PauseGlyph } from './components/MediaIcons';

// ── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceItem {
  id: number;
  item_type: 'track' | 'publication';
  title: string;
  audio_file: string;
  username: string;
  display_name?: string;
  profile_picture: string | null;
  cover_image?: string | null;
  play_count?: number;
  like_count?: number;
  price: string;
  is_liked?: boolean;
}

interface PurchasedItem {
  itemId: number;
  itemType: 'track' | 'publication';
  title: string;
  artist: string;
  price: string;
  purchasedAt: string;
  audioUrl: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Marketplace = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'track' | 'publication'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const { unreadCount, startPolling } = useNotificationStore();
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);

  // Purchase modal state
  const [buyingItem, setBuyingItem] = useState<MarketplaceItem | null>(null);
  const [step, setStep] = useState<'confirm' | 'payment' | 'success'>('confirm');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardError, setCardError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [purchased, setPurchased] = useState<PurchasedItem[]>([]);
  const [showPurchases, setShowPurchases] = useState(false);
  const [alreadyOwned, setAlreadyOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'Marketplace | Sonara';
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }

    const init = async () => {
      try {
        const profileRes = await apiFetch('/api/auth/profile/');
        if (!profileRes.ok) { navigate('/login'); return; }
        const profileData = await profileRes.json();
        setUsername(profileData.username);
        startPolling();

        // Fetch unified marketplace items
        const marketRes = await apiFetch('/api/auth/marketplace/');
        if (marketRes.ok) {
          const data: MarketplaceItem[] = await marketRes.json();
          setItems(data);
          const liked = new Set<string>(
            data.filter(i => i.is_liked).map(i => `${i.item_type}-${i.id}`)
          );
          setLikedKeys(liked);
        }

        // Load prior purchases
        const purchasesRes = await apiFetch('/api/auth/purchases/');
        if (purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          const ownedKeys = new Set<string>(purchasesData.map((p: any) => {
            if (p.item_type === 'track') return `track-${p.track?.id}`;
            return `publication-${p.publication?.id}`;
          }));
          setAlreadyOwned(ownedKeys);
          setPurchased(purchasesData.map((p: any) => {
            const item = p.item_type === 'track' ? p.track : p.publication;
            return {
              itemId: item?.id,
              itemType: p.item_type,
              title: item?.title || '',
              artist: item?.display_name || item?.username || '',
              price: p.amount_paid === '0.00' ? 'Free' : `$${p.amount_paid}`,
              purchasedAt: new Date(p.purchased_at).toLocaleString(),
              audioUrl: item?.audio_file || '',
            };
          }));
        }
      } catch {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ownedKey = (item: MarketplaceItem) => `${item.item_type}-${item.id}`;
  const getPrice = (item: MarketplaceItem) => parseFloat(item.price || '0');
  const getPriceLabel = (item: MarketplaceItem) => {
    const p = getPrice(item);
    return p === 0 ? 'Free' : `$${p.toFixed(2)}`;
  };

  const filteredItems = items
    .filter(item => {
      if (priceFilter === 'free' && getPrice(item) !== 0) return false;
      if (priceFilter === 'paid' && getPrice(item) === 0) return false;
      if (typeFilter === 'track' && item.item_type !== 'track') return false;
      if (typeFilter === 'publication' && item.item_type !== 'publication') return false;
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.username || '').toLowerCase().includes(q) ||
        (item.display_name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') return getPrice(a) - getPrice(b);
      if (sortOrder === 'desc') return getPrice(b) - getPrice(a);
      return 0;
    });

  const anyFilterActive = typeFilter !== 'all' || priceFilter !== 'all' || sortOrder !== 'none';

  const isItemPlaying = (item: MarketplaceItem) =>
    isPlaying && currentTrack?.id === item.id && currentTrack?.type === item.item_type;

  const playItem = (item: MarketplaceItem) => {
    const store = usePlayerStore.getState();
    if (currentTrack?.id === item.id && currentTrack?.type === item.item_type) {
      store.togglePlayPause();
    } else {
      const queue = filteredItems.map((entry) => ({
        id: entry.id,
        title: entry.title,
        artist: entry.display_name || entry.username,
        artistHandle: entry.username,
        audioUrl: entry.audio_file,
        coverImage: entry.cover_image || null,
        type: entry.item_type,
      }));
      store.play({
        id: item.id,
        title: item.title,
        artist: item.display_name || item.username,
        artistHandle: item.username,
        audioUrl: item.audio_file,
        coverImage: item.cover_image || null,
        type: item.item_type,
      }, { queue });
    }
  };

  const toggleLike = async (item: MarketplaceItem) => {
    const key = `${item.item_type}-${item.id}`;
    const endpoint = item.item_type === 'track'
      ? `/api/auth/tracks/${item.id}/like/`
      : `/api/auth/publications/${item.id}/like/`;
    try {
      await apiFetch(endpoint, { method: 'POST' });
      setLikedKeys(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    } catch { /* silent */ }
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const openBuy = (item: MarketplaceItem) => {
    if (alreadyOwned.has(ownedKey(item))) return;
    setBuyingItem(item);
    setStep('confirm');
    setCardNumber(''); setCardName(''); setCardExpiry(''); setCardCVV(''); setCardError('');
  };

  const closeBuy = () => { setBuyingItem(null); setProcessing(false); };

  const handleConfirm = () => {
    if (!buyingItem) return;
    if (getPrice(buyingItem) === 0) {
      handleFreeDownload();
    } else {
      setStep('payment');
    }
  };

  const recordPurchased = (item: MarketplaceItem) => {
    setPurchased(prev => [...prev, {
      itemId: item.id,
      itemType: item.item_type,
      title: item.title,
      artist: item.display_name || item.username,
      price: getPriceLabel(item),
      purchasedAt: new Date().toLocaleString(),
      audioUrl: item.audio_file,
    }]);
    setAlreadyOwned(prev => new Set([...prev, ownedKey(item)]));
  };

  const handleFreeDownload = async () => {
    if (!buyingItem) return;
    setProcessing(true);
    const endpoint = buyingItem.item_type === 'track'
      ? `/api/auth/tracks/${buyingItem.id}/purchase/`
      : `/api/auth/publications/${buyingItem.id}/purchase/`;
    try {
      await apiFetch(endpoint, { method: 'POST' });
    } catch { /* silent */ }
    recordPurchased(buyingItem);
    setProcessing(false);
    setStep('success');
  };

  const handlePayment = async () => {
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length !== 16) { setCardError('Please enter a valid 16-digit card number.'); return; }
    if (cardName.trim().length < 2) { setCardError('Please enter the cardholder name.'); return; }
    if (cardExpiry.length < 5) { setCardError('Please enter a valid expiry date (MM/YY).'); return; }
    if (cardCVV.length < 3) { setCardError('Please enter a valid CVV.'); return; }
    setCardError('');
    setProcessing(true);
    const endpoint = buyingItem!.item_type === 'track'
      ? `/api/auth/tracks/${buyingItem!.id}/purchase/`
      : `/api/auth/publications/${buyingItem!.id}/purchase/`;
    try {
      await apiFetch(endpoint, { method: 'POST' });
    } catch { /* silent */ }
    setTimeout(() => {
      recordPurchased(buyingItem!);
      setProcessing(false);
      setStep('success');
    }, 1500);
  };

  const totalSpent = purchased
    .filter(p => p.price !== 'Free')
    .reduce((sum, p) => sum + parseFloat(p.price.replace('$', '')), 0);

  const formatCount = (n?: number) => {
    if (!n) return '0';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  };


  return (
    <div style={{ ...styles.pageWrapper, ...fullBleedSafeArea }}>
      {/* Sidebar */}
      <aside className="desktop-sidebar" style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <img src={sonaraLogo} alt="Sonara" style={styles.sidebarLogo} />
        </div>
        <nav style={styles.sidebarNav}>
          <Link to="/" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><HomeIcon /></span> Home
          </Link>
          <Link to="/explore" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><TrendingIcon /></span> Tracks
          </Link>
          <Link to="/create" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MusicIcon /></span> Create Music
          </Link>
          <div style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><MarketplaceIcon /></span> Marketplace
          </div>
          <Link to="/notifications" className="sidebar-link" style={{ ...styles.sidebarLink, position: 'relative' }}>
            <span style={styles.sidebarIcon}><BellIcon /></span> Notifications
            {unreadCount > 0 && (
              <span style={styles.notifBadge}>{unreadCount}</span>
            )}
          </Link>
          <Link to={username ? `/@${username}` : '/profile'} className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><ProfileIcon /></span> Profile
          </Link>
          <div style={{ ...styles.sidebarLink, cursor: 'pointer', marginTop: 8 }} onClick={() => setShowPurchases(true)}>
            <span style={styles.sidebarIcon}>🧾</span>
            My Library
            {purchased.length > 0 && <span style={styles.libraryBadge}>{purchased.length}</span>}
          </div>
        </nav>
        <div style={styles.sidebarBottom}>
          <Link to="/create" style={styles.uploadBtn}>+ Upload Track</Link>
        </div>
      </aside>

      {/* Main */}
      <div className="sidebar-main" style={styles.mainArea}>
        {/* Hero */}
        <div style={styles.heroBanner}>
          <div style={styles.heroOverlay} />
          <div style={styles.heroContent}>
            <h1 style={styles.heroTitle}>Marketplace</h1>
            <p style={styles.heroSubtitle}>Buy tracks and publications directly from artists. Support the music you love.</p>
          </div>
        </div>

        <div className="marketplace-main" style={styles.mainContent}>
          {/* Search + Filter Bar */}
          <div style={styles.filterBar}>
            <div style={styles.searchWrapper}>
              <span style={{ opacity: 0.5, fontSize: 14 }}>🔍</span>
              <input
                type="text"
                placeholder="Search tracks, publications or artists..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                style={{ ...styles.filterBtn, ...(anyFilterActive ? styles.filterBtnActive : {}) }}
                onClick={() => setFilterOpen(o => !o)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                Filter
                {anyFilterActive && <span style={styles.filterDot} />}
              </button>
              {filterOpen && (
                <div style={styles.filterDropdown}>
                  <div style={styles.filterSection}>Type</div>
                  {([
                    { key: 'all', label: 'All Types' },
                    { key: 'track', label: 'Audio Tracks' },
                    { key: 'publication', label: 'Publications' },
                  ] as const).map(f => (
                    <div
                      key={f.key}
                      style={{ ...styles.filterOption, ...(typeFilter === f.key ? styles.filterOptionActive : {}) }}
                      onClick={() => setTypeFilter(f.key)}
                    >
                      {f.label}
                      {typeFilter === f.key && <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  ))}
                  <div style={{ ...styles.filterSection, marginTop: 6 }}>Price</div>
                  {([
                    { key: 'all', label: 'Any Price' },
                    { key: 'free', label: 'Free' },
                    { key: 'paid', label: 'Paid' },
                  ] as const).map(f => (
                    <div
                      key={f.key}
                      style={{ ...styles.filterOption, ...(priceFilter === f.key ? styles.filterOptionActive : {}) }}
                      onClick={() => setPriceFilter(f.key)}
                    >
                      {f.label}
                      {priceFilter === f.key && <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  ))}
                  <div style={{ ...styles.filterSection, marginTop: 6 }}>Sort by Price</div>
                  {([
                    { key: 'none', label: 'Default' },
                    { key: 'asc', label: 'Low to High' },
                    { key: 'desc', label: 'High to Low' },
                  ] as const).map(f => (
                    <div
                      key={f.key}
                      style={{ ...styles.filterOption, ...(sortOrder === f.key ? styles.filterOptionActive : {}) }}
                      onClick={() => setSortOrder(f.key)}
                    >
                      {f.label}
                      {sortOrder === f.key && <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  ))}
                  {anyFilterActive && (
                    <div
                      style={{ ...styles.filterOption, color: 'rgba(255,100,100,0.8)', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}
                      onClick={() => { setTypeFilter('all'); setPriceFilter('all'); setSortOrder('none'); }}
                    >
                      Clear filters
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="marketplace-stats" style={styles.statsRow}>
            <div style={styles.statCard}>
              <span style={styles.statNum}>{items.length}</span>
              <span style={styles.statLabel}>Total Items</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statNum}>{items.filter(i => i.item_type === 'track').length}</span>
              <span style={styles.statLabel}>Audio Tracks</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statNum}>{items.filter(i => i.item_type === 'publication').length}</span>
              <span style={styles.statLabel}>Publications</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statNum}>{purchased.length}</span>
              <span style={styles.statLabel}>Your Library</span>
            </div>
          </div>

          {/* Item grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>Loading marketplace...</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
              No items found. Try a different filter or search.
            </div>
          ) : (
            <div className="track-grid-responsive marketplace-grid" style={styles.trackGrid}>
              {filteredItems.map(item => {
                const owned = alreadyOwned.has(ownedKey(item));
                const isOwner = username && item.username === username;
                const isFree = getPrice(item) === 0;
                const isPub = item.item_type === 'publication';
                const likeKey = `${item.item_type}-${item.id}`;
                const liked = likedKeys.has(likeKey);
                return (
                  <div key={`${item.item_type}-${item.id}`} style={styles.trackCard}>
                    {/* Clickable area — cover + info — navigates to content page */}
                    <Link to={`/${item.item_type}/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                      {/* Cover */}
                      <div className="card-img-wrap" style={styles.cardImageWrap}>
                        {item.cover_image ? (
                          <img src={item.cover_image} alt="" style={styles.cardImage} />
                        ) : (
                          <div style={{ ...styles.cardGradient, background: getTrackGradient(item.id) }} />
                        )}
                        {/* Price badge */}
                        {!owned && !isOwner && (
                          <div style={{ ...styles.priceBadge, background: isFree ? 'rgba(52,211,153,0.9)' : 'rgba(167,139,250,0.9)' }}>
                            {getPriceLabel(item)}
                          </div>
                        )}
                        {/* Type badge */}
                        <div style={{ ...styles.typeBadge, background: isPub ? 'rgba(236,72,153,0.85)' : 'rgba(99,102,241,0.85)' }}>
                          {isPub ? 'PUB' : 'TRACK'}
                        </div>
                        {/* Owned badge */}
                        {(owned || isOwner) && <div style={styles.ownedBadge}>{isOwner ? 'Your Track' : 'Owned'}</div>}
                        {/* Play button */}
                        <button
                          type="button"
                          className="card-play-btn"
                          style={{ ...styles.cardPlayBtn, opacity: isItemPlaying(item) ? 1 : undefined }}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); playItem(item); }}
                        >
                          {isItemPlaying(item) ? <PauseGlyph size={15} fill="#fff" /> : <PlayGlyph size={15} fill="#fff" />}
                        </button>
                        {/* Like button */}
                        <button
                          type="button"
                          className="card-heart-btn"
                          style={{ ...styles.cardHeartBtn, color: liked ? '#ff4d6d' : 'rgba(255,255,255,0.7)' }}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleLike(item); }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? '#ff4d6d' : 'none'} stroke={liked ? '#ff4d6d' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      </div>

                      {/* Info */}
                      <div style={styles.cardBody}>
                        <p style={styles.cardTitle}>{item.title}</p>
                        <p style={{ ...styles.cardArtist, pointerEvents: 'none' }}>
                          {item.display_name || item.username}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <PlayGlyph size={10} fill="rgba(255,255,255,0.35)" />
                            {formatCount(item.play_count)}
                          </span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            {formatCount(item.like_count)}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Buy / Get / Owned button — outside the Link so it never navigates */}
                    <button
                      type="button"
                      style={{
                        ...styles.buyBtn,
                        ...((owned || isOwner) ? styles.ownedBtn : isFree ? styles.freeBtn : styles.paidBtn),
                      }}
                      onClick={() => { if (!owned && !isOwner) openBuy(item); }}
                      disabled={owned || !!isOwner}
                    >
                      {isOwner ? 'Your Track' : owned ? 'In Your Library' : isFree ? 'Get Free' : `Buy ${getPriceLabel(item)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PURCHASE MODAL */}
      {buyingItem && (
        <div style={styles.modalOverlay} onClick={closeBuy}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>

            {step === 'confirm' && (
              <>
                <h2 style={styles.modalTitle}>
                  {getPrice(buyingItem) === 0 ? '🎁 Get for Free' : 'Confirm Purchase'}
                </h2>
                <div style={styles.modalTrackInfo}>
                  <div style={{ ...styles.modalArt, background: getTrackGradient(buyingItem.id) }}>
                    {buyingItem.cover_image
                      ? <img src={buyingItem.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                      : <span style={{ fontSize: 24 }}>{buyingItem.item_type === 'publication' ? '🎼' : '🎵'}</span>}
                  </div>
                  <div>
                    <p style={styles.modalTrackName}>{buyingItem.title}</p>
                    <p style={styles.modalTrackArtist}>by {buyingItem.display_name || buyingItem.username}</p>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: buyingItem.item_type === 'publication' ? 'rgba(236,72,153,0.2)' : 'rgba(99,102,241,0.2)', color: buyingItem.item_type === 'publication' ? '#ec4899' : '#a78bfa', fontWeight: 600 }}>
                      {buyingItem.item_type === 'publication' ? 'Publication' : 'Audio Track'}
                    </span>
                  </div>
                </div>
                {buyingItem.item_type === 'track' && (
                  <p style={styles.itemNote}>You'll receive an <strong>audio file</strong> — importable into your workstation or downloadable.</p>
                )}
                {buyingItem.item_type === 'publication' && (
                  <p style={styles.itemNote}>You'll receive a <strong>rendered song</strong> published from the artist's workstation.</p>
                )}
                <div style={styles.modalPriceLine}>
                  <span style={styles.modalPriceLabel}>Price</span>
                  <span style={{ ...styles.modalPriceValue, color: getPrice(buyingItem) === 0 ? '#34d399' : '#a78bfa' }}>
                    {getPriceLabel(buyingItem)}
                  </span>
                </div>
                <div style={styles.modalButtons}>
                  <button style={styles.cancelBtn} onClick={closeBuy}>Cancel</button>
                  <button style={styles.confirmBtn} onClick={handleConfirm} disabled={processing}>
                    {processing ? 'Processing...' : getPrice(buyingItem) === 0 ? 'Add to Library' : 'Continue to Payment'}
                  </button>
                </div>
              </>
            )}

            {step === 'payment' && (
              <>
                <h2 style={styles.modalTitle}>Payment Details</h2>
                <div style={styles.modalTrackInfo}>
                  <div style={{ ...styles.modalArt, background: getTrackGradient(buyingItem.id) }}>
                    {buyingItem.cover_image
                      ? <img src={buyingItem.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                      : <span style={{ fontSize: 20 }}>{buyingItem.item_type === 'publication' ? '🎼' : '🎵'}</span>}
                  </div>
                  <div>
                    <p style={styles.modalTrackName}>{buyingItem.title}</p>
                    <p style={styles.modalTrackArtist}>by {buyingItem.display_name || buyingItem.username} • {getPriceLabel(buyingItem)}</p>
                  </div>
                </div>

                {/* Mock Card Visual */}
                <div style={styles.mockCard}>
                  <div style={styles.mockCardTop}>
                    <span style={styles.mockCardBank}>SONARA PAY</span>
                    <span style={{ fontSize: 22, color: '#fbbf24' }}>▣</span>
                  </div>
                  <p style={styles.mockCardNumber}>{cardNumber || '•••• •••• •••• ••••'}</p>
                  <div style={styles.mockCardBottom}>
                    <div>
                      <p style={styles.mockCardLabel}>CARD HOLDER</p>
                      <p style={styles.mockCardValue}>{cardName || 'YOUR NAME'}</p>
                    </div>
                    <div>
                      <p style={styles.mockCardLabel}>EXPIRES</p>
                      <p style={styles.mockCardValue}>{cardExpiry || 'MM/YY'}</p>
                    </div>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Card Number</label>
                  <input style={styles.formInput} placeholder="4242 4242 4242 4242" maxLength={19} value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Cardholder Name</label>
                  <input style={styles.formInput} placeholder="John Doe" value={cardName} onChange={e => setCardName(e.target.value)} />
                </div>
                <div style={styles.formRow}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.formLabel}>Expiry</label>
                    <input style={styles.formInput} placeholder="MM/YY" maxLength={5} value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.formLabel}>CVV</label>
                    <input style={styles.formInput} placeholder="•••" maxLength={4} type="password" value={cardCVV} onChange={e => setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                  </div>
                </div>
                {cardError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{cardError}</p>}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 16 }}>
                  🔒 Simulation only — no real card is charged
                </p>
                <div style={styles.modalPriceLine}>
                  <span style={styles.modalPriceLabel}>Total</span>
                  <span style={styles.modalPriceValue}>{getPriceLabel(buyingItem)}</span>
                </div>
                <div style={styles.modalButtons}>
                  <button style={styles.cancelBtn} onClick={() => setStep('confirm')}>Back</button>
                  <button style={styles.confirmBtn} onClick={handlePayment} disabled={processing}>
                    {processing ? 'Processing...' : `Pay ${getPriceLabel(buyingItem)}`}
                  </button>
                </div>
              </>
            )}

            {step === 'success' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
                <h2 style={styles.modalTitle}>
                  {getPrice(buyingItem) === 0 ? 'Added to Library!' : 'Payment Successful!'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 }}>
                  You now own <strong>{buyingItem.title}</strong> by {buyingItem.display_name || buyingItem.username}.
                </p>
                {getPrice(buyingItem) > 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
                    A payment confirmation has been sent to your email address. The artist has been notified of your purchase.
                  </p>
                )}
                {getPrice(buyingItem) === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
                    This item is now available in your library and can be imported into the workstation.
                  </p>
                )}
                <div style={styles.modalPriceLine}>
                  <span style={styles.modalPriceLabel}>Amount Paid</span>
                  <span style={{ ...styles.modalPriceValue, color: getPrice(buyingItem) === 0 ? '#34d399' : '#a78bfa' }}>
                    {getPriceLabel(buyingItem)}
                  </span>
                </div>
                {totalSpent > 0 && (
                  <div style={styles.modalPriceLine}>
                    <span style={styles.modalPriceLabel}>Total Spent (All Time)</span>
                    <span style={styles.modalPriceValue}>${totalSpent.toFixed(2)}</span>
                  </div>
                )}
                <button style={{ ...styles.confirmBtn, width: '100%', marginTop: 16 }} onClick={closeBuy}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY LIBRARY MODAL */}
      {showPurchases && (
        <div style={styles.modalOverlay} onClick={() => setShowPurchases(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🧾 My Library</h2>
            {purchased.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '20px 0' }}>
                Your library is empty — go grab some tracks!
              </p>
            ) : (
              <>
                {purchased.map((p, i) => (
                  <div key={i} style={styles.purchaseRow}>
                    <div style={{ ...styles.purchaseArt, background: getTrackGradient(p.itemId) }}>
                      {p.itemType === 'publication' ? '🎼' : '🎵'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{p.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>by {p.artist}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{p.purchasedAt}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: p.price === 'Free' ? '#34d399' : '#a78bfa' }}>
                        {p.price}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: p.itemType === 'publication' ? 'rgba(236,72,153,0.2)' : 'rgba(99,102,241,0.2)', color: p.itemType === 'publication' ? '#ec4899' : '#a78bfa', fontWeight: 600 }}>
                        {p.itemType === 'publication' ? 'PUB' : 'TRACK'}
                      </span>
                    </div>
                  </div>
                ))}
                {totalSpent > 0 && (
                  <div style={{ ...styles.modalPriceLine, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                    <span style={styles.modalPriceLabel}>Total Spent</span>
                    <span style={styles.modalPriceValue}>${totalSpent.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <button style={{ ...styles.confirmBtn, width: '100%', marginTop: 16 }} onClick={() => setShowPurchases(false)}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.35); }
        input:focus { outline: none; border-color: #a78bfa !important; }
        .sidebar-link:hover { background: rgba(167,139,250,0.1); color: #fff !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
        .card-play-btn { opacity: 0; transition: opacity 0.15s; }
        .card-img-wrap:hover .card-play-btn { opacity: 1 !important; }
        .card-heart-btn:hover { transform: scale(1.15); }
        @media (max-width: 768px) {
          .marketplace-main { padding: 16px 14px 220px !important; }
          .marketplace-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .marketplace-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
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
  sidebarBottom: { padding: '16px 12px 24px', borderTop: '1px solid rgba(167,139,250,0.1)' },
  uploadBtn: { display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" },
  notifBadge: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', minWidth: 20, textAlign: 'center' },
  libraryBadge: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: '#ec4899', color: '#fff' },
  mainArea: { flex: 1, marginLeft: 240, minHeight: '100vh', overflowY: 'auto' },
  heroBanner: { position: 'relative', height: 180, background: 'linear-gradient(135deg, #1c1c2e 0%, #312e81 50%, #4c1d95 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroOverlay: { position: 'absolute', inset: 0, background: 'rgba(15,15,26,0.4)', pointerEvents: 'none' },
  heroContent: { position: 'relative', zIndex: 1, textAlign: 'center' },
  heroTitle: { fontSize: 34, fontWeight: 800, marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.65)' },
  mainContent: { padding: '28px 32px 100px' },
  filterBar: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' },
  searchWrapper: { display: 'flex', alignItems: 'center', gap: 10, background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 16px', flex: 1, minWidth: 200 },
  searchInput: { background: 'transparent', border: 'none', color: 'white', fontSize: 14, fontFamily: "'Poppins', sans-serif", width: '100%' },
  filterBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const },
  filterBtnActive: { border: '1px solid #a78bfa', color: '#a78bfa', background: 'rgba(167,139,250,0.1)' },
  filterDot: { width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' },
  filterDropdown: { position: 'absolute' as const, top: 'calc(100% + 6px)', right: 0, width: 190, background: 'rgba(19,19,31,0.98)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', zIndex: 200, overflow: 'hidden', padding: '4px 0' },
  filterOption: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', transition: 'background 0.1s', fontFamily: "'Poppins', sans-serif" },
  filterOptionActive: { background: 'rgba(167,139,250,0.12)', color: '#fff' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 },
  statCard: { background: '#1c1c2e', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  statNum: { fontSize: 26, fontWeight: 800, color: '#a78bfa' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  trackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 },
  trackCard: { cursor: 'pointer', transition: 'transform 0.2s', minWidth: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch' },
  cardImageWrap: { position: 'relative' as const, width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: '#1c1c2e', border: '1px solid rgba(167,139,250,0.15)', flexShrink: 0, cursor: 'pointer' },
  cardImage: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  cardGradient: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' },
  priceBadge: { position: 'absolute' as const, top: 8, left: 8, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white', zIndex: 2 },
  typeBadge: { position: 'absolute' as const, bottom: 8, left: 8, padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: 'white', textTransform: 'uppercase' as const, zIndex: 2 },
  ownedBadge: { position: 'absolute' as const, top: 8, left: 8, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white', background: 'rgba(52,211,153,0.9)', zIndex: 3 },
  cardPlayBtn: { position: 'absolute' as const, zIndex: 2, bottom: 8, right: 8, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(167,139,250,0.4)', transition: 'opacity 0.15s', opacity: 0 },
  cardHeartBtn: { position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s', zIndex: 2 },
  cardBody: { cursor: 'pointer' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: 3 },
  cardArtist: { fontSize: 12, color: '#ec4899', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, cursor: 'pointer', marginBottom: 2 },
  filterSection: { padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  buyBtn: { margin: '8px 14px 14px', padding: '10px', borderRadius: 10, border: 'none', fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' },
  freeBtn: { background: 'linear-gradient(135deg, #34d399, #10b981)', color: 'white' },
  paidBtn: { background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: 'white' },
  ownedBtn: { background: 'rgba(52,211,153,0.1)', color: '#34d399', cursor: 'default', border: '1px solid rgba(52,211,153,0.3)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  modal: { background: '#1a1a2e', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 20, padding: 32, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 22, fontWeight: 700, marginBottom: 20, color: 'white' },
  modalTrackInfo: { display: 'flex', gap: 16, alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 20 },
  modalArt: { width: 56, height: 56, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  modalTrackName: { fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 },
  modalTrackArtist: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  itemNote: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 },
  modalPriceLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalPriceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  modalPriceValue: { fontSize: 22, fontWeight: 800, color: '#a78bfa' },
  modalButtons: { display: 'flex', gap: 12 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #a78bfa, #ec4899)', color: 'white', fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  mockCard: { background: 'linear-gradient(135deg, #312e81, #4c1d95, #7c3aed)', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 8px 32px rgba(124,58,237,0.4)' },
  mockCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  mockCardBank: { fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.9)' },
  mockCardNumber: { fontSize: 18, fontWeight: 600, letterSpacing: 3, color: 'white', marginBottom: 20, fontFamily: 'monospace' },
  mockCardBottom: { display: 'flex', gap: 40 },
  mockCardLabel: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  mockCardValue: { fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase' },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'flex', gap: 12 },
  formLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 },
  formInput: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 14, fontFamily: "'Poppins', sans-serif" },
  purchaseRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  purchaseArt: { width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
};

export default Marketplace;
