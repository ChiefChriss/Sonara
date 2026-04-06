import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import waveLeft from './assets/wave-left.svg';
import waveRight from './assets/wave-right.svg';

const NotFound = () => {
  useEffect(() => {
    document.title = '404 | Sonara';
  }, []);

  return (
    <div style={styles.container}>
      {/* Background gradient overlay */}
      <div style={styles.backgroundOverlay}></div>

      {/* Wave decorations */}
      <img src={waveLeft} alt="" style={styles.waveLeft} />
      <img src={waveRight} alt="" style={styles.waveRight} />

      <div style={styles.content}>
        {/* Logo */}
        <img src={sonaraLogo} alt="Sonara" style={styles.logo} />

        {/* 404 Text */}
        <h1 style={styles.errorCode}>404</h1>
        <h2 style={styles.title}>Page Not Found</h2>
        <p style={styles.subtitle}>
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Back Home Button */}
        <Link to="/" style={styles.homeButton}>
          Back to Home
        </Link>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        a:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 212, 255, 0.5);
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
    justifyContent: 'center',
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
    padding: '20px',
    width: '100%',
    maxWidth: '600px',
    textAlign: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: '300px',
    height: 'auto',
    marginBottom: '40px',
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))',
  },
  errorCode: {
    fontSize: '120px',
    fontWeight: 800,
    color: '#00d4ff',
    marginBottom: '10px',
    textShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
    lineHeight: 1,
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '15px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '40px',
    lineHeight: 1.6,
  },
  homeButton: {
    display: 'inline-block',
    padding: '16px 50px',
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
  },
};

export default NotFound;