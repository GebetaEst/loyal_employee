import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useStore } from '../store/useStore';

const EyeIcon = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin-slow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

export default function LoginForm({ employeeId }) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { setAuth, setRestaurant } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Please enter your password.'); return; }
    if (!employeeId) { setError('No employee ID found. Please scan your QR code.'); return; }
    console.log(employeeId);

    setError('');
    setLoading(true);

    try {
      console.log('Employee ID:', employeeId);
      // 1. Login
      const loginRes = await api.post('/api/restaurants/employee/login', { employeeId, password });
      console.log('Login response:', loginRes.data);
      const { token, employee } = loginRes.data;
      setAuth({ token, employee });

      // 2. Fetch restaurant for this employee
      const restRes = await api.get('/api/restaurants/employee/me');
      const restaurant = restRes.data;
      // 3. Fetch menu details using the restaurant ID
      let menu = [];
      try {
        const menuRes = await api.get(`/api/menus/restaurant/${restaurant._id}`);
        menu = menuRes.data || [];
      } catch (err) {
        console.error('Failed to pre-fetch menu details:', err);
      }

      setRestaurant(restaurant, menu);

      // Redirect based on role
      if (employee.role === 'chef') {
        navigate('/profile', { replace: true });
      } else if (employee.role === 'waiter') {
        navigate('/orders', { replace: true });
      } else if (employee.role === 'cashier') {
        navigate('/payments', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed. Check your password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full animate-fade-in-up">
      {/* Password Field */}
      <div className="relative">
        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
          Password
        </label>
        <div className="relative">
          <input
            id="password-input"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Enter your password"
            className="input-field pr-12"
            autoComplete="current-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            tabIndex={-1}
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPass} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        id="login-btn"
        type="submit"
        disabled={loading || !password}
        className="btn-primary mt-1"
      >
        {loading ? (
          <>
            <SpinnerIcon />
            Signing in…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Sign In
          </>
        )}
      </button>
    </form>
  );
}
