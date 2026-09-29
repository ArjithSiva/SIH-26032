import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext.jsx';
import { MotionDiv } from './motion.js';

/**
 * The QR encodes a URL back to this booking's live tracking page (rather
 * than a JSON blob) so any phone camera or a gate scanner app can open it
 * directly - the printed card next to it carries the human-readable
 * details (crop, estimated amount, slot) for a quick visual check without
 * scanning at all.
 */
export default function QRGatePass({ booking }) {
  const { t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    const url = `${window.location.origin}/farmer/track/${booking.token}`;
    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [booking.token]);

  return (
    // initial/animate (not whileInView) - this card must be reliably fully
    // visible for window.print() below, so its entrance can't depend on an
    // IntersectionObserver actually firing before the user hits print.
    <MotionDiv
      className="card mt-4 print:shadow-none"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-p2 font-semibold text-muted">{t('qrGatePass.title')}</h2>
        <button type="button" onClick={() => window.print()} className="btn-outline text-small">
          {t('qrGatePass.print')}
        </button>
      </div>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[220px] w-[220px] flex-shrink-0 items-center justify-center rounded border border-border bg-white">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={t('qrGatePass.qrAlt')} width={220} height={220} />
          ) : (
            <span className="text-small text-muted">{t('qrGatePass.generating')}</span>
          )}
        </div>

        <div className="w-full space-y-1 text-p2">
          <p className="text-h3 text-primary">{booking.token}</p>
          <p><span className="text-muted">{t('qrGatePass.farmer')}:</span> {booking.farmer?.name}</p>
          <p><span className="text-muted">{t('qrGatePass.centre')}:</span> {booking.centre?.name}</p>
          <p><span className="text-muted">{t('qrGatePass.dateAndSlot')}:</span> {booking.date} · {booking.startTime}–{booking.endTime}</p>
          <p><span className="text-muted">{t('qrGatePass.crop')}:</span> {booking.crop || '—'}</p>
          <p>
            <span className="text-muted">{t('qrGatePass.plannedQuantity')}:</span>{' '}
            {booking.plannedQuantity ? `${booking.plannedQuantity} ${booking.unit || t('qrGatePass.unitFallback')}${booking.plannedQuantity === 1 ? '' : 's'}` : '—'}
          </p>
          <p>
            <span className="text-muted">{t('qrGatePass.estimatedAmount')}:</span>{' '}
            {booking.estimatedValue ? `₹${booking.estimatedValue}` : t('qrGatePass.toBeCalculated')}
          </p>
        </div>
      </div>

      <p className="mt-3 text-small text-muted">{t('qrGatePass.caption')}</p>
    </MotionDiv>
  );
}
