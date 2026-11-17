import { NavLink, Route, Routes } from 'react-router';
import DashboardPage from './pages/DashboardPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>Trial Issue Log</h1>
        {/* NavLink adds the "active" class to the link of the current page. */}
        <nav className="app-nav">
          <NavLink to="/" end>
            Issues
          </NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<IssuesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
