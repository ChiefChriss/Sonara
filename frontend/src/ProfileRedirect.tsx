import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ProfileRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const redirect = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        navigate('/login', { replace: true });
        return;
      }
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/api/auth/profile/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        navigate(`/@${data.username}`, { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    };
    redirect();
  }, [navigate]);

  return null;
};

export default ProfileRedirect;
