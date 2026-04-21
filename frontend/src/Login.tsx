import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import waveLeft from './assets/wave-left.svg';
import waveRight from './assets/wave-right.svg';
import LogoTransition from './LogoTransition';
import Footer from './components/Footer';
import { getApiBaseUrl } from './utils/apiBase';
import { fullBleedSafeArea } from './utils/safeArea';

const Login = () => {

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showTransition, setShowTransition] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Login | Sonara';
  }, []);

  const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error('Login failed. Please check your credentials.');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      
      // Show transition instead of navigating immediately
      setShowTransition(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
  };

  // Show transition screen after successful login
  if (showTransition) {
    return (
      <LogoTransition 
        playSound={true} 
        duration={1200}
        onComplete={() => navigate('/listenerHome')} 
      />
    );
  }

  return (
    <div style={{ ...styles.container, ...fullBleedSafeArea }}>
      {/* Background gradient overlay */}
      <div style={styles.backgroundOverlay}></div>

      {/* Wave decorations */}
      <img src={waveLeft} alt="" style={styles.waveLeft} />
      <img src={waveRight} alt="" style={styles.waveRight} />
      
      <div style={styles.content}>
        {/* Logo */}
        <img src={sonaraLogo} alt="Sonara" style={styles.logo} />

        {/* Login Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputWrapper}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={handleUsernameChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputWrapper}>
            <div style={styles.passwordContainer}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
                required
                style={{ ...styles.input, paddingRight: '52px' }}
              />
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeToggle}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" style={styles.loginButton}>
            Login
          </button>
        </form>

        {/* Error Message */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Links */}
        <Link to="/forgot-password" style={styles.forgotPassword}>Forgot Password?</Link>
        <p style={styles.signupText}>
          Don't have an account? <Link to="/signup" style={styles.signupLink}>Sign Up</Link>
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
        <Footer />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        input::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }
        
        input:focus {
          outline: none;
          border-color: #00d4ff;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0 1000px #1a1533 inset !important;
          box-shadow: 0 0 0 1000px #1a1533 inset !important;
          border-color: rgba(100, 150, 200, 0.3) !important;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #ffffff;
          cursor: text;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 212, 255, 0.5);
        }

        .eye-toggle:hover {
          transform: translateY(-50%) !important;
          box-shadow: none !important;
          opacity: 1 !important;
        }
        
        button:active {
          transform: translateY(0);
        }
        
        a:hover {
          color: #00d4ff !important;
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
    maxWidth: '1000px',
  },
  logo: {
    width: '100%',
    maxWidth: '700px',
    height: 'auto',
    marginBottom: '60px',
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  inputWrapper: {
    width: '100%',
    maxWidth: '400px',
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  eyeToggle: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s',
    opacity: 0.7,
    zIndex: 2,
  },
  input: {
    width: '100%',
    padding: '18px 24px',
    fontSize: '16px',
    fontFamily: "'Poppins', sans-serif",
    backgroundColor: 'rgba(30, 45, 80, 0.6)',
    border: '2px solid rgba(100, 150, 200, 0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    transition: 'all 0.3s ease',
  },
  loginButton: {
    marginTop: '20px',
    padding: '16px 80px',
    fontSize: '22px',
    fontWeight: 600,
    fontFamily: "'Poppins', sans-serif",
    background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
  },
  error: {
    marginTop: '16px',
    color: '#ff6b6b',
    fontSize: '14px',
    textAlign: 'center',
  },
  forgotPassword: {
    marginTop: '24px',
    color: 'rgba(255, 255, 255, 0.6)',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s ease',
  },
  signupText: {
    marginTop: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
    fontStyle: 'italic',
  },
  signupLink: {
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'color 0.3s ease',
  },
};

export default Login;
