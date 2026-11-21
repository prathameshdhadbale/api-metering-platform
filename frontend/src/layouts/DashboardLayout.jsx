import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Brand } from '../components/Ui.jsx';
import Icon from '../components/Icon.jsx';

const navigation = [
  { to: '/', label: 'Overview', icon: 'grid', end: true },
  { to: '/keys', label: 'API keys', icon: 'key' },
  { to: '/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/plans', label: 'Plans & quotas', icon: 'layers' },
  { to: '/docs', label: 'API guide', icon: 'book' }
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>
          <Icon name={item.icon}/><span>{item.label}</span>{item.to === '/keys' && <span className="nav-dot"/>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="environment-card"><span className="live-indicator"/><div><strong>API status</strong><small>Operational</small></div><span className="status-check"><Icon name="check" size={14}/></span></div>
        <div className="account-row"><span className="avatar">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</span><span className="account-copy"><strong>{user?.name || 'Developer'}</strong><small>{user?.email}</small></span><button className="icon-button logout-button" onClick={signOut} aria-label="Log out" title="Log out"><Icon name="logout"/></button></div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-sep">/</span><strong>API control room</strong></div><div className="topbar-meta"><span className="live-indicator"/> All systems normal <span className="topbar-divider"/><span className="topbar-avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</span></div></header>
      <main className="main-content"><Outlet/></main>
      <footer className="app-footer"><span>Meterline API control room</span><span>Usage updates as requests arrive</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label} className={({ isActive }) => `mobile-nav-link${isActive ? ' mobile-nav-active' : ''}`}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}
    </nav>
  </div>;
}
