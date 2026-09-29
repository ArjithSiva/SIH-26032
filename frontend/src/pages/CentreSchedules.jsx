import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './../components/SearchableSelect.jsx';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { centreMapUrl } from '../utils/centreMap.js';
import { MotionDiv, cardMotion } from '../components/motion.js';

const DAY_KEYS = {
  MO: 'day.mon', TU: 'day.tue', WE: 'day.wed', TH: 'day.thu',
  FR: 'day.fri', SA: 'day.sat', SU: 'day.sun',
};

function CentreCard({ c, t }) {
  const mapUrl = centreMapUrl(c);
  return (
    <MotionDiv className="card" {...cardMotion}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{c.name} <span className="text-small text-muted">({c.codePrefix})</span></p>
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="shrink-0 whitespace-nowrap text-small font-bold text-primary underline">
            📍 {t('common.viewOnMap')}
          </a>
        )}
      </div>
      <p className="text-p2 text-muted">{c.village}, {c.taluk}, {c.district}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-p2 sm:grid-cols-3">
        <p><span className="text-muted">{t('centreSchedules.timings')}:</span> {c.openingTime}–{c.closingTime}</p>
        <p><span className="text-muted">{t('centreSchedules.slotLength')}:</span> {c.slotDurationMinutes} {t('common.min')}</p>
        <p><span className="text-muted">{t('centreSchedules.queueLimit')}:</span> {c.capacityPerSlot}/{t('common.slot')}</p>
      </div>
      <p className="mt-2 text-p2">
        <span className="text-muted">{t('centreSchedules.workingDays')}:</span>{' '}
        {(c.workingDays || []).map((d) => t(DAY_KEYS[d])).join(', ') || t('centreSchedules.everyDay')}
      </p>
      <p className="mt-1 text-p2">
        <span className="text-muted">{t('centreSchedules.cropsAccepted')}:</span>{' '}
        {c.crops?.length
          ? c.crops.map((crop) => `${crop.name}${crop.maxQuantity ? ` (${t('centreSchedules.max')} ${crop.maxQuantity})` : ''}`).join(', ')
          : '—'}
      </p>
    </MotionDiv>
  );
}

export default function CentreSchedules() {
  const { session } = useAuth();
  const { t } = useLanguage();
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

  const allDistrictsLabel = t('centreSchedules.allDistricts');

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 animate-fade-in">
      <h1 className="text-h1">{t('centreSchedules.title')}</h1>
      <p className="mt-1 text-p2 text-muted">{t('centreSchedules.subtitle')}</p>

      {isFarmer && myCentres.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">{t('centreSchedules.yourCentres')}</h2>
          <div className="space-y-3">
            {myCentres.map((c) => <CentreCard key={c._id} c={c} t={t} />)}
          </div>
        </div>
      )}

      <div className="mt-6">
        {isFarmer && myCentres.length > 0 && <h2 className="mb-2 text-p2 font-semibold text-muted">{t('centreSchedules.findAnother')}</h2>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <SearchableSelect
              label={t('centreSchedules.districtLabel')}
              options={[allDistrictsLabel, ...districts]}
              value={district || allDistrictsLabel}
              onChange={(v) => setDistrict(v === allDistrictsLabel ? '' : v)}
            />
          </div>
          <div className="flex-1">
            <label className="field-label">{t('centreSchedules.searchLabel')}</label>
            <input className="field-input" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <p className="mt-3 text-small text-muted">
          {centres.length} {t('centreSchedules.centresCount')}{filtered.length < centres.length ? ` · ${t('centreSchedules.showingFirst')} ${filtered.length}` : ''}
        </p>

        <div className="mt-3 space-y-3">
          {filtered.map((c) => <CentreCard key={c._id} c={c} t={t} />)}
          {filtered.length === 0 && <p className="text-p2 text-muted">{t('centreSchedules.noMatches')}</p>}
        </div>
      </div>
    </div>
  );
}
