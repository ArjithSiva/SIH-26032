import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import GovHeader from './GovHeader.jsx';

// Procurement-centre and admin sign-in are intentionally NOT linked here -
// they're only reachable directly at /officer/login and /staff/login. This
// nav (and the homepage) is farmer-facing only.
export default function Navbar() {
  const { session, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  const farmerLinks = (
    <>
      <Link to="/farmer/home" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.home')}</Link>
      <Link to="/farmer/book" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.bookSlot')}</Link>
      <Link to="/farmer/bookings" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.myBookings')}</Link>
      <Link to="/farmer/payments" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>Payments</Link>
      <Link to="/farmer/complaint" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.reportIssue')}</Link>
      <Link to="/farmer/profile" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.profile')}</Link>
    </>
  );

  const guestLinks = (
    <>
      <Link to="/farmer/login" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.login')}</Link>
      <Link to="/farmer/register" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.register')}</Link>
      <Link to="/centres/schedules" className="text-ink hover:text-primary" onClick={() => setMenuOpen(false)}>{t('nav.centres')}</Link>
    </>
  );

  return (
    <header className="border-b border-border bg-surface">
      <GovHeader />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-3">
        <Link to="/" className="text-h3 text-primary" onClick={() => setMenuOpen(false)}>
          Kalanjiyam
        </Link>

        <button
          type="button"
          className="rounded p-1.5 text-ink hover:bg-primary-light md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <span aria-hidden="true" className="text-xl">{menuOpen ? '✕' : '☰'}</span>
        </button>

        <nav className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 pt-3 text-p2 md:flex md:w-auto md:flex-row md:items-center md:gap-4 md:pt-0`}>
          {session?.role === 'farmer' ? farmerLinks : !session ? guestLinks : null}
          {session && (
            <>
              <span className="text-muted">{session.profile?.name || session.profile?.mobileNumber}</span>
              <button onClick={handleLogout} className="btn-outline px-3 py-1 text-p2">
                {t('nav.logout')}
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
