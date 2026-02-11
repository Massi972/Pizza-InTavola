
import React, { useState, useEffect } from 'react';
import { AuthState, User, Role, Day, Order, DayStatus } from './types';
import { db } from './services/db';
import LoginView from './views/Login';
import WorkerDashboard from './views/WorkerDashboard';
import AdminDashboard from './views/AdminDashboard';
import AdminPizzas from './views/AdminPizzas';
import AdminUsers from './views/AdminUsers';
import AdminHistory from './views/AdminHistory';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('pizzastaff_auth');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });

  const [view, setView] = useState<'dashboard' | 'pizzas' | 'users' | 'history'>('dashboard');

  useEffect(() => {
    localStorage.setItem('pizzastaff_auth', JSON.stringify(auth));
  }, [auth]);

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    setView('dashboard');
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <LoginView onLogin={handleLogin} />;
  }

  // RBAC Navigation
  const renderView = () => {
    if (auth.user?.role === Role.ADMIN || auth.user?.role === Role.SUPERVISOR) {
      switch (view) {
        case 'pizzas': return <AdminPizzas onBack={() => setView('dashboard')} />;
        case 'users': return <AdminUsers onBack={() => setView('dashboard')} />;
        case 'history': return <AdminHistory onBack={() => setView('dashboard')} />;
        default: return <AdminDashboard 
          user={auth.user!} 
          onLogout={handleLogout} 
          onNavigate={(v: any) => setView(v)} 
        />;
      }
    }

    return <WorkerDashboard user={auth.user!} onLogout={handleLogout} />;
  };

  return (
    <div className="bg-[#F2F2F7] min-h-screen">
      {renderView()}
    </div>
  );
};

export default App;
