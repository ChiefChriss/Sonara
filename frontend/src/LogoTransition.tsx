import { useEffect, useRef } from 'react';
import animatedLogo from './assets/sonara_logo_animated.webm';
import loginSound from './assets/loginSound1.mp3';

let audio = new Audio(loginSound);

interface TransitionProps {
  onComplete: () => void;
  playSound?: boolean;
}

const LogoTransition = ({ onComplete, playSound = false }: TransitionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
      if (playSound) {
          audio.volume = 0.3;
          audio.play().catch(() => console.log('Audio autoplay blocked'));
        }
  }, [playSound]);

  const handleVideoEnd = () => {
    onComplete();
  };

  return (
    <div style={styles.overlay}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        style={styles.logo}
      >
        <source src={animatedLogo} type="video/webm" />
      </video>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: '400px',
    maxWidth: '80%',
    height: 'auto',
    filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.3))',
  },
};

export default LogoTransition;