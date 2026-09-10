import { useEffect, useMemo, useState } from 'react';
import api from '../../api/api.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';

const TABS = ['Overview', 'Centres', 'Crop rates', 'Complaints', 'Staff'];
const ALL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_LABELS = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Overview ----------------

function OverviewTab() {
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
      .catch((err) => setError(err.response?.data?.message || 'Could not load overview'));
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

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <SearchableSelect
            label="Filter by district"
            options={['All districts', ...districts]}
            value={district || 'All districts'}
            onChange={(v) => setDistrict(v === 'All districts' ? '' : v)}
          />
        </div>
        <div>
          <label className="field-label">Date</label>
          <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-p2 text-danger">{error}</p>}

      {overview && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(overview.totals).map(([key, value]) => (
              <div key={key} className="card text-center">
                <p className="text-h1 text-primary">{value}</p>
                <p className="text-small capitalize text-muted">{key.replace(/([A-Z])/g, ' $1')}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {overview.centres.map((row) => (
              <div key={row.centre._id} className="card">
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
                    <span>Booked <strong>{row.totalBooked}</strong></span>
                    <span>Waiting <strong>{row.waiting}</strong></span>
                    <span>Completed <strong>{row.completed}</strong></span>
                  </div>
                </button>

                {expandedCentre === row.centre._id && centreQueue && (
                  <div className="mt-3 border-t border-border pt-3">
                    {centreQueue.bookings.length === 0 && <p className="text-p2 text-muted">No bookings this date.</p>}
                    <ul className="space-y-1 text-p2">
                      {centreQueue.bookings.map((b) => (
                        <li key={b._id} className="flex justify-between">
                          <span>{b.token} · {b.farmer?.name}</span>
                          <span className="capitalize text-muted">{b.queueStatus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {overview.centres.length === 0 && <p className="text-p2 text-muted">No centres for this filter.</p>}
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

function CentreForm({ initial, onSubmit, submitLabel }) {
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
      setError(err.response?.data?.message || 'Could not save centre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input required placeholder="Centre name" className="field-input" value={form.name} onChange={(e) => set('name', e.target.value)} />
      <input disabled className="field-input" value="Tamil Nadu" />
      <SearchableSelect label="District" options={allDistricts} value={form.district} onChange={(v) => { set('district', v); set('taluk', ''); set('village', ''); }} />
      <SearchableSelect label="Taluk" options={taluks} value={form.taluk} onChange={(v) => { set('taluk', v); set('village', ''); }} disabled={!form.district} allowCustom />
      <SearchableSelect label="Village" options={villages} value={form.village} onChange={(v) => set('village', v)} disabled={!form.taluk} allowCustom />
      <input placeholder="Address" className="field-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Latitude" type="number" step="any" className="field-input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
        <input placeholder="Longitude" type="number" step="any" className="field-input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
      </div>

      <p className="field-label mt-2">Operating settings (the centre's own officer can adjust within the limits below)</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="time" className="field-input" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} />
        <input type="time" className="field-input" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Slot minutes" className="field-input" value={form.slotDurationMinutes} onChange={(e) => set('slotDurationMinutes', e.target.value)} />
        <input type="number" placeholder="Capacity/slot" className="field-input" value={form.capacityPerSlot} onChange={(e) => set('capacityPerSlot', e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((d) => (
          <button type="button" key={d} onClick={() => toggleDay(d)} className={`rounded border px-3 py-1 text-p2 ${form.workingDays.includes(d) ? 'border-primary bg-primary-light text-primary-dark' : 'border-border text-muted'}`}>
            {DAY_LABELS[d]}
          </button>
        ))}
      </div>

      <p className="field-label mt-2">Crops accepted &amp; max quantity per farmer (kg)</p>
      {form.crops.map((c, i) => (
        <div key={i} className="flex gap-2">
          <input className="field-input flex-1" placeholder="Crop" value={c.name} onChange={(e) => updateCrop(i, 'name', e.target.value)} />
          <input type="number" className="field-input w-28" placeholder="Max qty" value={c.maxQuantity ?? ''} onChange={(e) => updateCrop(i, 'maxQuantity', e.target.value)} />
          <button type="button" onClick={() => removeCrop(i)} className="btn-outline px-3 text-danger">×</button>
        </div>
      ))}
      <button type="button" onClick={addCrop} className="text-p2 text-primary underline">+ Add crop</button>

      <p className="field-label mt-2">Policy limits (bounds for this centre's officer)</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-small text-muted">Earliest opening</label>
          <input type="time" className="field-input" value={form.policyLimits.earliestOpeningTime} onChange={(e) => setLimit('earliestOpeningTime', e.target.value)} />
        </div>
        <div>
          <label className="text-small text-muted">Latest closing</label>
          <input type="time" className="field-input" value={form.policyLimits.latestClosingTime} onChange={(e) => setLimit('latestClosingTime', e.target.value)} />
        </div>
        <div>
          <label className="text-small text-muted">Min / max slot minutes</label>
          <div className="flex gap-2">
            <input type="number" className="field-input" value={form.policyLimits.minSlotDurationMinutes} onChange={(e) => setLimit('minSlotDurationMinutes', e.target.value)} />
            <input type="number" className="field-input" value={form.policyLimits.maxSlotDurationMinutes} onChange={(e) => setLimit('maxSlotDurationMinutes', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-small text-muted">Min / max queue per slot</label>
          <div className="flex gap-2">
            <input type="number" className="field-input" value={form.policyLimits.minCapacityPerSlot} onChange={(e) => setLimit('minCapacityPerSlot', e.target.value)} />
            <input type="number" className="field-input" value={form.policyLimits.maxCapacityPerSlot} onChange={(e) => setLimit('maxCapacityPerSlot', e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-p2 text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : submitLabel}</button>
    </form>
  );
}

function ResetOfficerPasswordPanel({ centreId }) {
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
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-4 space-y-3">
      <h2 className="text-p2 font-semibold text-muted">Reset this centre's login password</h2>
      <p className="text-small text-muted">
        As admin you can set this directly, without needing the current password. Share the new password with the centre's officer.
      </p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {result && (
        <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
          New password set: <strong>{result}</strong> - note it down now, it won't be shown again.
        </p>
      )}
      <div className="flex gap-2">
        <input required minLength={6} placeholder="New password" className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <button type="submit" disabled={saving} className="btn-outline">{saving ? 'Saving...' : 'Reset'}</button>
      </div>
    </form>
  );
}

function CentresTab() {
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

  if (creating) {
    return (
      <div>
        <button onClick={() => setCreating(false)} className="mb-3 text-p2 text-primary underline">← Back to list</button>
        <CentreForm initial={emptyCentreForm()} onSubmit={handleCreate} submitLabel="Create centre" />
      </div>
    );
  }
  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="mb-3 text-p2 text-primary underline">← Back to list</button>
        <CentreForm
          initial={{
            ...editing,
            latitude: editing.location?.latitude ?? '',
            longitude: editing.location?.longitude ?? '',
            crops: editing.crops?.length ? editing.crops : [{ name: '', maxQuantity: '' }],
            policyLimits: editing.policyLimits || emptyCentreForm().policyLimits,
          }}
          onSubmit={handleUpdate}
          submitLabel="Save changes"
        />
        <ResetOfficerPasswordPanel centreId={editing._id} />
      </div>
    );
  }

  return (
    <div>
      {createdPasswordNotice && (
        <p className="mb-3 rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
          Centre "{createdPasswordNotice.name}" created. Officer login password: <strong>{createdPasswordNotice.password}</strong> - note it down now, it won't be shown again.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <SearchableSelect label="District" options={['All districts', ...districts]} value={districtFilter || 'All districts'} onChange={(v) => setDistrictFilter(v === 'All districts' ? '' : v)} />
        </div>
        <div className="flex-1">
          <label className="field-label">Search by name or village</label>
          <input className="field-input" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">+ Add centre</button>
      </div>

      <p className="mt-3 text-small text-muted">{centres.length} centre(s) match this filter{filtered.length < centres.length ? ` · showing first ${filtered.length}` : ''}</p>

      <div className="mt-3 space-y-2">
        {filtered.map((c) => (
          <button key={c._id} onClick={() => setEditing(c)} className="card block w-full text-left hover:border-primary">
            <p className="font-semibold">{c.name} <span className="text-small text-muted">({c.codePrefix})</span></p>
            <p className="text-p2 text-muted">{c.village}, {c.taluk}, {c.district} · {c.openingTime}–{c.closingTime} · {c.capacityPerSlot}/slot</p>
            <p className="text-small text-muted">Crops: {c.supportedCrops?.join(', ') || '—'}</p>
          </button>
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

function CropRatesTab() {
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
      setError(err.response?.data?.message || 'Could not update rate');
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
      setError(err.response?.data?.message || 'Could not save rate');
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">Minimum support price</h2>
        <div className="space-y-2">
          {rates.map((r) =>
            editingId === r._id ? (
              <CropRateEditRow key={r._id} rate={r} onCancel={() => setEditingId(null)} onSave={(values) => saveEdit(r._id, values)} />
            ) : (
              <div key={r._id} className="card flex items-center justify-between gap-3">
                <span>{r.crop}</span>
                <div className="flex items-center gap-3">
                  {isBrokenRate(r.ratePerUnit) ? (
                    <span className="rounded bg-danger/10 px-2 py-1 text-small font-medium text-danger">Not set - needs a value</span>
                  ) : (
                    <span className="font-semibold text-primary">₹{r.ratePerUnit}/{r.unit}{r.unitWeightKg ? ` (${r.unitWeightKg}kg)` : ''}</span>
                  )}
                  <button type="button" onClick={() => startEdit(r)} className="btn-outline text-small">Edit</button>
                </div>
              </div>
            )
          )}
        </div>
        {error && <p className="mt-3 text-p2 text-danger">{error}</p>}
      </div>
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">Add a new crop</h2>
        <form onSubmit={handleSubmit} className="card space-y-3">
          <input required placeholder="Crop" className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Unit (e.g. bag)" className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <input type="number" placeholder="Weight/unit (kg, optional)" className="field-input" value={unitWeightKg} onChange={(e) => setUnitWeightKg(e.target.value)} />
          </div>
          <input required type="number" step="0.01" min="0.01" placeholder="Rate per unit (₹)" className="field-input" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
          <button type="submit" className="btn-primary w-full">Save rate</button>
        </form>
      </div>
    </div>
  );
}

// Inline edit form for one existing rate row - pre-fills with the current
// values (a broken/NaN rate pre-fills blank rather than showing "NaN" in
// the input) so fixing a rate no longer means retyping the crop name into
// the add form and hoping it upserts the right document.
function CropRateEditRow({ rate, onCancel, onSave }) {
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
    <form onSubmit={submit} className="card space-y-2">
      <p className="font-semibold">{rate.crop}</p>
      <div className="grid grid-cols-2 gap-2">
        <input required placeholder="Unit (e.g. bag)" className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <input type="number" placeholder="Weight/unit (kg, optional)" className="field-input" value={unitWeightKg} onChange={(e) => setUnitWeightKg(e.target.value)} />
      </div>
      <input required type="number" step="0.01" min="0.01" placeholder="Rate per unit (₹)" className="field-input" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-small">Save</button>
        <button type="button" onClick={onCancel} className="btn-outline text-small">Cancel</button>
      </div>
    </form>
  );
}

// ---------------- Staff (admin accounts only - officers log in by centre + shared password) ----------------

function StaffTab() {
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
      setError(err.response?.data?.message || 'Could not create account');
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">Admin accounts</h2>
        <p className="mb-2 text-small text-muted">
          Officers no longer need individual accounts - they log in by picking their centre and that centre's own password (set per centre in the Centres tab).
        </p>
        <div className="space-y-2">
          {staff.filter((s) => s.role === 'admin').map((s) => (
            <div key={s._id} className="card">
              <p className="font-medium">{s.name}</p>
              <p className="text-small text-muted">{s.username} · admin</p>
            </div>
          ))}
        </div>
        <ChangeAdminPasswordPanel />
      </div>
      <div>
        <h2 className="mb-3 text-p2 font-semibold text-muted">Add an admin account</h2>
        <form onSubmit={handleSubmit} className="card space-y-3">
          <input required placeholder="Full name" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Username" className="field-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input required type="password" placeholder="Password" className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-p2 text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full">Create account</button>
        </form>
      </div>
    </div>
  );
}

function ChangeAdminPasswordPanel() {
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
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/staff/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-4 space-y-3">
      <h2 className="text-p2 font-semibold text-muted">Change your own password</h2>
      <p className="text-small text-muted">
        The seeded default (admin123) is a well-known password - browsers will flag it as breached. Change it here.
      </p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {success && <p className="text-p2 text-primary">Password updated.</p>}
      <input type="password" required placeholder="Current password" className="field-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <input type="password" required minLength={8} placeholder="New password (min 8 characters)" className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <input type="password" required placeholder="Confirm new password" className="field-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <button type="submit" disabled={saving} className="btn-outline w-full">{saving ? 'Saving...' : 'Change password'}</button>
    </form>
  );
}

// ---------------- Complaints ----------------

const COMPLAINT_CATEGORIES = ['long_wait', 'rude_behaviour', 'wrong_weight', 'payment_delay', 'other'];

function ComplaintsTab() {
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
      .catch((err) => setError(err.response?.data?.message || 'Could not load complaints'));

  useEffect(() => { load(); }, [statusFilter, centreFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Category isn't a backend query param today (only status/centreId are) -
  // filtered client-side here so it doesn't need a backend change.
  const visible = categoryFilter ? complaints.filter((c) => c.category === categoryFilter) : complaints;

  async function updateStatus(id, status) {
    await api.put(`/complaints/${id}`, { status });
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <SearchableSelect
            label="Status"
            options={['All', 'open', 'in_progress', 'resolved']}
            value={statusFilter || 'All'}
            onChange={(v) => setStatusFilter(v === 'All' ? '' : v)}
          />
        </div>
        <div className="w-56">
          <SearchableSelect
            label="Category"
            options={['All', ...COMPLAINT_CATEGORIES]}
            value={categoryFilter || 'All'}
            onChange={(v) => setCategoryFilter(v === 'All' ? '' : v)}
          />
        </div>
        <div className="w-64">
          <SearchableSelect
            label="Centre"
            options={[{ value: '', label: 'All centres' }, ...centreOptions]}
            value={centreFilter}
            onChange={setCentreFilter}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-p2 text-danger">{error}</p>}
      <p className="mt-3 text-small text-muted">{visible.length} complaint(s) match this filter</p>
      <div className="mt-4 space-y-3">
        {visible.length === 0 && <p className="text-p2 text-muted">No complaints match this filter.</p>}
        {visible.map((c) => (
          <div key={c._id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{c.farmer?.name} <span className="text-small text-muted">({c.farmer?.mobileNumber})</span></p>
                <p className="text-small text-muted">About {c.centre?.name} · {c.category.replace(/_/g, ' ')} · {new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`rounded px-2 py-1 text-small capitalize ${
                c.status === 'resolved' ? 'bg-primary-light text-primary-dark' : c.status === 'in_progress' ? 'bg-accent-light text-accent-dark' : 'bg-border text-muted'
              }`}>
                {c.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-p2">{c.message}</p>
            <div className="mt-3 flex gap-2">
              {c.status !== 'in_progress' && (
                <button onClick={() => updateStatus(c._id, 'in_progress')} className="btn-outline text-small">Mark in progress</button>
              )}
              {c.status !== 'resolved' && (
                <button onClick={() => updateStatus(c._id, 'resolved')} className="btn-primary text-small">Mark resolved</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-h1">Admin</h1>

      <div className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-p2 font-medium ${
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <OverviewTab />}
        {tab === 'Centres' && <CentresTab />}
        {tab === 'Crop rates' && <CropRatesTab />}
        {tab === 'Complaints' && <ComplaintsTab />}
        {tab === 'Staff' && <StaffTab />}
      </div>
    </div>
  );
}
