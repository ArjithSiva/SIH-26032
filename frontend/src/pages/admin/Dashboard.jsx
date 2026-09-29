import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import NotificationCentre from '../../components/NotificationCentre.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { MotionDiv, MotionForm, MotionButton, cardMotion, cardMotionTap, sectionMotion } from '../../components/motion.js';

const TAB_KEYS = [
  { key: 'Overview', label: 'adminDashboard.tab.overview' },
  { key: 'Centres', label: 'adminDashboard.tab.centres' },
  { key: 'Crop rates', label: 'adminDashboard.tab.cropRates' },
  { key: 'Complaints', label: 'adminDashboard.tab.complaints' },
  { key: 'Staff', label: 'adminDashboard.tab.staff' },
  { key: 'Payment requests', label: 'adminDashboard.tab.paymentRequests' },
  { key: 'Notifications', label: 'adminDashboard.tab.notifications' },
];
const ALL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_KEYS = {
  MO: 'day.mon', TU: 'day.tue', WE: 'day.wed', TH: 'day.thu',
  FR: 'day.fri', SA: 'day.sat', SU: 'day.sun',
};
const TOTALS_KEYS = {
  totalCentres: 'adminDashboard.overview.totalCentres',
  totalBooked: 'adminDashboard.overview.totalBooked',
  waiting: 'adminDashboard.overview.waiting',
  completed: 'adminDashboard.overview.completed',
  cancelled: 'adminDashboard.overview.cancelled',
};
const STATUS_KEYS = {
  waiting: 'status.waiting',
  processing: 'status.processing',
  completed: 'status.completed',
  absent: 'status.absent',
  cancelled: 'status.cancelled',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Overview ----------------

function OverviewTab({ t }) {
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [date, setDate] = useState(todayISO());
  const [overview, setOverview] = useState(null);
  const [expandedCentre, setExpandedCentre] = useState(null);
  const [centreQueue, setCentreQueue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/centres/districts').then(({ data }) => setDistricts(data));
  }, []);

  const load = () => {
    api
      .get('/admin/stats-overview', { params: { district: district || undefined, date } })
      .then(({ data }) => setOverview(data))
      .catch((err) => setError(err.response?.data?.message || t('adminDashboard.overview.loadFailed')));
  };

  useEffect(() => { load(); }, [district, date]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(centreId) {
    if (expandedCentre === centreId) {
      setExpandedCentre(null);
      setCentreQueue(null);
      return;
    }
    setExpandedCentre(centreId);
    api.get(`/queue/centre/${centreId}/date/${date}`).then(({ data }) => setCentreQueue(data));
  }

  const allDistrictsLabel = t('centreSchedules.allDistricts');

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <SearchableSelect
            label={t('adminDashboard.overview.filterByDistrict')}
            options={[allDistrictsLabel, ...districts]}
            value={district || allDistrictsLabel}
            onChange={(v) => setDistrict(v === allDistrictsLabel ? '' : v)}
          />
        </div>
        <div>
          <label className="field-label">{t('adminDashboard.overview.date')}</label>
          <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-p2 text-danger">{error}</p>}

      {overview && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(overview.totals).map(([key, value], i) => (
              <MotionDiv key={key} className="card text-center" {...cardMotion} transition={{ ...cardMotion.transition, delay: i * 0.05 }}>
                <p className="text-h1 text-primary">{value}</p>
                <p className="text-small capitalize text-muted">{TOTALS_KEYS[key] ? t(TOTALS_KEYS[key]) : key.replace(/([A-Z])/g, ' $1')}</p>
              </MotionDiv>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {overview.centres.map((row) => (
              <MotionDiv key={row.centre._id} className="card" {...cardMotion}>
                <button
                  type="button"
                  onClick={() => toggleExpand(row.centre._id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div>
                    <p className="font-semibold">{row.centre.name} <span className="text-small text-muted">({row.centre.codePrefix})</span></p>
                    <p className="text-small text-muted">{row.centre.village}, {row.centre.taluk}, {row.centre.district}</p>
                  </div>
                  <div className="flex gap-4 text-p2">
                    <span>{t('adminDashboard.overview.booked')} <strong>{row.totalBooked}</strong></span>
                    <span>{t('adminDashboard.overview.waitingLabel')} <strong>{row.waiting}</strong></span>
                    <span>{t('adminDashboard.overview.completedLabel')} <strong>{row.completed}</strong></span>
                  </div>
                </button>

                {expandedCentre === row.centre._id && centreQueue && (
                  <div className="mt-3 border-t border-border pt-3">
                    {centreQueue.bookings.length === 0 && <p className="text-p2 text-muted">{t('adminDashboard.overview.noBookingsThisDate')}</p>}
                    <ul className="space-y-1 text-p2">
                      {centreQueue.bookings.map((b) => (
                        <li key={b._id} className="flex justify-between">
                          <span>{b.token} · {b.farmer?.name}</span>
                          <span className="capitalize text-muted">{STATUS_KEYS[b.queueStatus] ? t(STATUS_KEYS[b.queueStatus]) : b.queueStatus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </MotionDiv>
            ))}
            {overview.centres.length === 0 && <p className="text-p2 text-muted">{t('adminDashboard.overview.noCentresForFilter')}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Centres ----------------

function emptyCentreForm() {
  return {
    name: '', district: '', taluk: '', village: '', address: '',
    latitude: '', longitude: '',
    openingTime: '08:00', closingTime: '17:00',
    slotDurationMinutes: 60, capacityPerSlot: 20,
    workingDays: [...ALL_DAYS],
    crops: [{ name: 'Paddy', maxQuantity: '' }],
    policyLimits: {
      earliestOpeningTime: '06:00', latestClosingTime: '20:00',
      minSlotDurationMinutes: 30, maxSlotDurationMinutes: 120,
      minCapacityPerSlot: 5, maxCapacityPerSlot: 100,
    },
  };
}

function CentreForm({ initial, onSubmit, submitLabel, t }) {
  const [form, setForm] = useState(initial);
  const [allDistricts, setAllDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [villages, setVillages] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/geo/districts').then(({ data }) => setAllDistricts(data));
  }, []);
  useEffect(() => {
    if (!form.district) return;
    api.get('/geo/taluks', { params: { district: form.district } }).then(({ data }) => setTaluks(data));
  }, [form.district]);
  useEffect(() => {
    if (!form.district || !form.taluk) return;
    api.get('/geo/villages', { params: { district: form.district, taluk: form.taluk } }).then(({ data }) => setVillages(data));
  }, [form.district, form.taluk]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function setLimit(field, value) { setForm((f) => ({ ...f, policyLimits: { ...f.policyLimits, [field]: value } })); }
  function toggleDay(day) {
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(day) ? f.workingDays.filter((d) => d !== day) : [...f.workingDays, day],
    }));
  }
  function updateCrop(i, field, value) {
    setForm((f) => ({ ...f, crops: f.crops.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)) }));
  }
  function addCrop() { setForm((f) => ({ ...f, crops: [...f.crops, { name: '', maxQuantity: '' }] })); }
  function removeCrop(i) { setForm((f) => ({ ...f, crops: f.crops.filter((_, idx) => idx !== i) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        location: form.latitude && form.longitude ? { latitude: Number(form.latitude), longitude: Number(form.longitude) } : undefined,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        capacityPerSlot: Number(form.capacityPerSlot),
        crops: form.crops.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), maxQuantity: c.maxQuantity ? Number(c.maxQuantity) : null })),
        policyLimits: {
          earliestOpeningTime: form.policyLimits.earliestOpeningTime,
          latestClosingTime: form.policyLimits.latestClosingTime,
          minSlotDurationMinutes: Number(form.policyLimits.minSlotDurationMinutes),
          maxSlotDurationMinutes: Number(form.policyLimits.maxSlotDurationMinutes),
          minCapacityPerSlot: Number(form.policyLimits.minCapacityPerSlot),
          maxCapacityPerSlot: Number(form.policyLimits.maxCapacityPerSlot),
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.centres.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MotionForm onSubmit={handleSubmit} className="card space-y-3" {...sectionMotion}>
      <input required placeholder={t('adminDashboard.centres.centreName')} className="field-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
      <input disabled className="field-input" value="Tamil Nadu" />
      <SearchableSelect label={t('register.location.district')} options={allDistricts} value={form.district} onChange={(v) => { set('district', v); set('taluk', ''); set('village', ''); }} />
      <SearchableSelect label={t('register.location.taluk')} options={taluks} value={form.taluk} onChange={(v) => { set('taluk', v); set('village', ''); }} disabled={!form.district} allowCustom />
      <SearchableSelect label={t('register.location.village')} options={villages} value={form.village} onChange={(v) => set('village', v)} disabled={!form.taluk} allowCustom />
      <input placeholder={t('adminDashboard.centres.address')} className="field-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input placeholder={t('adminDashboard.centres.latitude')} type="number" step="any" className="field-input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
        <input placeholder={t('adminDashboard.centres.longitude')} type="number" step="any" className="field-input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
      </div>

      <p className="field-label mt-2">{t('adminDashboard.centres.operatingSettings')}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="time" className="field-input" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} />
        <input type="time" className="field-input" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder={t('adminDashboard.centres.slotMinutes')} className="field-input" value={form.slotDurationMinutes} onChange={(e) => set('slotDurationMinutes', e.target.value)} />
        <input type="number" placeholder={t('adminDashboard.centres.capacityPerSlot')} className="field-input" value={form.capacityPerSlot} onChange={(e) => set('capacityPerSlot', e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((d) => (
          <button type="button" key={d} onClick={() => toggleDay(d)} className={`rounded border px-3 py-1 text-p2 ${form.workingDays.includes(d) ? 'border-primary bg-primary-light text-primary-dark' : 'border-border text-muted'}`}>
            {t(DAY_KEYS[d])}
          </button>
        ))}
      </div>

      <p className="field-label mt-2">{t('adminDashboard.centres.cropsHeading')}</p>
      {form.crops.map((c, i) => (
        <div key={i} className="flex gap-2">
          <input className="field-input flex-1" placeholder={t('adminDashboard.centres.crop')} value={c.name} onChange={(e) => updateCrop(i, 'name', e.target.value)} />
          <input type="number" className="field-input w-28" placeholder={t('officerDashboard.settings.maxQtyPlaceholder')} value={c.maxQuantity ?? ''} onChange={(e) => updateCrop(i, 'maxQuantity', e.target.value)} />
          <button type="button" onClick={() => removeCrop(i)} className="btn-outline px-3 text-danger">×</button>
        </div>
      ))}
      <button type="button" onClick={addCrop} className="text-p2 text-primary underline">+ {t('officerDashboard.settings.addCrop')}</button>

      <p className="field-label mt-2">{t('adminDashboard.centres.policyLimitsHeading')}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-small text-muted">{t('adminDashboard.centres.earliestOpening')}</label>
          <input type="time" className="field-input" value={form.policyLimits.earliestOpeningTime} onChange={(e) => setLimit('earliestOpeningTime', e.target.value)} />
        </div>
        <div>
          <label className="text-small text-muted">{t('adminDashboard.centres.latestClosing')}</label>
          <input type="time" className="field-input" value={form.policyLimits.latestClosingTime} onChange={(e) => setLimit('latestClosingTime', e.target.value)} />
        </div>
        <div>
          <label className="text-small text-muted">{t('adminDashboard.centres.minMaxSlotMinutes')}</label>
          <div className="flex gap-2">
            <input type="number" className="field-input" value={form.policyLimits.minSlotDurationMinutes} onChange={(e) => setLimit('minSlotDurationMinutes', e.target.value)} />
            <input type="number" className="field-input" value={form.policyLimits.maxSlotDurationMinutes} onChange={(e) => setLimit('maxSlotDurationMinutes', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-small text-muted">{t('adminDashboard.centres.minMaxQueue')}</label>
          <div className="flex gap-2">
            <input type="number" className="field-input" value={form.policyLimits.minCapacityPerSlot} onChange={(e) => setLimit('minCapacityPerSlot', e.target.value)} />
            <input type="number" className="field-input" value={form.policyLimits.maxCapacityPerSlot} onChange={(e) => setLimit('maxCapacityPerSlot', e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-p2 text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? t('common.saving') : submitLabel}</button>
    </MotionForm>
  );
}

function ResetOfficerPasswordPanel({ centreId, t }) {
  const [newPassword, setNewPassword] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setSaving(true);
    try {
      await api.put(`/centres/${centreId}/password`, { newPassword });
      setResult(newPassword);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.centres.resetPasswordFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MotionForm onSubmit={handleSubmit} className="card mt-4 space-y-3" {...sectionMotion}>
      <h2 className="text-p2 font-semibold text-muted">{t('adminDashboard.centres.resetPasswordHeading')}</h2>
      <p className="text-small text-muted">{t('adminDashboard.centres.resetPasswordNote')}</p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {result && (
        <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
          {t('adminDashboard.centres.newPasswordSet')}: <strong>{result}</strong> - {t('adminDashboard.centres.noteItDown')}
        </p>
      )}
      <div className="flex gap-2">
        <input required minLength={6} placeholder={t('officerDashboard.password.new')} className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <button type="submit" disabled={saving} className="btn-outline">{saving ? t('common.saving') : t('adminDashboard.centres.reset')}</button>
      </div>
    </MotionForm>
  );
}

function CentresTab({ t }) {
  const [centres, setCentres] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [districtFilter, setDistrictFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // centre object or null
  const [creating, setCreating] = useState(false);

  const load = () => api.get('/centres', { params: { district: districtFilter || undefined } }).then(({ data }) => setCentres(data));
  useEffect(() => { load(); }, [districtFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/centres/districts').then(({ data }) => setDistricts(data)); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return centres.slice(0, 50);
    return centres.filter((c) => c.name.toLowerCase().includes(q) || c.village?.toLowerCase().includes(q)).slice(0, 50);
  }, [centres, search]);

  const [createdPasswordNotice, setCreatedPasswordNotice] = useState(null);

  async function handleCreate(payload) {
    const { data } = await api.post('/centres', payload);
    setCreating(false);
    setCreatedPasswordNotice({ name: data.name, password: data.initialOfficerPassword });
    load();
  }
  async function handleUpdate(payload) {
    await api.put(`/centres/${editing._id}`, payload);
    setEditing(null);
    load();
  }

  const allDistrictsLabel = t('centreSchedules.allDistricts');

  if (creating) {
    return (
      <div>
        <button onClick={() => setCreating(false)} className="mb-3 text-p2 text-primary underline">← {t('adminDashboard.centres.backToList')}</button>
        <CentreForm initial={emptyCentreForm()} onSubmit={handleCreate} submitLabel={t('adminDashboard.centres.createCentre')} t={t} />
      </div>
    );
  }
  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="mb-3 text-p2 text-primary underline">← {t('adminDashboard.centres.backToList')}</button>
        <CentreForm
          initial={{
            ...editing,
            latitude: editing.location?.latitude ?? '',
            longitude: editing.location?.longitude ?? '',
            crops: editing.crops?.length ? editing.crops : [{ name: '', maxQuantity: '' }],
            policyLimits: editing.policyLimits || emptyCentreForm().policyLimits,
          }}
          onSubmit={handleUpdate}
          submitLabel={t('common.saveChanges')}
          t={t}
        />
        <ResetOfficerPasswordPanel centreId={editing._id} t={t} />
      </div>
    );
  }

  return (
    <div>
      {createdPasswordNotice && (
        <p className="mb-3 rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
          {t('adminDashboard.centres.centreCreated')} "{createdPasswordNotice.name}". {t('adminDashboard.centres.officerLoginPassword')}: <strong>{createdPasswordNotice.password}</strong> - {t('adminDashboard.centres.noteItDown')}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <SearchableSelect label={t('register.location.district')} options={[allDistrictsLabel, ...districts]} value={districtFilter || allDistrictsLabel} onChange={(v) => setDistrictFilter(v === allDistrictsLabel ? '' : v)} />
        </div>
        <div className="flex-1">
          <label className="field-label">{t('centreSchedules.searchLabel')}</label>
          <input className="field-input" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">+ {t('adminDashboard.centres.addCentre')}</button>
      </div>

      <p className="mt-3 text-small text-muted">{centres.length} {t('adminDashboard.centres.centresMatch')}{filtered.length < centres.length ? ` · ${t('centreSchedules.showingFirst')} ${filtered.length}` : ''}</p>

      <div className="mt-3 space-y-2">
        {filtered.map((c) => (
          <MotionButton key={c._id} onClick={() => setEditing(c)} className="card block w-full text-left hover:border-primary" {...cardMotionTap}>
            <p className="font-semibold">{c.name} <span className="text-small text-muted">({c.codePrefix})</span></p>
            <p className="text-p2 text-muted">{c.village}, {c.taluk}, {c.district} · {c.openingTime}–{c.closingTime} · {c.capacityPerSlot}/{t('common.slot')}</p>
            <p className="text-small text-muted">{t('centreSchedules.cropsAccepted')}: {c.supportedCrops?.join(', ') || '—'}</p>
          </MotionButton>
        ))}
      </div>
    </div>
  );
}

// ---------------- Crop rates ----------------

// A rate is "broken" (missing, or a leftover NaN from before the backend
// validation fix) if it isn't a genuine finite number - shown distinctly so
// an admin notices it needs fixing rather than reading "₹NaN" and assuming
// that's some kind of real value.
function isBrokenRate(value) {
  return value == null || Number.isNaN(Number(value));
}

function CropRatesTab({ t }) {
  const [rates, setRates] = useState([]);
  const [crop, setCrop] = useState('');
  const [unit, setUnit] = useState('bag');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [unitWeightKg, setUnitWeightKg] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null); // _id of the rate currently being edited inline, or null

  const load = () => api.get('/admin/crop-rates').then(({ data }) => setRates(data));
  useEffect(() => { load(); }, []);

  function startEdit(rate) {
    setEditingId(rate._id);
    setError('');
  }

  async function saveEdit(id, values) {
    setError('');
    try {
      await api.put(`/admin/crop-rates/${id}`, values);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.cropRates.updateFailed'));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/crop-rates', {
        crop,
        unit,
        ratePerUnit: Number(ratePerUnit),
        unitWeightKg: unitWeightKg ? Number(unitWeightKg) : undefined,
      });
      setCrop(''); setRatePerUnit(''); setUnitWeightKg('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.cropRates.saveFailed'));
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">{t('adminDashboard.cropRates.heading')}</h2>
        <div className="space-y-2">
          {rates.map((r) =>
            editingId === r._id ? (
              <CropRateEditRow key={r._id} rate={r} onCancel={() => setEditingId(null)} onSave={(values) => saveEdit(r._id, values)} t={t} />
            ) : (
              <MotionDiv key={r._id} className="card flex items-center justify-between gap-3" {...cardMotion}>
                <span>{r.crop}</span>
                <div className="flex items-center gap-3">
                  {isBrokenRate(r.ratePerUnit) ? (
                    <span className="rounded bg-danger/10 px-2 py-1 text-small font-medium text-danger">{t('adminDashboard.cropRates.notSet')}</span>
                  ) : (
                    <span className="font-semibold text-primary">₹{r.ratePerUnit}/{r.unit}{r.unitWeightKg ? ` (${r.unitWeightKg}kg)` : ''}</span>
                  )}
                  <button type="button" onClick={() => startEdit(r)} className="btn-outline text-small">{t('common.edit')}</button>
                </div>
              </MotionDiv>
            )
          )}
        </div>
        {error && <p className="mt-3 text-p2 text-danger">{error}</p>}
      </div>
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">{t('adminDashboard.cropRates.addNewCrop')}</h2>
        <MotionForm onSubmit={handleSubmit} className="card space-y-3" {...sectionMotion}>
          <input required placeholder={t('adminDashboard.centres.crop')} className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder={t('adminDashboard.cropRates.unitPlaceholder')} className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <input type="number" placeholder={t('adminDashboard.cropRates.weightPlaceholder')} className="field-input" value={unitWeightKg} onChange={(e) => setUnitWeightKg(e.target.value)} />
          </div>
          <input required type="number" step="0.01" min="0.01" placeholder={t('adminDashboard.cropRates.ratePlaceholder')} className="field-input" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
          <button type="submit" className="btn-primary w-full">{t('adminDashboard.cropRates.saveRate')}</button>
        </MotionForm>
      </div>
    </div>
  );
}

// Inline edit form for one existing rate row - pre-fills with the current
// values (a broken/NaN rate pre-fills blank rather than showing "NaN" in
// the input) so fixing a rate no longer means retyping the crop name into
// the add form and hoping it upserts the right document.
function CropRateEditRow({ rate, onCancel, onSave, t }) {
  const [unit, setUnit] = useState(rate.unit || 'bag');
  const [ratePerUnit, setRatePerUnit] = useState(isBrokenRate(rate.ratePerUnit) ? '' : String(rate.ratePerUnit));
  const [unitWeightKg, setUnitWeightKg] = useState(rate.unitWeightKg ?? '');

  function submit(e) {
    e.preventDefault();
    onSave({
      unit,
      ratePerUnit: Number(ratePerUnit),
      unitWeightKg: unitWeightKg ? Number(unitWeightKg) : undefined,
    });
  }

  return (
    <MotionForm onSubmit={submit} className="card space-y-2" {...sectionMotion}>
      <p className="font-semibold">{rate.crop}</p>
      <div className="grid grid-cols-2 gap-2">
        <input required placeholder={t('adminDashboard.cropRates.unitPlaceholder')} className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <input type="number" placeholder={t('adminDashboard.cropRates.weightPlaceholder')} className="field-input" value={unitWeightKg} onChange={(e) => setUnitWeightKg(e.target.value)} />
      </div>
      <input required type="number" step="0.01" min="0.01" placeholder={t('adminDashboard.cropRates.ratePlaceholder')} className="field-input" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-small">{t('common.save')}</button>
        <button type="button" onClick={onCancel} className="btn-outline text-small">{t('common.cancel')}</button>
      </div>
    </MotionForm>
  );
}

// ---------------- Staff (admin accounts only - officers log in by centre + shared password) ----------------

function StaffTab({ t }) {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');

  const load = () => api.get('/admin/staff').then(({ data }) => setStaff(data));
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/staff', { ...form, role: 'admin' });
      setForm({ name: '', username: '', password: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.staff.createFailed'));
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">{t('adminDashboard.staff.adminAccounts')}</h2>
        <p className="mb-2 text-small text-muted">{t('adminDashboard.staff.officerNote')}</p>
        <div className="space-y-2">
          {staff.filter((s) => s.role === 'admin').map((s) => (
            <MotionDiv key={s._id} className="card" {...cardMotion}>
              <p className="font-medium">{s.name}</p>
              <p className="text-small text-muted">{s.username} · {t('adminDashboard.staff.adminRole')}</p>
            </MotionDiv>
          ))}
        </div>
        <ChangeAdminPasswordPanel t={t} />
      </div>
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">{t('adminDashboard.staff.addAdminAccount')}</h2>
        <MotionForm onSubmit={handleSubmit} className="card space-y-3" {...sectionMotion}>
          <input required placeholder={t('adminDashboard.staff.fullName')} className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder={t('adminDashboard.staff.username')} className="field-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input required type="password" placeholder={t('adminDashboard.staff.password')} className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-p2 text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full">{t('adminDashboard.staff.createAccount')}</button>
        </MotionForm>
      </div>
    </div>
  );
}

function ChangeAdminPasswordPanel({ t }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError(t('officerDashboard.password.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/staff/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || t('officerDashboard.password.changeFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MotionForm onSubmit={handleSubmit} className="card mt-4 space-y-3" {...sectionMotion}>
      <h2 className="text-p2 font-semibold text-muted">{t('adminDashboard.staff.changeYourPassword')}</h2>
      <p className="text-small text-muted">{t('adminDashboard.staff.breachedPasswordNote')}</p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {success && <p className="text-p2 text-primary">{t('officerDashboard.password.updated')}</p>}
      <input type="password" required placeholder={t('officerDashboard.password.current')} className="field-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <input type="password" required minLength={8} placeholder={t('adminDashboard.staff.newPasswordMin8')} className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <input type="password" required placeholder={t('officerDashboard.password.confirmNew')} className="field-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <button type="submit" disabled={saving} className="btn-outline w-full">{saving ? t('common.saving') : t('officerDashboard.password.change')}</button>
    </MotionForm>
  );
}

// ---------------- Complaints ----------------

const COMPLAINT_CATEGORIES = ['long_wait', 'rude_behaviour', 'wrong_weight', 'payment_delay', 'other'];
const COMPLAINT_CATEGORY_KEYS = {
  long_wait: 'reportComplaint.category.longWait',
  rude_behaviour: 'reportComplaint.category.rudeBehaviour',
  wrong_weight: 'reportComplaint.category.wrongWeight',
  payment_delay: 'reportComplaint.category.paymentDelay',
  other: 'reportComplaint.category.other',
};
const COMPLAINT_STATUS_KEYS = {
  open: 'reportComplaint.status.open',
  in_progress: 'reportComplaint.status.inProgress',
  resolved: 'reportComplaint.status.resolved',
};

// Admin's queue for the "officer requests -> admin accepts & processes ->
// admin completes" payment flow (see paymentController.js). Spans every
// centre, since centralising this decision at admin is the whole point.
function PaymentRequestsTab({ t }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [paidAmounts, setPaidAmounts] = useState({});

  const load = () =>
    api
      .get('/payments/requests')
      .then(({ data }) => setBookings(data))
      .catch((err) => setError(err.response?.data?.message || t('adminDashboard.paymentRequests.loadFailed')));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id, fn) {
    setBusyId(id);
    setError('');
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('adminDashboard.paymentRequests.actionFailed'));
    } finally {
      setBusyId(null);
    }
  }

  const accept = (id) => act(id, () => api.post(`/payments/${id}/process`));
  const complete = (id) =>
    act(id, () => api.post(`/payments/${id}/complete`, { paidAmount: Number(paidAmounts[id]) }));

  return (
    <div>
      {error && <p className="text-p2 text-danger">{error}</p>}
      <p className="mt-1 text-small text-muted">{bookings.length} {t('adminDashboard.paymentRequests.countLabel')}</p>
      <div className="mt-4 space-y-3">
        {bookings.length === 0 && <p className="text-p2 text-muted">{t('adminDashboard.paymentRequests.none')}</p>}
        {bookings.map((b) => (
          <MotionDiv key={b._id} className="card" {...cardMotion}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-primary">{b.token}</p>
                <p className="text-p2 text-muted">{b.farmer?.name} · {b.farmer?.mobileNumber}</p>
                <p className="text-small text-muted">
                  {b.centre?.name} ({b.centre?.code}){b.crop ? ` · ${b.crop}` : ''}{b.quantity ? ` · ${b.quantity} ${b.unit || ''}` : ''}
                </p>
              </div>
              <StatusBadge status={b.paymentStatus} />
            </div>
            <p className="mt-2 text-p2">{t('adminDashboard.paymentRequests.estimatedValue')}: ₹{b.estimatedValue ?? '—'}</p>

            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
              {b.paymentStatus === 'requested' && (
                <button disabled={busyId === b._id} onClick={() => accept(b._id)} className="btn-primary text-p2">
                  {t('adminDashboard.paymentRequests.accept')}
                </button>
              )}
              {b.paymentStatus === 'processing' && (
                <>
                  <div>
                    <label className="field-label">{t('officerDashboard.amountToPay')} (₹)</label>
                    <input
                      type="number"
                      className="field-input w-32"
                      value={paidAmounts[b._id] ?? b.estimatedValue ?? ''}
                      onChange={(e) => setPaidAmounts((prev) => ({ ...prev, [b._id]: e.target.value }))}
                    />
                  </div>
                  <button
                    disabled={busyId === b._id || !(paidAmounts[b._id] ?? b.estimatedValue)}
                    onClick={() => complete(b._id)}
                    className="btn-primary text-p2"
                  >
                    {t('adminDashboard.paymentRequests.complete')}
                  </button>
                </>
              )}
            </div>
          </MotionDiv>
        ))}
      </div>
    </div>
  );
}

function ComplaintsTab({ t }) {
  const [complaints, setComplaints] = useState([]);
  const [centres, setCentres] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [centreFilter, setCentreFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/centres').then(({ data }) => setCentres(data)); }, []);

  const centreOptions = useMemo(
    () => centres.map((c) => ({ value: c._id, label: `${c.name} (${c.district})` })),
    [centres]
  );

  const load = () =>
    api.get('/complaints', { params: { status: statusFilter || undefined, centreId: centreFilter || undefined } })
      .then(({ data }) => setComplaints(data))
      .catch((err) => setError(err.response?.data?.message || t('adminDashboard.complaints.loadFailed')));

  useEffect(() => { load(); }, [statusFilter, centreFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Category isn't a backend query param today (only status/centreId are) -
  // filtered client-side here so it doesn't need a backend change.
  const visible = categoryFilter ? complaints.filter((c) => c.category === categoryFilter) : complaints;

  async function updateStatus(id, status) {
    await api.put(`/complaints/${id}`, { status });
    load();
  }

  const allLabel = t('adminDashboard.complaints.all');
  const allCentresLabel = t('adminDashboard.complaints.allCentres');

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <SearchableSelect
            label={t('adminDashboard.complaints.status')}
            options={[allLabel, 'open', 'in_progress', 'resolved'].map((v) => (v === allLabel ? v : { value: v, label: t(COMPLAINT_STATUS_KEYS[v]) }))}
            value={statusFilter || allLabel}
            onChange={(v) => setStatusFilter(v === allLabel ? '' : v)}
          />
        </div>
        <div className="w-56">
          <SearchableSelect
            label={t('reportComplaint.categoryLabel')}
            options={[allLabel, ...COMPLAINT_CATEGORIES].map((v) => (v === allLabel ? v : { value: v, label: t(COMPLAINT_CATEGORY_KEYS[v]) }))}
            value={categoryFilter || allLabel}
            onChange={(v) => setCategoryFilter(v === allLabel ? '' : v)}
          />
        </div>
        <div className="w-64">
          <SearchableSelect
            label={t('adminDashboard.complaints.centre')}
            options={[{ value: '', label: allCentresLabel }, ...centreOptions]}
            value={centreFilter}
            onChange={setCentreFilter}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-p2 text-danger">{error}</p>}
      <p className="mt-3 text-small text-muted">{visible.length} {t('adminDashboard.complaints.matchFilter')}</p>
      <div className="mt-4 space-y-3">
        {visible.length === 0 && <p className="text-p2 text-muted">{t('adminDashboard.complaints.noneMatch')}</p>}
        {visible.map((c) => (
          <MotionDiv key={c._id} className="card" {...cardMotion}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{c.farmer?.name} <span className="text-small text-muted">({c.farmer?.mobileNumber})</span></p>
                <p className="text-small text-muted">
                  {t('adminDashboard.complaints.about')} {c.centre?.name} · {COMPLAINT_CATEGORY_KEYS[c.category] ? t(COMPLAINT_CATEGORY_KEYS[c.category]) : c.category.replace(/_/g, ' ')} · {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`rounded px-2 py-1 text-small capitalize ${
                c.status === 'resolved' ? 'bg-primary-light text-primary-dark' : c.status === 'in_progress' ? 'bg-accent-light text-accent-dark' : 'bg-border text-muted'
              }`}>
                {t(COMPLAINT_STATUS_KEYS[c.status] || '') || c.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-p2">{c.message}</p>
            {c.attachments?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.attachments.map((a, i) => (
                  <a
                    key={a}
                    href={`${api.defaults.baseURL.replace(/\/api\/?$/, '')}/uploads/${a}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-small text-primary underline"
                  >
                    {t('reportComplaint.attachmentLink')} {i + 1}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {c.status !== 'in_progress' && (
                <button onClick={() => updateStatus(c._id, 'in_progress')} className="btn-outline text-small">{t('adminDashboard.complaints.markInProgress')}</button>
              )}
              {c.status !== 'resolved' && (
                <button onClick={() => updateStatus(c._id, 'resolved')} className="btn-primary text-small">{t('adminDashboard.complaints.markResolved')}</button>
              )}
            </div>
          </MotionDiv>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('Overview');

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-h1">{t('adminDashboard.title')}</h1>

      <div className="mt-4 flex gap-2 border-b border-border">
        {TAB_KEYS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-p2 font-medium ${
              tab === key ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <OverviewTab t={t} />}
        {tab === 'Centres' && <CentresTab t={t} />}
        {tab === 'Crop rates' && <CropRatesTab t={t} />}
        {tab === 'Complaints' && <ComplaintsTab t={t} />}
        {tab === 'Staff' && <StaffTab t={t} />}
        {tab === 'Payment requests' && <PaymentRequestsTab t={t} />}
        {tab === 'Notifications' && <NotificationCentre fetchUrl="/notifications/admin" clearUrl="/notifications/admin" titleKey="adminDashboard.tab.notifications" />}
      </div>
    </div>
  );
}
