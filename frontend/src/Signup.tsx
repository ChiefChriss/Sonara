import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import sonaraLogo from './assets/sonara_logo.svg';
import waveLeft from './assets/wave-left.svg';
import waveRight from './assets/wave-right.svg';

const Signup = () => {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Sign Up | Sonara';
  }, []);

  const handleSignup = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // Parse Django's error format
        const errorMessage = 
          data.username?.[0] || 
          data.email?.[0] || 
          data.password?.[0] || 
          data.error || 
          'Signup failed. Please try again.';
        throw new Error(errorMessage);
      }

      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setUsername(e.target.value);
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setConfirmPassword(e.target.value);
  };

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

        {/* Signup Form */}
        <form onSubmit={handleSignup} style={styles.form}>
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
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputWrapper}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputWrapper}>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.signupButton}>
            Sign Up
          </button>
        </form>

        {/* Error Message */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Links */}
        <p style={styles.loginText}>
          Already have an account? <Link to="/login" style={styles.loginLink}>Login</Link>
        </p>
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
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 212, 255, 0.5);
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
    maxWidth: '750px',
    height: 'auto',
    marginBottom: '40px',
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  inputWrapper: {
    width: '100%',
    maxWidth: '400px',
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
  signupButton: {
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
  loginText: {
    marginTop: '24px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
    fontStyle: 'italic',
  },
  loginLink: {
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'color 0.3s ease',
  },
};

export default Signup;
