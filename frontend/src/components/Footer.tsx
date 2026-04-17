import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <span style={styles.copy}>© {new Date().getFullYear()} Sonara</span>
        <div style={styles.links}>
          <Link to="/terms-of-service" style={styles.link}>Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  footer: {
    width: '100%',
    marginTop: 'auto',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0f0f1a',
    fontFamily: "'Poppins', sans-serif",
  },
  inner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
  },
  copy: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  links: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  link: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.45)',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
  },
};

export default Footer;
