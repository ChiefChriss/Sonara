import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listProjects } from './api/ProjectApi';
import sonaraLogo from '../assets/sonara_logo.svg';
import { HomeIcon, TrendingIcon, MusicIcon, MarketplaceIcon, BellIcon, ProfileIcon } from '../components/SidebarIcons';
import { usePlayerStore } from '../stores/playerStore';
import { useNotificationStore } from '../stores/notificationStore';
import { apiFetch } from '../utils/api';
import TrackEditModal from '../components/TrackEditModal';
import { getApiBaseUrl } from '../utils/apiBase';

interface Project {
  id: number;
  name: string;
  updated_at: string;
}

const ArtistHome = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const { currentTrack } = usePlayerStore();
  const { unreadCount, startPolling } = useNotificationStore();
  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadInputId = 'create-upload-track-input';

  useEffect(() => {
    document.title = 'Artist Home | Sonara';
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      navigate('/login');
      return;
    }

    const API_BASE_URL = getApiBaseUrl();

    const fetchProfile = async () => {
      try {
        const response = await apiFetch('/api/auth/profile/');
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        }
        startPolling();
      } catch { /* profile link will fall back to /profile */ }
    };

    const fetchProjects = async () => {
      try {
        const data = await listProjects();
        setProjects(data.map((p) => ({
          id: p.id,
          name: p.name,
          updated_at: p.updated_at,
        })));
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    fetchProjects();
  }, [navigate]);

  const handleLogout = () => {
    usePlayerStore.getState().stop();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <div style={styles.pageWrapper}>
      {/* Sidebar */}
      <nav className="desktop-sidebar" style={{...styles.sidebar, bottom: currentTrack ? 72 : 0}}>
        <div style={styles.sidebarTop}>
          <Link to="/">
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
          <Link to="/create" className="sidebar-link" style={{ ...styles.sidebarLink, ...styles.sidebarLinkActive }}>
            <span style={styles.sidebarIcon}><MusicIcon /></span> Create Music
          </Link>
          <Link to="/marketplace" className="sidebar-link" style={styles.sidebarLink}>
            <span style={styles.sidebarIcon}><MarketplaceIcon /></span> Marketplace
          </Link>
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
          <Link to="/workstation" style={styles.uploadBtn}>Upload Track</Link>
        </div>
      </nav>

      {/* Main Area */}
      <div className="sidebar-main" style={styles.mainArea}>
        <div className="create-content" style={styles.content}>
          {/* Create New Track (DAW) */}
          <Link to="/workstation" className="create-btn" style={styles.createButton}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Track
          </Link>

          {/* Upload Track */}
          <input
            ref={uploadInputRef}
            id={uploadInputId}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            style={styles.hiddenUploadInput}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setTrackFile(f);
                setShowUploadModal(true);
              }
              e.target.value = '';
            }}
          />
          <label
            htmlFor={uploadInputId}
            className="create-btn"
            style={styles.uploadButton}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Track
          </label>

          {/* My Projects Section */}
          <div style={styles.projectsSection}>
            <h2 style={styles.sectionTitle}>My Projects</h2>

            <div style={styles.projectsList}>
              {loading ? (
                <p style={styles.emptyText}>Loading projects...</p>
              ) : projects.length === 0 ? (
                <p style={styles.emptyText}>No saved projects yet. Create your first track!</p>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/workstation/${project.id}`}
                    className="create-project-card"
                    style={styles.projectCard}
                  >
                    <div style={styles.projectInfo}>
                      <span className="create-project-title" style={styles.projectTitle}>{project.name}</span>
                      <span style={styles.projectDate}>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                    <span style={styles.projectArrow}>→</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Track Modal (same as profile page) */}
      {showUploadModal && (
        <TrackEditModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setTrackFile(null);
          }}
          mode="upload_track"
          initialFile={trackFile}
          onSuccess={() => {
            setShowUploadModal(false);
            setTrackFile(null);
          }}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        a:hover {
          opacity: 0.9;
        }

        .sidebar-link:hover {
          background: rgba(167,139,250,0.1);
          color: #fff !important;
        }
      `}</style>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
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
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 100,
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
    textAlign: 'center' as const,
  },
  sidebarBottom: {
    padding: '16px 12px 24px',
    borderTop: '1px solid rgba(167,139,250,0.1)',
  },
  uploadBtn: {
    display: 'block',
    textAlign: 'center' as const,
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
    overflowY: 'auto',
    marginLeft: 240,
    height: '100vh',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 40px',
    width: '100%',
    maxWidth: '700px',
    margin: '0 auto',
  },
  createButton: {
    width: '100%',
    padding: '20px 40px',
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(167,139,250,0.3)',
    textDecoration: 'none',
    textAlign: 'center' as const,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    width: '100%',
    padding: '18px 40px',
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'transparent',
    border: '2px solid rgba(167,139,250,0.4)',
    borderRadius: '12px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    textAlign: 'center' as const,
    marginBottom: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenUploadInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
  projectsSection: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '20px',
  },
  projectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: '10px',
  },
  projectCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    backgroundColor: 'rgba(30,25,50,0.6)',
    border: '2px solid rgba(167,139,250,0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    textDecoration: 'none',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  projectInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  projectTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '400px',
  },
  projectDate: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  projectArrow: {
    fontSize: '20px',
    color: '#a78bfa',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
};

export default ArtistHome;
