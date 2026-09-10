import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/api';

const SocketContext = createContext(null);

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
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
