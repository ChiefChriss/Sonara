import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './Login';
import Signup from './Signup';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import ProfilePage from './ProfilePage';
import ProfileRedirect from './ProfileRedirect';
import ListenerHome from './ListenerHome';
import NotFound from './NotFound';
import Create from './workstation/Create';
import Workstation from './workstation/Workstation';
import SearchPage from './SearchPage';
import ExplorePage from './ExplorePage';
import LibraryPage from './LibraryPage';
import ContentPage from './ContentPage';
import NotificationsPage from './NotificationsPage';
import TermsOfService from './Terms-of-Service';
import PlayerBar from './components/PlayerBar';
import TopBar from './components/TopBar';
import Footer from './components/Footer';
import MobileNav from './components/MobileNav';
import Marketplace from './Marketplace';
import Revenue from './Revenue';
import { useIsMobile } from './hooks/useIsMobile';
import { usePlayerStore } from './stores/playerStore';

const HIDDEN_TOPBAR_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/', '/terms-of-service', '/revenue'];

const App = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (location.pathname === '/create' || location.pathname.startsWith('/workstation')) {
      usePlayerStore.getState().stop();
    }
  }, [location.pathname]);

  const shouldShowTopBar =
    !HIDDEN_TOPBAR_ROUTES.includes(location.pathname) &&
    !location.pathname.startsWith('/workstation');
  const shouldShowFooter =
    !location.pathname.startsWith('/workstation') &&
    location.pathname !== '/create';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div style={{ flex: 1 }}>
        {shouldShowTopBar && <TopBar />}
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<ProfileRedirect />} />
          <Route path="/home" element={<ListenerHome />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/listenerHome" element={<Navigate to="/home" replace />} />
          <Route path="/create" element={<Create />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/:type/:id" element={<ContentPage />} />
          <Route path="/workstation/:projectId?" element={<Workstation />} />
          <Route path="/:handle" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {/* {shouldShowFooter && <Footer />} */}
      <PlayerBar />
      {isMobile && <MobileNav />}
    </div>
  );
};

export default App;