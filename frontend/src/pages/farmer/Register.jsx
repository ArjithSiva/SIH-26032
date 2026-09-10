import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import CentreMultiSelect from '../../components/CentreMultiSelect.jsx';
import { sortByProximity, recommendedCentreIds } from '../../utils/centreProximity.js';

const STEPS = ['Mobile', 'Verify', 'Location', 'Aadhar', 'Land records', 'Centres'];

const POLICY_TEXT = `By registering, you confirm that the details you provide (mobile number, Aadhar,
Patta/Chitta land records and bank details) are true and belong to you. This information will be used
solely to verify your identity, process your procurement bookings, and transfer payments for crops
sold through this platform. Your details will not be shared outside the procurement department except
as required for payment processing or by law. Providing false land or identity documents may result in
your registration being cancelled and a booking being disqualified.`;

// Maps our internal step keys onto the numbered progress bar above the form.
const STEP_INDEX = {
  basic: 0,
  otp: 1,
  location: 2,
  aadhar_form: 3,
  aadhar_otp: 3,
  land: 4,
  policy: 4,
  centres: 5,
};

function StepHeader({ step }) {
  const index = STEP_INDEX[step] ?? 0;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-small font-semibold transition-colors duration-300 ${
                i < index ? 'bg-primary text-white' : i === index ? 'bg-primary text-white ring-4 ring-primary-light' : 'bg-border text-muted'
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 transition-colors duration-300 ${i < index ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-small text-muted">
        Step {index + 1} of {STEPS.length}: {STEPS[index]}
      </p>
    </div>
  );
}

export default function FarmerRegister() {
  const navigate = useNavigate();
  const { session, login } = useAuth();
  const { joinFarmerRoom } = useSocket();

  const [step, setStep] = useState('basic'); // basic | otp | location | aadhar_form | aadhar_otp | land | policy | centres
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Step 1: name + mobile + gender + DOB ---
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // --- Step 2: mobile OTP ---
  const [devCode, setDevCode] = useState(null);
  const [otp, setOtp] = useState('');

  // farmer id/profile once created; token is stored via AuthContext once verified
  const [farmerId, setFarmerId] = useState(null);

  // --- Step 3: location ---
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [taluks, setTaluks] = useState([]);
  const [taluk, setTaluk] = useState('');
  const [villages, setVillages] = useState([]);
  const [village, setVillage] = useState('');
  const [pincode, setPincode] = useState('');

  // --- Step 4: Aadhar (its own page) ---
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharOtp, setAadharOtp] = useState('');
  const [aadharDevCode, setAadharDevCode] = useState(null);

  // --- Step 5: Land records (its own page) + policy ---
  // The land's own District/Taluk/Village - separate from the farmer's
  // residence address above, since the land may be elsewhere.
  const [landDistrict, setLandDistrict] = useState('');
  const [landTaluks, setLandTaluks] = useState([]);
  const [landTaluk, setLandTaluk] = useState('');
  const [landVillages, setLandVillages] = useState([]);
  const [landVillage, setLandVillage] = useState('');
  const [pattaNumber, setPattaNumber] = useState('');
  const [chittaNumber, setChittaNumber] = useState('');
  const [landTenure, setLandTenure] = useState('owned'); // owned | leased | rented
  const [leaseDocument, setLeaseDocument] = useState(null); // File, only for leased/rented
  const [policyChecked, setPolicyChecked] = useState(false);

  // --- Step 6: preferred centres ---
  const [allCentres, setAllCentres] = useState([]);
  const [selectedCentreIds, setSelectedCentreIds] = useState([]);

  useEffect(() => {
    api.get('/geo/districts').then(({ data }) => setDistricts(data)).catch(() => setError('Could not load districts'));
  }, []);

  // Resume an already-logged-in-but-incomplete registration (e.g. the
  // farmer closed the tab partway through) at the right step instead of
  // restarting from the mobile number.
  useEffect(() => {
    if (!session || session.role !== 'farmer') return;
    const profile = session.profile;
    setFarmerId(profile._id);

    if (!profile.district || !profile.taluk || !profile.village || !profile.pincode) {
      setStep('location');
      return;
    }
    setDistrict(profile.district);
    setTaluk(profile.taluk);
    setVillage(profile.village);
    setPincode(profile.pincode || '');

    if (!profile.aadharVerified) {
      setAadharNumber(profile.aadharNumber || '');
      setStep('aadhar_form');
      return;
    }
    if (!profile.landDistrict || !profile.landTaluk || !profile.landVillage || !profile.pattaNumber || !profile.chittaNumber || !profile.policyAccepted) {
      setLandDistrict(profile.landDistrict || '');
      setLandTaluk(profile.landTaluk || '');
      setLandVillage(profile.landVillage || '');
      setPattaNumber(profile.pattaNumber || '');
      setChittaNumber(profile.chittaNumber || '');
      setLandTenure(profile.landTenure || 'owned');
      setStep('land');
      return;
    }
    if (!profile.preferredCentres || profile.preferredCentres.length === 0) {
      api.get('/centres').then(({ data }) => {
        const sorted = sortByProximity(data, profile);
        setAllCentres(sorted);
        setSelectedCentreIds(recommendedCentreIds(sorted, profile));
      });
      setStep('centres');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!district) { setTaluks([]); return; }
    api.get('/geo/taluks', { params: { district } }).then(({ data }) => setTaluks(data)).catch(() => setTaluks([]));
  }, [district]);

  useEffect(() => {
    if (!district || !taluk) { setVillages([]); return; }
    api.get('/geo/villages', { params: { district, taluk } }).then(({ data }) => setVillages(data)).catch(() => setVillages([]));
  }, [district, taluk]);

  // Same district -> taluk -> village cascade as the residence fields
  // above, but independent - the land can be in a different area.
  useEffect(() => {
    if (!landDistrict) { setLandTaluks([]); return; }
    api.get('/geo/taluks', { params: { district: landDistrict } }).then(({ data }) => setLandTaluks(data)).catch(() => setLandTaluks([]));
  }, [landDistrict]);

  useEffect(() => {
    if (!landDistrict || !landTaluk) { setLandVillages([]); return; }
    api.get('/geo/villages', { params: { district: landDistrict, taluk: landTaluk } }).then(({ data }) => setLandVillages(data)).catch(() => setLandVillages([]));
  }, [landDistrict, landTaluk]);

  // --- Step 1 -> 2: register + send mobile OTP ---
  async function handleBasicSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/farmer/register', { name, mobileNumber, gender: gender || undefined, dateOfBirth: dateOfBirth || undefined });
      setFarmerId(data.farmerId);
      setDevCode(data.devCode || null);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 2: verify mobile OTP, log in, move to location step ---
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/farmer/verify-otp', { mobileNumber, code: otp });
      login(data.token, data.farmer, 'farmer');
      joinFarmerRoom(data.farmer._id);
      setStep('location');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 3: save location ---
  async function handleLocationSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.put(`/farmers/${farmerId}/location`, { state: 'Tamil Nadu', district, taluk, village, pincode });
      setStep('aadhar_form');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save location');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 4a: save Aadhar number, request OTP ---
  async function handleAadharFormSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.put(`/farmers/${farmerId}/aadhar`, { aadharNumber });
      const { data } = await api.post(`/farmers/${farmerId}/kyc/request-otp`);
      setAadharDevCode(data.devCode || null);
      setStep('aadhar_otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save Aadhar number');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 4b: verify Aadhar OTP, move to land records page ---
  async function handleAadharOtpSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/farmers/${farmerId}/kyc/verify-otp`, { code: aadharOtp });
      setStep('land');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 5: save land district/taluk/village, Patta/Chitta and tenure, move to policy ---
  async function handleLandRecordsSubmit(e) {
    e.preventDefault();
    setError('');
    if (landTenure !== 'owned' && !leaseDocument) {
      setError('Please upload your lease/rental agreement to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('landDistrict', landDistrict);
      form.append('landTaluk', landTaluk);
      form.append('landVillage', landVillage);
      form.append('pattaNumber', pattaNumber);
      form.append('chittaNumber', chittaNumber);
      form.append('landTenure', landTenure);
      if (leaseDocument) form.append('leaseDocument', leaseDocument);

      await api.put(`/farmers/${farmerId}/land-records`, form);
      setStep('policy');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save land record details');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 5b: accept policy, load centres for step 6 ---
  async function handlePolicyAccept() {
    setError('');
    setSubmitting(true);
    try {
      await api.put(`/farmers/${farmerId}/policy`, { accepted: true });
      const { data } = await api.get('/centres');
      const location = { district, taluk, village };
      const sorted = sortByProximity(data, location);
      setAllCentres(sorted);
      setSelectedCentreIds(recommendedCentreIds(sorted, location));
      setStep('centres');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record policy acceptance');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 6: save preferred centres, done ---
  async function handleCentresSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await api.put(`/farmers/${farmerId}/preferred-centres`, { centreIds: selectedCentreIds });
      navigate('/farmer/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save preferred centres');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 animate-fade-in">
      <h1 className="text-h1">Farmer registration</h1>
      <p className="mt-1 text-p2 text-muted">A few short steps to set up your account.</p>

      <div className="card mt-6">
        <StepHeader step={step} />
        {error && <p className="mb-3 text-p2 text-danger">{error}</p>}

        {step === 'basic' && (
          <form onSubmit={handleBasicSubmit} className="animate-slide-up space-y-4">
            <div>
              <label className="field-label">Full name</label>
              <input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Mobile number</label>
              <input
                required
                pattern="[0-9]{10}"
                inputMode="numeric"
                className="field-input"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Gender</label>
                <select className="field-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="field-label">Date of birth</label>
                <input type="date" className="field-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Sending OTP...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="animate-slide-up space-y-4">
            {devCode && (
              <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
                Demo mode: no real SMS is sent. Your OTP is <strong>{devCode}</strong>.
              </p>
            )}
            <div>
              <label className="field-label">Enter OTP sent to {mobileNumber}</label>
              <input required inputMode="numeric" className="field-input" value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Verifying...' : 'Verify & continue'}
            </button>
          </form>
        )}

        {step === 'location' && (
          <form onSubmit={handleLocationSubmit} className="animate-slide-up space-y-4">
            <div>
              <label className="field-label">State</label>
              <input disabled className="field-input" value="Tamil Nadu" />
            </div>
            <SearchableSelect
              label="District"
              options={districts}
              value={district}
              onChange={(v) => { setDistrict(v); setTaluk(''); setVillage(''); }}
              placeholder="Search your district..."
            />
            <SearchableSelect
              label="Taluk"
              options={taluks}
              value={taluk}
              onChange={(v) => { setTaluk(v); setVillage(''); }}
              placeholder={!district ? 'Select a district first' : 'Search or type your taluk...'}
              disabled={!district}
              allowCustom
            />
            <SearchableSelect
              label="Village"
              options={villages}
              value={village}
              onChange={setVillage}
              placeholder={!taluk ? 'Select a taluk first' : 'Search or type your village...'}
              disabled={!taluk}
              allowCustom
            />
            <div>
              <label className="field-label">Pincode</label>
              <input
                required
                pattern="[0-9]{6}"
                inputMode="numeric"
                maxLength={6}
                className="field-input"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
            <button type="submit" disabled={submitting || !district || !taluk || !village || !pincode} className="btn-primary w-full">
              {submitting ? 'Saving...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'aadhar_form' && (
          <form onSubmit={handleAadharFormSubmit} className="animate-slide-up space-y-4">
            <div>
              <label className="field-label">Aadhar number (12 digits)</label>
              <input
                required
                pattern="[0-9]{12}"
                inputMode="numeric"
                maxLength={12}
                className="field-input"
                value={aadharNumber}
                onChange={(e) => setAadharNumber(e.target.value)}
              />
            </div>
            <p className="text-small text-muted">Your Aadhar number will be verified with a one-time code.</p>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Saving...' : 'Send verification code'}
            </button>
          </form>
        )}

        {step === 'aadhar_otp' && (
          <form onSubmit={handleAadharOtpSubmit} className="animate-slide-up space-y-4">
            {aadharDevCode && (
              <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
                Demo mode: no real verification is sent. Your OTP is <strong>{aadharDevCode}</strong>.
              </p>
            )}
            <div>
              <label className="field-label">Enter verification code</label>
              <input required inputMode="numeric" className="field-input" value={aadharOtp} onChange={(e) => setAadharOtp(e.target.value)} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}

        {step === 'land' && (
          <form onSubmit={handleLandRecordsSubmit} className="animate-slide-up space-y-4">
            <p className="text-small text-muted">First, tell us where the land is - it doesn't have to be where you live.</p>
            <SearchableSelect
              label="Land District"
              options={districts}
              value={landDistrict}
              onChange={(v) => { setLandDistrict(v); setLandTaluk(''); setLandVillage(''); }}
              placeholder="Search the land's district..."
            />
            <SearchableSelect
              label="Land Taluk"
              options={landTaluks}
              value={landTaluk}
              onChange={(v) => { setLandTaluk(v); setLandVillage(''); }}
              placeholder={!landDistrict ? 'Select a district first' : 'Search or type the taluk...'}
              disabled={!landDistrict}
              allowCustom
            />
            <SearchableSelect
              label="Land Village"
              options={landVillages}
              value={landVillage}
              onChange={setLandVillage}
              placeholder={!landTaluk ? 'Select a taluk first' : 'Search or type the village...'}
              disabled={!landTaluk}
              allowCustom
            />
            <div>
              <label className="field-label">Patta number</label>
              <input required className="field-input" value={pattaNumber} onChange={(e) => setPattaNumber(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Survey / Chitta number</label>
              <input required className="field-input" value={chittaNumber} onChange={(e) => setChittaNumber(e.target.value)} />
            </div>
            <p className="text-small text-muted">Your Patta and Chitta numbers will be verified against land records.</p>

            <div>
              <label className="field-label">Is this land owned, leased or rented?</label>
              <select
                className="field-input"
                value={landTenure}
                onChange={(e) => { setLandTenure(e.target.value); setLeaseDocument(null); }}
              >
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="rented">Rented</option>
              </select>
            </div>
            {landTenure !== 'owned' && (
              <div className="animate-slide-up">
                <label className="field-label">Upload lease/rental agreement (PDF or photo)</label>
                <input
                  required
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="field-input"
                  onChange={(e) => setLeaseDocument(e.target.files?.[0] || null)}
                />
                <p className="mt-1 text-small text-muted">PDF, JPEG or PNG, up to 5MB.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !landDistrict || !landTaluk || !landVillage}
              className="btn-primary w-full"
            >
              {submitting ? 'Saving...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'policy' && (
          <div className="animate-slide-up space-y-4">
            <div className="max-h-48 overflow-y-auto rounded border border-border bg-paper p-3 text-small text-muted">
              {POLICY_TEXT}
            </div>
            <label className="flex items-start gap-2 text-p2">
              <input type="checkbox" className="mt-1" checked={policyChecked} onChange={(e) => setPolicyChecked(e.target.checked)} />
              I have read and agree to the above policy.
            </label>
            <button type="button" disabled={submitting || !policyChecked} onClick={handlePolicyAccept} className="btn-primary w-full">
              {submitting ? 'Continuing...' : 'Continue'}
            </button>
          </div>
        )}

        {step === 'centres' && (
          <div className="animate-slide-up space-y-4">
            <p className="text-p2 text-muted">
              Centres closest to you are recommended and pre-selected. Search to add or remove any centre.
            </p>
            <CentreMultiSelect centres={allCentres} selectedIds={selectedCentreIds} onChange={setSelectedCentreIds} />
            <button
              type="button"
              disabled={submitting || selectedCentreIds.length === 0}
              onClick={handleCentresSubmit}
              className="btn-primary w-full"
            >
              {submitting ? 'Finishing up...' : 'Finish registration'}
            </button>
          </div>
        )}
      </div>

      {step === 'basic' && (
        <p className="mt-4 text-p2 text-muted">
          Already registered? <Link to="/farmer/login" className="text-primary underline">Log in here</Link>
        </p>
      )}
    </div>
  );
}
