import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * The QR encodes a URL back to this booking's live tracking page (rather
 * than a JSON blob) so any phone camera or a gate scanner app can open it
 * directly - the printed card next to it carries the human-readable
 * details (crop, estimated amount, slot) for a quick visual check without
 * scanning at all.
 */
export default function QRGatePass({ booking }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    const url = `${window.location.origin}/farmer/track/${booking.token}`;
    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [booking.token]);

  return (
    <div className="card mt-4 print:shadow-none">
      <div className="flex items-center justify-between">
        <h2 className="text-p2 font-semibold text-muted">Gate pass</h2>
        <button type="button" onClick={() => window.print()} className="btn-outline text-small">
          Print
        </button>
      </div>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[220px] w-[220px] flex-shrink-0 items-center justify-center rounded border border-border bg-white">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Booking QR code" width={220} height={220} />
          ) : (
            <span className="text-small text-muted">Generating QR...</span>
          )}
        </div>

        <div className="w-full space-y-1 text-p2">
          <p className="text-h3 text-primary">{booking.token}</p>
          <p><span className="text-muted">Farmer:</span> {booking.farmer?.name}</p>
          <p><span className="text-muted">Centre:</span> {booking.centre?.name}</p>
          <p><span className="text-muted">Date &amp; slot:</span> {booking.date} · {booking.startTime}–{booking.endTime}</p>
          <p><span className="text-muted">Crop:</span> {booking.crop || '—'}</p>
          <p>
            <span className="text-muted">Planned quantity:</span>{' '}
            {booking.plannedQuantity ? `${booking.plannedQuantity} ${booking.unit || 'unit'}${booking.plannedQuantity === 1 ? '' : 's'}` : '—'}
          </p>
          <p>
            <span className="text-muted">Estimated amount:</span>{' '}
            {booking.estimatedValue ? `₹${booking.estimatedValue}` : 'To be calculated at weighing'}
          </p>
        </div>
      </div>

      <p className="mt-3 text-small text-muted">
        Show this QR code at the centre gate. Scanning it opens this booking's live status page.
      </p>
    </div>
  );
}
