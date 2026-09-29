import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import CentreMultiSelect from '../../components/CentreMultiSelect.jsx';
import { centreMapUrl } from '../../utils/centreMap.js';
import { MotionDiv, sectionMotion } from '../../components/motion.js';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function BookSlot() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const farmerId = session.profile._id;
  const preferredCentreIds = (session.profile.preferredCentres || []).map((c) => (typeof c === 'string' ? c : c._id));

  const [stage, setStage] = useState('date'); // date | crop | centre | bank | confirm
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 1: date
  const [date, setDate] = useState('');

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
    api.get('/admin/crop-rates').then(({ data }) => setCropRates(data));
    api.get('/centres').then(({ data }) => setAllCentres(data));
  }, []);

  const cropOptions = useMemo(() => cropRates.map((r) => r.crop), [cropRates]);
  const selectedCropRate = cropRates.find((r) => r.crop === crop);
  const unit = selectedCropRate?.unit || t('qrGatePass.unitFallback');
  const estimatedValue = selectedCropRate && plannedQuantity
    ? Number((Number(plannedQuantity) * selectedCropRate.ratePerUnit).toFixed(2))
    : null;

  async function loadRecommendations() {
    setError('');
    setLoadingRecommendation(true);
    setSelectedSlot(null);
    setUsedStatewideFallback(false);
    try {
      let { data } = await api.get('/centres/recommendations', {
        params: { centreIds: candidateCentreIds.join(','), date, crop },
      });

      // None of the farmer's own centres take this crop - search statewide
      // instead of leaving them stuck.
      if (!data.recommended && (!data.alternatives || data.alternatives.length === 0)) {
        const fallback = await api.get('/centres/recommendations', { params: { date, crop } });
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
      setError(err.response?.data?.message || t('bookSlot.error.recommendationsFailed'));
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
      setError(err.response?.data?.message || t('bookSlot.error.bookingFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const bankValid = accountHolderName && bankName && ifscCode && (
    hasSavedBank && !accountNumber ? true : (accountNumber && accountNumber === confirmAccountNumber)
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 animate-fade-in">
      <h1 className="text-h1">{t('bookSlot.title')}</h1>

      <MotionDiv className="card mt-6 space-y-5" {...sectionMotion}>
        {error && <p className="text-p2 text-danger">{error}</p>}

        {stage === 'date' && (
          <div className="animate-slide-up">
            <label className="field-label">{t('bookSlot.date.label')}</label>
            <input
              type="date"
              className="field-input"
              min={todayISO()}
              max={maxDateISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button type="button" disabled={!date} onClick={() => setStage('crop')} className="btn-primary mt-4 w-full">
              {t('common.continue')}
            </button>
          </div>
        )}

        {stage === 'crop' && (
          <div className="animate-slide-up space-y-4">
            <div>
              <label className="field-label">{t('bookSlot.crop.label')}</label>
              <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)}>
                <option value="">{t('bookSlot.crop.selectPlaceholder')}</option>
                {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {cropOptions.length === 0 && (
                <p className="mt-1 text-small text-muted">{t('bookSlot.crop.noneConfigured')}</p>
              )}
            </div>
            <div>
              <label className="field-label">{t('bookSlot.crop.quantityLabel')} ({unit}s)</label>
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
                {t('bookSlot.crop.minimumPrice')} {crop}: ₹{selectedCropRate.ratePerUnit}/{unit}
                {estimatedValue != null && <> · {t('bookSlot.crop.estimatedValue')}: <strong>₹{estimatedValue}</strong></>}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('date')} className="btn-outline flex-1">{t('common.back')}</button>
              <button type="button" disabled={!crop} onClick={proceedToCentreStep} className="btn-primary flex-1">
                {t('bookSlot.crop.findCentre')}
              </button>
            </div>
          </div>
        )}

        {stage === 'centre' && (
          <div className="animate-slide-up space-y-4">
            {loadingRecommendation && <p className="text-p2 text-muted">{t('bookSlot.centre.checking')} {crop}...</p>}

            {usedStatewideFallback && !loadingRecommendation && (
              <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
                {t('bookSlot.centre.statewideFallback')} {crop}.
              </p>
            )}

            {recommendation?.recommended && (
              <div className="rounded border-2 border-primary bg-primary-light p-4">
                <p className="text-small font-semibold uppercase tracking-wide text-primary-dark">{t('bookSlot.centre.recommended')}</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="text-p1 font-semibold text-primary-dark">{recommendation.recommended.centre.name}</p>
                  {centreMapUrl(recommendation.recommended.centre) && (
                    <a href={centreMapUrl(recommendation.recommended.centre)} target="_blank" rel="noreferrer" className="shrink-0 whitespace-nowrap text-small font-bold text-primary-dark underline">
                      📍 {t('common.viewOnMap')}
                    </a>
                  )}
                </div>
                <p className="text-p2 text-primary-dark">
                  {recommendation.recommended.bestSlot
                    ? <>{t('bookSlot.centre.slotLabel')} {recommendation.recommended.bestSlot.startTime}–{recommendation.recommended.bestSlot.endTime} · {recommendation.recommended.bestSlot.bookedCount} {t('bookSlot.centre.alreadyInQueue')}</>
                    : t('bookSlot.centre.noSlotAvailable')}
                </p>
                {recommendation.recommended.bestSlot && (
                  <button
                    type="button"
                    onClick={() => pickAlternative(recommendation.recommended)}
                    className={`btn-primary mt-2 text-p2 ${selectedSlot?.slotId === recommendation.recommended.bestSlot._id ? 'ring-2 ring-accent' : ''}`}
                  >
                    {selectedSlot?.slotId === recommendation.recommended.bestSlot._id ? t('bookSlot.centre.selected') : t('bookSlot.centre.chooseThis')}
                  </button>
                )}
              </div>
            )}

            {recommendation?.alternatives?.length > 0 && (
              <div>
                <p className="field-label">{usedStatewideFallback ? t('bookSlot.centre.otherCentres') : t('bookSlot.centre.otherPreferredCentres')}</p>
                <div className="space-y-2">
                  {recommendation.alternatives.map((alt) => (
                    <div key={alt.centre._id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-p2 font-medium">{alt.centre.name}</p>
                          {centreMapUrl(alt.centre) && (
                            <a href={centreMapUrl(alt.centre)} target="_blank" rel="noreferrer" className="text-small text-primary underline">
                              📍 {t('common.viewOnMap')}
                            </a>
                          )}
                        </div>
                        <p className="text-small text-muted">
                          {alt.bestSlot ? `${alt.bestSlot.startTime}–${alt.bestSlot.endTime} · ${alt.bestSlot.bookedCount} ${t('bookSlot.centre.inQueue')}` : t('bookSlot.centre.noSlotAvailable')}
                        </p>
                      </div>
                      {alt.bestSlot && (
                        <button
                          type="button"
                          onClick={() => pickAlternative(alt)}
                          className={`btn-outline text-small ${selectedSlot?.slotId === alt.bestSlot._id ? 'border-primary text-primary' : ''}`}
                        >
                          {selectedSlot?.slotId === alt.bestSlot._id ? t('bookSlot.centre.selected') : t('bookSlot.centre.choose')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={() => setShowFindAnother((v) => !v)} className="text-p2 text-primary underline">
              {showFindAnother ? t('common.hide') : t('bookSlot.centre.findAnother')}
            </button>
            {showFindAnother && (
              <div className="rounded border border-border p-3">
                <CentreMultiSelect centres={allCentres} selectedIds={candidateCentreIds} onChange={setCandidateCentreIds} />
                <button type="button" onClick={loadRecommendations} className="btn-outline mt-3 w-full text-p2">
                  {t('bookSlot.centre.refresh')}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('crop')} className="btn-outline flex-1">{t('common.back')}</button>
              <button type="button" disabled={!selectedSlot} onClick={() => setStage('bank')} className="btn-primary flex-1">
                {t('common.continue')}
              </button>
            </div>
          </div>
        )}

        {stage === 'bank' && (
          <div className="animate-slide-up space-y-4">
            <div>
              <h2 className="text-p1 font-semibold">{t('bookSlot.bank.heading')}</h2>
              <p className="text-p2 text-muted">{t('bookSlot.bank.subtitle')}</p>
            </div>
            <div>
              <label className="field-label">{t('bookSlot.bank.accountHolderName')}</label>
              <input placeholder={t('bookSlot.bank.accountHolderPlaceholder')} className="field-input" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t('bookSlot.bank.bankName')}</label>
              <input placeholder={t('bookSlot.bank.bankNamePlaceholder')} className="field-input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            {hasSavedBank && !accountNumber && (
              <p className="rounded bg-primary-light px-3 py-2 text-p2 text-primary-dark">
                {t('bookSlot.bank.usingSaved')} {existingBank.accountNumber ? existingBank.accountNumber.slice(-4) : '----'}. {t('bookSlot.bank.enterNewToChange')}
              </p>
            )}
            <div>
              <label className="field-label">{t('bookSlot.bank.accountNumber')}</label>
              <input inputMode="numeric" className="field-input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t('bookSlot.bank.confirmAccountNumber')}</label>
              <input inputMode="numeric" className="field-input" value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value)} />
              {accountNumber && confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                <p className="mt-1 text-small text-danger">{t('bookSlot.bank.mismatch')}</p>
              )}
            </div>
            <div>
              <label className="field-label">{t('bookSlot.bank.ifsc')}</label>
              <input placeholder="e.g. SBIN0001234" className="field-input uppercase" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('centre')} className="btn-outline flex-1">{t('common.back')}</button>
              <button type="button" disabled={!bankValid} onClick={() => setStage('confirm')} className="btn-primary flex-1">
                {t('common.continue')}
              </button>
            </div>
          </div>
        )}

        {stage === 'confirm' && selectedSlot && (
          <div className="animate-slide-up space-y-4">
            <div className="rounded border border-border p-4">
              <p className="text-p2 text-muted">{t('bookSlot.confirm.pleaseConfirm')}</p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-p1 font-semibold">{selectedSlot.centreName}</p>
                {centreMapUrl(allCentres.find((c) => c._id === selectedSlot.centreId)) && (
                  <a
                    href={centreMapUrl(allCentres.find((c) => c._id === selectedSlot.centreId))}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 whitespace-nowrap text-small font-bold text-primary underline"
                  >
                    📍 {t('common.viewOnMap')}
                  </a>
                )}
              </div>
              <p className="text-p2">{date} · {crop} · {plannedQuantity || '—'} {unit}(s)</p>
              {estimatedValue != null && <p className="text-p2">{t('bookSlot.crop.estimatedValue')}: ₹{estimatedValue}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStage('bank')} className="btn-outline flex-1">{t('common.back')}</button>
              <button type="button" disabled={submitting} onClick={handleConfirm} className="btn-primary flex-1">
                {submitting ? t('bookSlot.confirm.booking') : t('bookSlot.confirm.confirmBooking')}
              </button>
            </div>
          </div>
        )}
      </MotionDiv>
    </div>
  );
}
