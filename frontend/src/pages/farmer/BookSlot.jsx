import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CentreMultiSelect from '../../components/CentreMultiSelect.jsx';

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function BookSlot() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const farmerId = session.profile._id;
  const preferredCentreIds = (session.profile.preferredCentres || []).map((c) => (typeof c === 'string' ? c : c._id));

  const [stage, setStage] = useState('date'); // date | crop | centre | bank | confirm
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 1: date
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');

  // Step 2: crop + quantity - crop list comes from the admin-configured
  // official rates, not from any one centre's own crop list, so the farmer
  // always sees every crop the state currently buys.
  const [allCentres, setAllCentres] = useState([]);
  const [cropRates, setCropRates] = useState([]);
  const [crop, setCrop] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');

  // Step 3: recommendation + candidate centres
  const [recommendation, setRecommendation] = useState(null);
  const [usedStatewideFallback, setUsedStatewideFallback] = useState(false);
  const [candidateCentreIds, setCandidateCentreIds] = useState(preferredCentreIds);
  const [showFindAnother, setShowFindAnother] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { centreId, slotId, centreName }
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);

  // Step 4: bank details
  const existingBank = session.profile.bankDetails || {};
  const [accountHolderName, setAccountHolderName] = useState(existingBank.accountHolderName || '');
  const [bankName, setBankName] = useState(existingBank.bankName || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState(existingBank.ifscCode || '');
  const hasSavedBank = Boolean(existingBank.accountNumber);

  useEffect(() => {
    api.get('/slots/upcoming-dates', { params: { days: 7 } }).then(({ data }) => setDates(data.dates));
    api.get('/admin/crop-rates').then(({ data }) => setCropRates(data));
    api.get('/centres').then(({ data }) => setAllCentres(data));
  }, []);

  const cropOptions = useMemo(() => cropRates.map((r) => r.crop), [cropRates]);
  const selectedCropRate = cropRates.find((r) => r.crop === crop);
  const unit = selectedCropRate?.unit || 'unit';
  const estimatedValue = selectedCropRate && plannedQuantity
    ? Number((Number(plannedQuantity) * selectedCropRate.ratePerUnit).toFixed(2))
    : null;

  const effectiveDate = useCustomDate ? customDate : date;

  async function loadRecommendations() {
    setError('');
    setLoadingRecommendation(true);
    setSelectedSlot(null);
    setUsedStatewideFallback(false);
    try {
      let { data } = await api.get('/centres/recommendations', {
        params: { centreIds: candidateCentreIds.join(','), date: effectiveDate, crop },
      });

      // None of the farmer's own centres take this crop - search statewide
      // instead of leaving them stuck.
      if (!data.recommended && (!data.alternatives || data.alternatives.length === 0)) {
        const fallback = await api.get('/centres/recommendations', { params: { date: effectiveDate, crop } });
        data = fallback.data;
        setUsedStatewideFallback(true);
      }

      setRecommendation(data);
      if (data.recommended?.bestSlot) {
        setSelectedSlot({
          centreId: data.recommended.centre._id,
          slotId: data.recommended.bestSlot._id,
          centreName: data.recommended.centre.name,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load recommendations');
    } finally {
      setLoadingRecommendation(false);
    }
  }

  function proceedToCentreStep() {
    setStage('centre');
    loadRecommendations();
  }

  function pickAlternative(alt) {
    if (!alt.bestSlot) return;
    setSelectedSlot({ centreId: alt.centre._id, slotId: alt.bestSlot._id, centreName: alt.centre.name });
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      const bankDetails = accountNumber
        ? { accountHolderName, bankName, accountNumber, ifscCode }
        : undefined;
      const { data: booking } = await api.post('/bookings', {
        farmerId,
        slotId: selectedSlot.slotId,
        crop,
        plannedQuantity: plannedQuantity ? Number(plannedQuantity) : undefined,
        bankDetails,
        channel: 'web',
      });
      navigate(`/farmer/track/${booking.token}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  const bankValid = accountHolderName && bankName && ifscCode && (
    hasSavedBank && !accountNumber ? true : (accountNumber && accountNumber === confirmAccountNumber)
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 animate-fade-in">
      <h1 className="text-h1">Book a procurement slot</h1>

      <div className="card mt-6 space-y-5">
        {error && <p className="text-p2 text-danger">{error}</p>}

        {stage === 'date' && (
          <div className="animate-slide-up">
            <label className="field-label">When are you bringing your crop?</label>
            {!useCustomDate && (
              <>
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDate(d)}
                      className={`rounded border px-3 py-1.5 text-p2 transition-colors ${
                        date === d ? 'border-primary bg-primary-light text-primary-dark' : 'border-border hover:border-primary'
                      }`}
                    >
                      {fmtDate(d)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setUseCustomDate(true)} className="mt-3 text-p2 text-primary underline">
                  Need a date further out? Pick a custom date (up to 30 days ahead)
                </button>
              </>
            )}
            {useCustomDate && (
              <div>
                <input
                  type="date"
                  className="field-input"
                  min={todayISO()}
                  max={maxDateISO()}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
                <button type="button" onClick={() => setUseCustomDate(false)} className="mt-2 block text-p2 text-primary underline">
                  Back to quick dates
                </button>
              </div>
            )}
            <button type="button" disabled={!effectiveDate} onClick={() => setStage('crop')} className="btn-primary mt-4 w-full">
              Continue
            </button>
          </div>
        )}

        {stage === 'crop' && (
          <div className="animate-slide-up space-y-4">
            <div>
              <label className="field-label">Crop you're bringing</label>
              <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)}>
                <option value="">Select crop</option>
                {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {cropOptions.length === 0 && (
                <p className="mt-1 text-small text-muted">No crops have been configured by the admin yet.</p>
              )}
            </div>
            <div>
              <label className="field-label">Quantity you plan to bring ({unit}s)</label>
              <input
                type="number"
                min="1"
                className="field-input"
                value={plannedQuantity}
                onChange={(e) => setPlannedQuantity(e.target.value)}
              />
            </div>
            {selectedCropRate && (
              <p className="rounded bg-primary-light px-3 py-2 text-p2 text-primary-dark">
                Government minimum price for {crop}: ₹{selectedCropRate.ratePerUnit}/{unit}
                {estimatedValue != null && <> · Estimated value: <strong>₹{estimatedValue}</strong></>}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('date')} className="btn-outline flex-1">Back</button>
              <button type="button" disabled={!crop} onClick={proceedToCentreStep} className="btn-primary flex-1">
                Find best centre & slot
              </button>
            </div>
          </div>
        )}

        {stage === 'centre' && (
          <div className="animate-slide-up space-y-4">
            {loadingRecommendation && <p className="text-p2 text-muted">Checking queues at centres that accept {crop}...</p>}

            {usedStatewideFallback && !loadingRecommendation && (
              <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
                None of your preferred centres currently accept {crop}, so here are other centres that do.
              </p>
            )}

            {recommendation?.recommended && (
              <div className="rounded border-2 border-primary bg-primary-light p-4">
                <p className="text-small font-semibold uppercase tracking-wide text-primary-dark">Recommended</p>
                <p className="mt-1 text-p1 font-semibold text-primary-dark">{recommendation.recommended.centre.name}</p>
                <p className="text-p2 text-primary-dark">
                  {recommendation.recommended.bestSlot
                    ? <>Slot {recommendation.recommended.bestSlot.startTime}–{recommendation.recommended.bestSlot.endTime} · {recommendation.recommended.bestSlot.bookedCount} already in queue</>
                    : 'No available slot on this date'}
                </p>
                {recommendation.recommended.bestSlot && (
                  <button
                    type="button"
                    onClick={() => pickAlternative(recommendation.recommended)}
                    className={`btn-primary mt-2 text-p2 ${selectedSlot?.slotId === recommendation.recommended.bestSlot._id ? 'ring-2 ring-accent' : ''}`}
                  >
                    {selectedSlot?.slotId === recommendation.recommended.bestSlot._id ? 'Selected' : 'Choose this'}
                  </button>
                )}
              </div>
            )}

            {recommendation?.alternatives?.length > 0 && (
              <div>
                <p className="field-label">{usedStatewideFallback ? 'Other centres' : 'Other preferred centres'}</p>
                <div className="space-y-2">
                  {recommendation.alternatives.map((alt) => (
                    <div key={alt.centre._id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                      <div>
                        <p className="text-p2 font-medium">{alt.centre.name}</p>
                        <p className="text-small text-muted">
                          {alt.bestSlot ? `${alt.bestSlot.startTime}–${alt.bestSlot.endTime} · ${alt.bestSlot.bookedCount} in queue` : 'No slot available'}
                        </p>
                      </div>
                      {alt.bestSlot && (
                        <button
                          type="button"
                          onClick={() => pickAlternative(alt)}
                          className={`btn-outline text-small ${selectedSlot?.slotId === alt.bestSlot._id ? 'border-primary text-primary' : ''}`}
                        >
                          {selectedSlot?.slotId === alt.bestSlot._id ? 'Selected' : 'Choose'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={() => setShowFindAnother((v) => !v)} className="text-p2 text-primary underline">
              {showFindAnother ? 'Hide' : 'Find another centre'}
            </button>
            {showFindAnother && (
              <div className="rounded border border-border p-3">
                <CentreMultiSelect centres={allCentres} selectedIds={candidateCentreIds} onChange={setCandidateCentreIds} />
                <button type="button" onClick={loadRecommendations} className="btn-outline mt-3 w-full text-p2">
                  Refresh recommendations
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('crop')} className="btn-outline flex-1">Back</button>
              <button type="button" disabled={!selectedSlot} onClick={() => setStage('bank')} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </div>
        )}

        {stage === 'bank' && (
          <div className="animate-slide-up space-y-4">
            <div>
              <h2 className="text-p1 font-semibold">Bank &amp; Payment Details</h2>
              <p className="text-p2 text-muted">Where should we transfer your payment?</p>
            </div>
            <div>
              <label className="field-label">Account Holder Name</label>
              <input placeholder="e.g. Ram Kumar" className="field-input" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Bank Name</label>
              <input placeholder="e.g. SBI" className="field-input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            {hasSavedBank && !accountNumber && (
              <p className="rounded bg-primary-light px-3 py-2 text-p2 text-primary-dark">
                Using saved account ending in {existingBank.accountNumber ? existingBank.accountNumber.slice(-4) : '----'}.
                Enter a new account number below to change it.
              </p>
            )}
            <div>
              <label className="field-label">Account Number</label>
              <input inputMode="numeric" className="field-input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Confirm Account Number</label>
              <input inputMode="numeric" className="field-input" value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value)} />
              {accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                <p className="mt-1 text-small text-danger">Account numbers do not match.</p>
              )}
            </div>
            <div>
              <label className="field-label">IFSC Code</label>
              <input placeholder="e.g. SBIN0001234" className="field-input uppercase" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('centre')} className="btn-outline flex-1">Back</button>
              <button type="button" disabled={!bankValid} onClick={() => setStage('confirm')} className="btn-primary flex-1">
                Continue
              </button>
            </div>
          </div>
        )}

        {stage === 'confirm' && selectedSlot && (
          <div className="animate-slide-up space-y-4">
            <div className="rounded border border-border p-4">
              <p className="text-p2 text-muted">Please confirm your booking</p>
              <p className="mt-1 text-p1 font-semibold">{selectedSlot.centreName}</p>
              <p className="text-p2">{effectiveDate} · {crop} · {plannedQuantity || '—'} {unit}(s)</p>
              {estimatedValue != null && <p className="text-p2">Estimated value: ₹{estimatedValue}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('bank')} className="btn-outline flex-1">Back</button>
              <button type="button" disabled={submitting} onClick={handleConfirm} className="btn-primary flex-1">
                {submitting ? 'Booking...' : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
