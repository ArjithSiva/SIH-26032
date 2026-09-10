import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { API_BASE_URL } from '../../api/api.js';
import SearchableSelect from '../../components/SearchableSelect.jsx';

const FILE_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

function Section({ title, children }) {
  return (
    <div className="card animate-slide-up">
      <h2 className="text-h3">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export default function FarmerProfile() {
  const { session } = useAuth();
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

  if (!farmer) return <div className="mx-auto max-w-2xl px-5 py-10 text-p2 text-muted">Loading your profile...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <h1 className="text-h1 animate-fade-in">My profile</h1>

      <PersonalDetailsSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} />
      <LocationSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} />
      <LandDetailsSection farmer={farmer} />
      <BankDetailsSection farmer={farmer} farmerId={farmerId} onSaved={reload} onFlash={flash} />

      {message && <p className="text-p2 text-success">{message}</p>}
      {error && <p className="text-p2 text-danger">{error}</p>}
    </div>
  );
}

function PersonalDetailsSection({ farmer, farmerId, onSaved, onFlash }) {
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
      onFlash('Personal details updated.');
    } catch (err) {
      onFlash(err.response?.data?.message || 'Could not save', true);
    }
  }

  return (
    <Section title="Personal details">
      {!editing ? (
        <>
          <p><span className="text-muted">Name: </span>{farmer.name}</p>
          <p><span className="text-muted">Mobile: </span>{farmer.mobileNumber}</p>
          <p><span className="text-muted">Gender: </span>{farmer.gender || '-'}</p>
          <p><span className="text-muted">Date of birth: </span>{farmer.dateOfBirth ? farmer.dateOfBirth.slice(0, 10) : '-'}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">Edit</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <select className="field-input" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input type="date" className="field-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">Cancel</button>
          </div>
        </form>
      )}
    </Section>
  );
}

function LocationSection({ farmer, farmerId, onSaved, onFlash }) {
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
      onFlash('Address updated.');
    } catch (err) {
      onFlash(err.response?.data?.message || 'Could not save', true);
    }
  }

  return (
    <Section title="Residence address">
      {!editing ? (
        <>
          <p>{[farmer.village, farmer.taluk, farmer.district].filter(Boolean).join(', ') || 'Not set'}</p>
          <p className="text-muted">Pincode: {farmer.pincode || '-'}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">Edit</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <SearchableSelect label="District" options={districts} value={district} onChange={(v) => { setDistrict(v); setTaluk(''); setVillage(''); }} />
          <SearchableSelect label="Taluk" options={taluks} value={taluk} onChange={(v) => { setTaluk(v); setVillage(''); }} disabled={!district} allowCustom />
          <SearchableSelect label="Village" options={villages} value={village} onChange={setVillage} disabled={!taluk} allowCustom />
          <input required pattern="[0-9]{6}" maxLength={6} className="field-input" placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">Cancel</button>
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
function LandDetailsSection({ farmer }) {
  return (
    <Section title="Land records">
      <p>{[farmer.landVillage, farmer.landTaluk, farmer.landDistrict].filter(Boolean).join(', ') || 'Not set'}</p>
      <p className="text-muted">Patta: {farmer.pattaNumber || '-'} &nbsp; Survey/Chitta: {farmer.chittaNumber || '-'}</p>
      <p className="text-muted">Tenure: {farmer.landTenure || 'owned'}</p>
      {farmer.leaseDocumentPath && (
        <a href={`${FILE_ORIGIN}${farmer.leaseDocumentPath}`} target="_blank" rel="noreferrer" className="text-p2 text-primary underline">
          View uploaded lease/rental agreement
        </a>
      )}
    </Section>
  );
}

function BankDetailsSection({ farmer, farmerId, onSaved, onFlash }) {
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
      onFlash('Bank details updated.');
    } catch (err) {
      onFlash(err.response?.data?.message || 'Could not save', true);
    }
  }

  return (
    <Section title="Bank details">
      {!editing ? (
        <>
          <p>{farmer.bankDetails?.accountHolderName || 'Not set'}</p>
          <p className="text-muted">{farmer.bankDetails?.bankName} {farmer.bankDetails?.accountNumber ? `••••${String(farmer.bankDetails.accountNumber).slice(-4)}` : ''}</p>
          <button type="button" onClick={() => setEditing(true)} className="btn-outline text-small">Edit</button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <input required className="field-input" placeholder="Account holder name" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
          <input required className="field-input" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input required className="field-input" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <input required className="field-input" placeholder="IFSC code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-small">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline text-small">Cancel</button>
          </div>
        </form>
      )}
    </Section>
  );
}
