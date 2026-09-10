import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TITLES = [
  { prefix: '/farmer/register', title: 'Farmer Registration' },
  { prefix: '/farmer/login', title: 'Farmer Login' },
  { prefix: '/farmer/home', title: 'Farmer Home' },
  { prefix: '/farmer/book', title: 'Book a Procurement Slot' },
  { prefix: '/farmer/bookings', title: 'Booking Details / History' },
  { prefix: '/farmer/payments', title: 'Payment Status' },
  { prefix: '/farmer/complaint', title: 'Report / Complaint' },
  { prefix: '/farmer/track', title: 'Track Booking' },
  { prefix: '/officer/login', title: 'Procurement Centre Login' },
  { prefix: '/officer/dashboard', title: 'Procurement Centre Dashboard' },
  { prefix: '/staff/login', title: 'State Admin Login' },
  { prefix: '/admin', title: 'State Admin Dashboard' },
  { prefix: '/centres/schedules', title: 'Procurement Centre Schedules' },
  { prefix: '/ivr', title: 'IVR Demo' },
];

const SITE_NAME = 'Kalanjiyam — Procurement Queue Service';

export default function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    const match = TITLES.find((t) => location.pathname.startsWith(t.prefix));
    document.title = match ? `${match.title} | ${SITE_NAME}` : SITE_NAME;
  }, [location.pathname]);
}
