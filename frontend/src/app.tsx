import { Routes, Route, Navigate } from 'react-router-dom';
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
import PlayerBar from './components/PlayerBar';


const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/home" element={<ListenerHome />} />
        <Route path="/listenerHome" element={<Navigate to="/home" replace />} />
        <Route path="/create" element={<Create />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/:type/:id" element={<ContentPage />} />
        <Route path="/workstation/:projectId?" element={<Workstation />} />
        <Route path="/:handle" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <PlayerBar />
    </>
  );
};

export default App;