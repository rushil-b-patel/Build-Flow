import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import type { GitHubUser } from './types';
import Navbar from './Navbar';
import HomePage from './HomePage';
import Dashboard from './Dashboard';
import AuthCallback from './AuthCallback';
import './App.css';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<GitHubUser | null>(() => {
    try {
      const stored = localStorage.getItem('bf_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onStorage = () => {
      try {
        const stored = localStorage.getItem('bf_user');
        setUser(stored ? JSON.parse(stored) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const location = useLocation();
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bf_user');
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('bf_token');
    localStorage.removeItem('bf_user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen">
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </div>
  )
}

export default App;
