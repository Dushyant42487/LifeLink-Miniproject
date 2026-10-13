import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { Droplet, Lock, Mail, Users, Building2, Landmark, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as UserRole) || 'donor';

  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to appropriate role dashboard
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'donor') navigate('/donor/dashboard', { replace: true });
      else if (user.role === 'hospital') navigate('/hospital/dashboard', { replace: true });
      else if (user.role === 'blood_bank') navigate('/blood-bank/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email, password, role);
    setLoading(false);

    if (res.success && res.user) {
      const verifiedRole = res.user.role;
      if (verifiedRole === 'donor') navigate('/donor/dashboard');
      else if (verifiedRole === 'hospital') navigate('/hospital/dashboard');
      else if (verifiedRole === 'blood_bank') navigate('/blood-bank/dashboard');
      else navigate('/');
    } else {
      setError(res.error || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
            <Droplet className="w-7 h-7 fill-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          Sign in to LifeLink
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Access your role-based blood coordination portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-200 sm:rounded-2xl sm:px-10">
          
          {/* Role Selector Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Your Portal Role</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleRoleChange('donor')}
                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                  role === 'donor' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Donor</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('hospital')}
                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center space-y-1 transition-all ${
                  role === 'hospital' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Hospital</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('blood_bank')}
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === 'donor' ? 'donor@example.com' : role === 'hospital' ? 'hospital@example.com' : 'bloodbank@example.com'}
                  className="block w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all flex justify-center items-center cursor-pointer"
            >
              {loading ? 'Authenticating...' : `Sign In to ${role === 'donor' ? 'Donor Portal' : role === 'hospital' ? 'Hospital Portal' : 'Blood Bank Portal'}`}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to={`/register?role=${role}`} className="font-bold text-rose-600 hover:underline">
              Register here
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};
