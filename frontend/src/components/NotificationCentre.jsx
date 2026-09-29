import { useEffect, useState, useCallback } from 'react';
import api from '../api/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// Generic "my notifications" list + Clear button, reused as-is for the
// farmer's, officer's and admin's own notification centre - each caller
// just points it at a different fetch/clear URL. Real-time updates arrive
// via the 'notification:new' socket event, which notificationSimulator.js
// already routes to the right room (farmer:<id> / centre:<id> / admin)
// server-side, so this component doesn't need to know which room it's in.
export default function NotificationCentre({ fetchUrl, clearUrl, titleKey = 'notificationCentre.title', emptyKey = 'notificationCentre.empty' }) {
  const { t } = useLanguage();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get(fetchUrl)
      .then(({ data }) => setNotifications(data))
      .catch((err) => setError(err.response?.data?.message || t('notificationCentre.error.loadFailed')))
      .finally(() => setLoading(false));
  }, [fetchUrl, t]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (notification) => setNotifications((prev) => [notification, ...prev].slice(0, 50));
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [socket]);

  async function handleClear() {
    if (!window.confirm(t('notificationCentre.clearConfirm'))) return;
    setClearing(true);
    setError('');
    try {
      await api.delete(clearUrl);
      setNotifications([]);
    } catch (err) {
      setError(err.response?.data?.message || t('notificationCentre.error.clearFailed'));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-p1 font-semibold text-primary">{t(titleKey)}</h2>
        {notifications.length > 0 && (
          <button type="button" disabled={clearing} onClick={handleClear} className="text-small text-danger underline">
            {clearing ? t('notificationCentre.clearing') : t('notificationCentre.clear')}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-small text-danger">{error}</p>}

      {loading ? (
        <p className="mt-3 text-p2 text-muted">{t('common.loading')}</p>
      ) : notifications.length === 0 ? (
        <p className="mt-3 text-p2 text-muted">{t(emptyKey)}</p>
      ) : (
        <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
          {notifications.map((n) => (
            <div key={n._id} className="rounded border border-border p-3">
              <p className="mb-1 text-small text-muted">{new Date(n.createdAt).toLocaleString()}</p>
              <p className="text-p2 text-ink">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
