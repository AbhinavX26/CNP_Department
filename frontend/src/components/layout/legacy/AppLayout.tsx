import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState, useEffect } from 'react';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '18px', color: 'var(--primary)' }}>
          <div style={{ width: '10px', height: '10px', background: 'var(--accent)', borderRadius: '50%' }}></div>
          CNP Portal
        </div>
        <button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          ☰
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      <div className={`sidebar-container ${mobileMenuOpen ? 'open' : ''}`}>
        <Sidebar />
      </div>

      <div className="main-wrapper">
        <Header />
        <main className="main-content" id="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
