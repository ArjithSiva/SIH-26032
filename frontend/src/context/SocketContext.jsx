import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/api';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
  const { session } = useAuth();
  const [socket, setSocket] = useState(null);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    s.on('notification:feed', (notification) => {
      setFeed((prev) => [notification, ...prev].slice(0, 30));
    });

    // Only expose the socket to consumers once it exists, so pages that
    // join a room in their own effect (depending on `socket`) don't race
    // against connection setup and silently no-op.
    setSocket(s);

    return () => s.disconnect();
  }, []);

  // Previously the farmer/centre room was only ever joined at the exact
  // moment of the login API call succeeding (see Login.jsx). Since the
  // session itself is restored from localStorage on every page load
  // without re-running that login code, a simple page refresh silently
  // left the socket connected but in no room at all - notifications and
  // any 'queue:update' broadcasts would then go nowhere. Re-joining here,
  // keyed off the persisted session and re-run on every (re)connect, means
  // a refresh or a dropped/restored connection both recover correctly.
  useEffect(() => {
    if (!socket || !session) return;

    const rejoin = () => {
      if (session.role === 'farmer' && session.profile?._id) {
        socket.emit('join:farmer', session.profile._id);
      } else if (session.role === 'officer' && session.profile?.centre) {
        socket.emit('join:centre', session.profile.centre);
      } else if (session.role === 'admin') {
        socket.emit('join:admin');
      }
    };

    rejoin();
    socket.on('connect', rejoin);
    return () => socket.off('connect', rejoin);
  }, [socket, session]);

  const joinFarmerRoom = (farmerId) => socket?.emit('join:farmer', farmerId);
  const joinCentreRoom = (centreId) => socket?.emit('join:centre', centreId);

  return (
    <SocketContext.Provider value={{ socket, feed, joinFarmerRoom, joinCentreRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
