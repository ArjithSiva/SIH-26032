import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import api, { API_BASE_URL } from '../../api/api.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { MotionDiv, sectionMotion } from '../../components/motion.js';

const FILE_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

function Section({ title, children, delayIndex = 0 }) {
  return (
    <MotionDiv className="card" {...sectionMotion} transition={{ ...sectionMotion.transition, delay: delayIndex * 0.08 }}>
      <h2 className="text-h3">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </MotionDiv>
  );
}

export default function FarmerProfile() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const farmerId = session?.profile?._id;
  const [farmer, setFarmer] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (farmerId) api.get(`/farmers/${farmerId}`).then(({ data }) => setFarmer(data));
  }, [farmerId]);

  function flash(text, isError = false) {
    setMessage(isError ? '' : text);
    setError(isError ? text : '');
    setTimeout(() => { setMessage(''); setError(''); }, 3000);
  }

  async function reload() {
    const { data } = await api.get(`/farmers/${farmerId}`);
    setFarmer(data);
  }

  if (!farmer) return <div className="mx-auto max-w-2xl px-5 py-10 text-p2 text-muted">{t('profile.loading')}</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <h1 className="text-h1 animate-fade-in">{t('profile.title')}</h1>

      <PersonalDetailsSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} t={t} delayIndex={0} />
      <LocationSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} t={t} delayIndex={1} />
      <LandDetailsSection farmer={farmer} t={t} delayIndex={2} />
      <BankDetailsSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} t={t} delayIndex={3} />

      {message && <p className="text-p2 text-success">{message}</p>}
      {error && <p className="text-p2 text-danger">{error}</p>}
    </div>
  );
}

function PersonalDetailsSection({ farmer, farmerId, onSaved, onFlash, t, delayIndex }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(farmer.name || '');
  const [gender, setGender] = useState(farmer.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState(farmer.dateOfBirth ? farmer.dateOfBirth.slice(0, 10) : '');

  async function save(e) {
    e.preventDefault();
    try {
      await api.put(`/farmers/${farmerId}/personal`, { name, gender, dateOfBirth });
      setEditing(false);
      onSaved();
      onFlash(t('profile.personal.saved'));
    } catch (err) {
      onFlash(err.response?.data?.message || t('profile.error.saveFailed'), true);
    }
  }

  return (
    <Section title={t('profile.personal.heading')} delayIndex={delayIndex}>
      {!editing ? (
        <>
          <p><span className="text-muted">{t('profile.personal.name')}: </span>{farmer.name}</p>
          <p><span className="text-muted">{t('profile.personal.mobile')}: </span>{farmer.mobileNumber}</p>
          <p><span className="text-muted">{t('profile.personal.gender')}: </span>{farmer.gender || '-'}</p>
          <p><span className="text-muted">{t('profile.personal.dob')}: </span>{farmer.dateOfBirth ? farmer.dateOfBirth.slice(0, 10) : '-'}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">{t('common.edit')}</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.personal.name')} required />
          <select className="field-input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{t('profile.personal.preferNotToSay')}</option>
            <option value="male">{t('profile.personal.male')}</option>
            <option value="female">{t('profile.personal.female')}</option>
            <option value="other">{t('profile.personal.otherGender')}</option>
          </select>
          <input type="date" className="field-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">{t('common.save')}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </Section>
  );
}

function LocationSection({ farmer, farmerId, onSaved, onFlash, t, delayIndex }) {
  const [editing, setEditing] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [villages, setVillages] = useState([]);
  const [district, setDistrict] = useState(farmer.district || '');
  const [taluk, setTaluk] = useState(farmer.taluk || '');
  const [village, setVillage] = useState(farmer.village || '');
  const [pincode, setPincode] = useState(farmer.pincode || '');

  useEffect(() => { if (editing) api.get('/geo/districts').then(({ data }) => setDistricts(data)); }, [editing]);
  useEffect(() => { if (district) api.get('/geo/taluks', { params: { district } }).then(({ data }) => setTaluks(data)); }, [district]);
  useEffect(() => { if (district && taluk) api.get('/geo/villages', { params: { district, taluk } }).then(({ data }) => setVillages(data)); }, [district, taluk]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.put(`/farmers/${farmerId}/location`, { state: 'Tamil Nadu', district, taluk, village, pincode });
      setEditing(false);
      onSaved();
      onFlash(t('profile.location.saved'));
    } catch (err) {
      onFlash(err.response?.data?.message || t('profile.error.saveFailed'), true);
    }
  }

  return (
    <Section title={t('profile.location.heading')} delayIndex={delayIndex}>
      {!editing ? (
        <>
          <p>{[farmer.village, farmer.taluk, farmer.district].filter(Boolean).join(', ') || t('profile.notSet')}</p>
          <p className="text-muted">{t('profile.location.pincode')}: {farmer.pincode || '-'}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">{t('common.edit')}</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <SearchableSelect label={t('profile.location.district')} options={districts} value={district} onChange={(v) => { setDistrict(v); setTaluk(''); setVillage(''); }} />
          <SearchableSelect label={t('profile.location.taluk')} options={taluks} value={taluk} onChange={(v) => { setTaluk(v); setVillage(''); }} disabled={!district} allowCustom />
          <SearchableSelect label={t('profile.location.village')} options={villages} value={village} onChange={setVillage} disabled={!taluk} allowCustom />
          <input required pattern="[0-9]{6}" maxLength={6} className="field-input" placeholder={t('profile.location.pincode')} value={pincode} onChange={(e) => setPincode(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">{t('common.save')}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </Section>
  );
}

// Land records intentionally read-only here for now: changing land tenure
// requires re-uploading the lease/rental agreement, which is a bigger form
// than the other sections - shown here for visibility, editable for now
// only via re-running the registration land step.
function LandDetailsSection({ farmer, t, delayIndex }) {
  return (
    <Section title={t('profile.land.heading')} delayIndex={delayIndex}>
      <p>{[farmer.landVillage, farmer.landTaluk, farmer.landDistrict].filter(Boolean).join(', ') || t('profile.notSet')}</p>
      <p className="text-muted">{t('profile.land.patta')}: {farmer.pattaNumber || '-'} &nbsp; {t('profile.land.surveyChitta')}: {farmer.chittaNumber || '-'}</p>
      <p className="text-muted">{t('profile.land.tenure')}: {farmer.landTenure || 'owned'}</p>
      {farmer.leaseDocumentPath && (
        <a href={`${FILE_ORIGIN}${farmer.leaseDocumentPath}`} target="_blank" rel="noreferrer" className="text-p2 text-primary underline">
          {t('profile.land.viewLeaseDocument')}
        </a>
      )}
    </Section>
  );
}

function BankDetailsSection({ farmer, farmerId, onSaved, onFlash, t, delayIndex }) {
  const [editing, setEditing] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState(farmer.bankDetails?.accountHolderName || '');
  const [bankName, setBankName] = useState(farmer.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(farmer.bankDetails?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(farmer.bankDetails?.ifscCode || '');

  async function save(e) {
    e.preventDefault();
    try {
      await api.put(`/farmers/${farmerId}/bank-details`, { accountHolderName, bankName, accountNumber, ifscCode });
      setEditing(false);
      onSaved();
      onFlash(t('profile.bank.saved'));
    } catch (err) {
      onFlash(err.response?.data?.message || t('profile.error.saveFailed'), true);
    }
  }

  return (
    <Section title={t('profile.bank.heading')} delayIndex={delayIndex}>
      {!editing ? (
        <>
          <p>{farmer.bankDetails?.accountHolderName || t('profile.notSet')}</p>
          <p className="text-muted">{farmer.bankDetails?.bankName} {farmer.bankDetails?.accountNumber ? `••••${String(farmer.bankDetails.accountNumber).slice(-4)}` : ''}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">{t('common.edit')}</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <input required className="field-input" placeholder={t('profile.bank.accountHolderName')} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
          <input required className="field-input" placeholder={t('profile.bank.bankName')} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input required className="field-input" placeholder={t('profile.bank.accountNumber')} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <input required className="field-input" placeholder={t('profile.bank.ifsc')} value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">{t('common.save')}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </Section>
  );
}
