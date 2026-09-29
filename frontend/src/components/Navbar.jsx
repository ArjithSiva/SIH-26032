import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import UtilityBar from './UtilityBar.jsx';
import logo from '../assets/harvq-logo.svg';

const navLinkClass = ({ isActive }) =>
  `border-b-2 pb-1.5 transition-colors ${
    isActive ? 'border-primary text-primary' : 'border-transparent text-ink hover:border-primary hover:text-primary'
  }`;

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
      <NavLink to="/farmer/home" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.home')}</NavLink>
      <NavLink to="/farmer/book" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.bookSlot')}</NavLink>
      <NavLink to="/farmer/bookings" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.myBookings')}</NavLink>
      <NavLink to="/farmer/payments" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.payments')}</NavLink>
      <NavLink to="/farmer/complaint" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.reportIssue')}</NavLink>
      <NavLink to="/farmer/profile" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.profile')}</NavLink>
    </>
  );

  const guestLinks = (
    <>
      <NavLink to="/farmer/register" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.register')}</NavLink>
      <NavLink to="/centres/schedules" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.centres')}</NavLink>
      <NavLink
        to="/farmer/login"
        onClick={() => setMenuOpen(false)}
        className={({ isActive }) =>
          `rounded border px-4 py-1.5 text-center transition-colors ${
            isActive ? 'border-primary bg-primary text-white' : 'border-primary/40 text-primary hover:bg-primary-light'
          }`
        }
      >
        {t('nav.login')}
      </NavLink>
    </>
  );

  return (
    <header className="bg-surface">
      <UtilityBar />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <img src={logo} alt="" className="h-9 w-9" aria-hidden="true" />
          <span className="text-h3 text-primary">HarvQ</span>
        </Link>

        <button
          type="button"
          className="rounded p-1.5 text-ink hover:bg-primary-light md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={t('nav.menu')}
        >
          <span aria-hidden="true" className="text-xl">{menuOpen ? '✕' : '☰'}</span>
        </button>

        <nav className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 pt-3 text-p2 font-bold md:flex md:w-auto md:flex-row md:items-center md:gap-6 md:pt-0`}>
          <NavLink to="/about" className={navLinkClass} onClick={() => setMenuOpen(false)}>{t('nav.about')}</NavLink>
          {session?.role === 'farmer' ? farmerLinks : !session ? guestLinks : null}
          {session && (
            <>
              <span className="font-normal text-muted">{session.profile?.name || session.profile?.mobileNumber}</span>
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
