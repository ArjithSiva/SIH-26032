import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './../components/SearchableSelect.jsx';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DAY_LABELS = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

function CentreCard({ c }) {
  return (
    <div className="card">
      <p className="font-semibold">{c.name} <span className="text-small text-muted">({c.codePrefix})</span></p>
      <p className="text-p2 text-muted">{c.village}, {c.taluk}, {c.district}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-p2 sm:grid-cols-3">
        <p><span className="text-muted">Timings:</span> {c.openingTime}–{c.closingTime}</p>
        <p><span className="text-muted">Slot length:</span> {c.slotDurationMinutes} min</p>
        <p><span className="text-muted">Queue limit:</span> {c.capacityPerSlot}/slot</p>
      </div>
      <p className="mt-2 text-p2">
        <span className="text-muted">Working days:</span>{' '}
        {(c.workingDays || []).map((d) => DAY_LABELS[d]).join(', ') || 'Every day'}
      </p>
      <p className="mt-1 text-p2">
        <span className="text-muted">Crops accepted:</span>{' '}
        {c.crops?.length
          ? c.crops.map((crop) => `${crop.name}${crop.maxQuantity ? ` (max ${crop.maxQuantity})` : ''}`).join(', ')
          : '—'}
      </p>
    </div>
  );
}

export default function CentreSchedules() {
  const { session } = useAuth();
  const isFarmer = session?.role === 'farmer';

  const [myCentres, setMyCentres] = useState([]);
  const [centres, setCentres] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isFarmer) {
      const preferredIds = (session.profile.preferredCentres || []).map((c) => (typeof c === 'string' ? c : c._id));
      if (preferredIds.length) {
        api.get('/centres', { params: { ids: preferredIds.join(',') } }).then(({ data }) => setMyCentres(data));
      }
    }
  }, [isFarmer, session]);

  useEffect(() => {
    api.get('/centres', { params: { district: district || undefined } }).then(({ data }) => setCentres(data));
  }, [district]);
  useEffect(() => {
    api.get('/centres/districts').then(({ data }) => setDistricts(data));
  }, []);

  const myCentreIds = useMemo(() => new Set(myCentres.map((c) => c._id)), [myCentres]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = centres.filter((c) => !myCentreIds.has(c._id));
    if (!q) return pool.slice(0, 60);
    return pool.filter((c) => c.name.toLowerCase().includes(q) || c.village?.toLowerCase().includes(q)).slice(0, 60);
  }, [centres, search, myCentreIds]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 animate-fade-in">
      <h1 className="text-h1">Procurement centre schedules</h1>
      <p className="mt-1 text-p2 text-muted">Timings, working days and crops accepted at each open centre.</p>

      {isFarmer && myCentres.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">Your selected centres</h2>
          <div className="space-y-3">
            {myCentres.map((c) => <CentreCard key={c._id} c={c} />)}
          </div>
        </div>
      )}

      <div className="mt-6">
        {isFarmer && myCentres.length > 0 && <h2 className="mb-2 text-p2 font-semibold text-muted">Find another centre</h2>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <SearchableSelect
              label="District"
              options={['All districts', ...districts]}
              value={district || 'All districts'}
              onChange={(v) => setDistrict(v === 'All districts' ? '' : v)}
            />
          </div>
          <div className="flex-1">
            <label className="field-label">Search by name or village</label>
            <input className="field-input" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <p className="mt-3 text-small text-muted">
          {centres.length} centre(s){filtered.length < centres.length ? ` · showing first ${filtered.length}` : ''}
        </p>

        <div className="mt-3 space-y-3">
          {filtered.map((c) => <CentreCard key={c._id} c={c} />)}
          {filtered.length === 0 && <p className="text-p2 text-muted">No centres match this filter.</p>}
        </div>
      </div>
    </div>
  );
}
