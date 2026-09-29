import { useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const CHANNEL_KEYS = {
  sms: 'notificationSimulator.channel.sms',
  whatsapp: 'notificationSimulator.channel.whatsapp',
  push: 'notificationSimulator.channel.push',
  ivr_voice: 'notificationSimulator.channel.ivrVoice',
};

export default function NotificationSimulatorPanel() {
  const { t } = useLanguage();
  const { feed } = useSocket();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h3 className="text-p2-medium">{t('notificationSimulator.panelTitle')}</h3>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label={t('common.close')}>
              ✕
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-3">
            {feed.length === 0 && (
              <p className="p-3 text-p2 text-muted">{t('notificationSimulator.empty')}</p>
            )}
            {feed.map((n) => (
              <div key={n._id} className="mb-2 rounded border border-border p-3 last:mb-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="badge bg-primary-light text-primary-dark">
                    {CHANNEL_KEYS[n.channel] ? t(CHANNEL_KEYS[n.channel]) : n.channel}
                  </span>
                  <span className="text-small text-muted">
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-p2 text-ink">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} className="btn-primary shadow-lg">
        {open ? t('notificationSimulator.hide') : t('notificationSimulator.button')}
        {feed.length > 0 && !open && (
          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-small text-ink">{feed.length}</span>
        )}
      </button>
    </div>
  );
}
