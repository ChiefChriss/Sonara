import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listProjects } from './api/ProjectApi';
import sonaraLogo from '../assets/sonara_logo.svg';
import waveLeft from '../assets/wave-left.svg';
import waveRight from '../assets/wave-right.svg';
import { usePlayerStore } from '../stores/playerStore';

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

  useEffect(() => {
    document.title = 'Artist Home | Sonara';
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      navigate('/login');
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username);
        }
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
    <div style={styles.container}>
      {/* Background gradient overlay */}
      <div style={styles.backgroundOverlay}></div>

      {/* Wave decorations */}
      <img src={waveLeft} alt="" style={styles.waveLeft} />
      <img src={waveRight} alt="" style={styles.waveRight} />

      {/* Header */}
      <div style={styles.header}>
        <Link to="/home" style={styles.navLink}>Back to Home</Link>
        <div style={styles.headerRight}>
          <Link to={username ? `/@${username}` : '/profile'} style={styles.navLink}>Profile</Link>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Logo */}
        <img src={sonaraLogo} alt="Sonara" style={styles.logo} />

        {/* Create New Track Button */}
        <Link to="/workstation" style={styles.createButton}>
          Create New Track
        </Link>

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
                  style={styles.projectCard}
                >
                  <div style={styles.projectInfo}>
                    <span style={styles.projectTitle}>{project.name}</span>
                    <span style={styles.projectDate}>{new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>
                  <span style={styles.projectArrow}>→</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

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
      `}</style>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Poppins', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(100, 100, 200, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  waveLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: 'auto',
    maxWidth: '350px',
    pointerEvents: 'none',
    opacity: 0.8,
  },
  waveRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    width: 'auto',
    maxWidth: '350px',
    pointerEvents: 'none',
    opacity: 0.8,
  },
  header: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    zIndex: 10,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  navLink: {
    color: 'rgba(255, 255, 255, 0.7)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 0.3s ease',
  },
  logoutButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 50%, #dd4a4a 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
    padding: '20px',
    width: '100%',
    maxWidth: '600px',
    flex: 1,
  },
  logo: {
    width: '100%',
    maxWidth: '280px',
    height: 'auto',
    marginBottom: '50px',
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))',
  },
  createButton: {
    width: '100%',
    padding: '20px 40px',
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
    textDecoration: 'none',
    textAlign: 'center',
    marginBottom: '40px',
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
    backgroundColor: 'rgba(30, 45, 80, 0.6)',
    border: '2px solid rgba(100, 150, 200, 0.3)',
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
    color: '#00d4ff',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px 20px',
  },
};

export default ArtistHome;