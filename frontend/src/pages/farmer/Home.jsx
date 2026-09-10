import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const LINKS = [
  {
    to: '/farmer/book',
    title: 'Slot Booking',
    description: 'Pick a date and crop, and book your procurement slot.',
  },
  {
    to: '/farmer/bookings',
    title: 'Booking Details / History',
    description: 'Your current token, queue status, and past bookings.',
  },
  {
    to: '/farmer/payments',
    title: 'Payment Status',
    description: 'Track pending, processing and completed payments.',
  },
  {
    to: '/centres/schedules',
    title: 'Procurement Centre Schedules',
    description: 'Timings, working days and crops accepted at every centre.',
  },
  {
    to: '/farmer/complaint',
    title: 'Report / Complaint',
    description: 'Let us know about an issue at a procurement centre.',
  },
];

export default function FarmerHome() {
  const { session } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-h1">Welcome, {session?.profile?.name}</h1>
      <p className="mt-1 text-p2 text-muted">What would you like to do?</p>

      <div className="mt-6 space-y-4">
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="card block hover:border-primary">
            <p className="text-p1 font-semibold text-primary">{link.title}</p>
            <p className="mt-1 text-p2 text-muted">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
