import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, BloodGroup } from '../../types';
import { Droplet, Users, Building2, Landmark, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as UserRole) || 'donor';

  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Donor fields
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');

  // Facility fields (Hospital / Blood Bank)
  const [facilityName, setFacilityName] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const { user, loading: authLoading, register } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to appropriate role dashboard
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'donor') navigate('/donor/dashboard', { replace: true });
      else if (user.role === 'hospital') navigate('/hospital/dashboard', { replace: true });
      else if (user.role === 'blood_bank') navigate('/blood-bank/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    let payload: any = { email: email.trim(), password };

    if (role === 'donor') {
      if (!name.trim()) {
        setError('Full name is required for donor registration.');
        return;
      }
      payload = {
        ...payload,
        name: name.trim(),
        bloodGroup,
        dob: dob || undefined,
        gender: gender || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        emergencyContact: emergName.trim() ? { name: emergName.trim(), phone: emergPhone.trim(), relation: 'Family' } : undefined
      };
    } else if (role === 'hospital') {
      if (!facilityName.trim() || !registrationId.trim()) {
        setError('Hospital name and license ID are required.');
        return;
      }
      payload = {
        ...payload,
        hospitalName: facilityName.trim(),
        licenseId: registrationId.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined
      };
    } else if (role === 'blood_bank') {
      if (!facilityName.trim() || !registrationId.trim()) {
        setError('Blood bank name and registration ID are required.');
        return;
      }
      payload = {
        ...payload,
        bloodBankName: facilityName.trim(),
        registrationId: registrationId.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined
      };
    }

    setLoading(true);
    const res = await register(role, payload);
    setLoading(false);

    if (res.success && res.user) {
      const verifiedRole = res.user.role;
      if (verifiedRole === 'donor') navigate('/donor/dashboard');
      else if (verifiedRole === 'hospital') navigate('/hospital/dashboard');
      else if (verifiedRole === 'blood_bank') navigate('/blood-bank/dashboard');
      else navigate('/');
    } else {
      setError(res.error || 'Registration failed. Please review your input.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
            <Droplet className="w-7 h-7 fill-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          Create LifeLink Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Join the synchronized regional blood management network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200 sm:rounded-2xl sm:px-10">
          
          {/* Role Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registering As</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setRole('donor')}
                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                  role === 'donor' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Donor</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('hospital')}
                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                  role === 'hospital' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Hospital</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('blood_bank')}
                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                  role === 'blood_bank' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Blood Bank</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {/* Common Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@domain.org"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>
            </div>

            {/* DYNAMIC ROLE SPECIFIC FIELDS */}
            {role === 'donor' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Mercer"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group *</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">DOB</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </>
            )}

            {(role === 'hospital' || role === 'blood_bank') && (
              <>
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {role === 'hospital' ? 'Hospital Name *' : 'Blood Bank Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      placeholder={role === 'hospital' ? 'e.g. Apollo Memorial Hospital' : 'e.g. City Central Blood Center'}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Registration / License ID *</label>
                      <input
                        type="text"
                        required
                        value={registrationId}
                        onChange={(e) => setRegistrationId(e.target.value)}
                        placeholder="LIC-2026-99"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Dr. John Smith"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Hotline</label>
                      <input
                        type="text"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  {role === 'hospital' && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                      <strong>Note:</strong> Hospital accounts are created in a <em>Pending Verification</em> state until license credentials are approved by blood bank administrators.
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
            >
              {loading ? 'Registering...' : `Complete Registration (${role.replace('_', ' ')})`}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to={`/login?role=${role}`} className="font-bold text-rose-600 hover:underline">
              Sign in
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};
