import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import NotificationSimulatorPanel from './components/NotificationSimulatorPanel.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import usePageTitle from './hooks/usePageTitle.js';
import { useAuth } from './context/AuthContext.jsx';

import Landing from './pages/Landing.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import IVRSimulator from './pages/IVRSimulator.jsx';
import CentreSchedules from './pages/CentreSchedules.jsx';

import FarmerRegister from './pages/farmer/Register.jsx';
import FarmerLogin from './pages/farmer/Login.jsx';
import FarmerHome from './pages/farmer/Home.jsx';
import BookSlot from './pages/farmer/BookSlot.jsx';
import MyBookings from './pages/farmer/Dashboard.jsx';
import PaymentStatus from './pages/farmer/PaymentStatus.jsx';
import ReportComplaint from './pages/farmer/ReportComplaint.jsx';
import TrackBooking from './pages/farmer/TrackBooking.jsx';
import FarmerProfile from './pages/farmer/Profile.jsx';

import OfficerLogin from './pages/officer/Login.jsx';
import OfficerDashboard from './pages/officer/Dashboard.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';

export default function App() {
  usePageTitle();
  const { session } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/centres/schedules" element={<CentreSchedules />} />

          <Route path="/farmer/register" element={<FarmerRegister />} />
          <Route path="/farmer/login" element={<FarmerLogin />} />
          <Route path="/farmer/home" element={<ProtectedRoute roles={['farmer']}><FarmerHome /></ProtectedRoute>} />
          <Route path="/farmer/book" element={<ProtectedRoute roles={['farmer']}><BookSlot /></ProtectedRoute>} />
          <Route path="/farmer/bookings" element={<ProtectedRoute roles={['farmer']}><MyBookings /></ProtectedRoute>} />
          <Route path="/farmer/payments" element={<ProtectedRoute roles={['farmer']}><PaymentStatus /></ProtectedRoute>} />
          <Route path="/farmer/complaint" element={<ProtectedRoute roles={['farmer']}><ReportComplaint /></ProtectedRoute>} />
          <Route path="/farmer/profile" element={<ProtectedRoute roles={['farmer']}><FarmerProfile /></ProtectedRoute>} />
          <Route path="/farmer/track/:token" element={<TrackBooking />} />

          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/officer/login" element={<OfficerLogin />} />
          <Route path="/officer/dashboard" element={<ProtectedRoute roles={['officer']}><OfficerDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

          <Route path="/ivr" element={<IVRSimulator />} />
        </Routes>
      </main>
      <Footer />
      <NotificationSimulatorPanel />
    </div>
  );
}
