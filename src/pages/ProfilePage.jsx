import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { restaurant, employee, logout } = useStore();
  const [assignedTables, setAssignedTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const role = employee?.role || 'employee';
  const employeeName = employee?.name || 'Staff';
  const restaurantName = restaurant?.name || 'Restaurant';
  const restaurantId = restaurant?._id || restaurant?.id || employee?.restaurant;
  const employeeId = employee?.id || employee?._id;

  // Load assigned tables for waiters
  useEffect(() => {
    if (role !== 'waiter' || !restaurantId) return;

    setLoadingTables(true);
    api.get(`/api/restaurants/${restaurantId}/tables`)
      .then((res) => {
        if (res.data?.success) {
          const allTables = res.data.data || [];
          const filtered = allTables.filter((table) => {
            const assignedId = table.assignedWaiter?.id || table.assignedWaiter?._id || table.assignedWaiter;
            return assignedId && employeeId && assignedId.toString() === employeeId.toString();
          });
          setAssignedTables(filtered);
        }
      })
      .catch((err) => console.error('🔥 Error fetching tables on profile:', err))
      .finally(() => setLoadingTables(false));
  }, [role, restaurantId, employeeId]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6 animate-fade-in max-w-md mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900">Employee Profile</h1>
          <p className="text-xs text-slate-500 mt-0.5">Your operational profile details</p>
        </div>

        {/* Profile Card */}
        <div className="glass bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
          {/* Avatar Icon */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-slate-100 border border-slate-200 uppercase" style={{ color: 'var(--brand-primary)' }}>
              {employeeName[0]}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{employeeName}</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider mt-1 inline-block capitalize">
                {role}
              </span>
            </div>
          </div>

          {/* Details list */}
          <div className="border-t border-slate-100 pt-4 flex flex-col gap-3.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Restaurant</span>
              <span className="font-bold text-slate-900">{restaurantName}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Account Status</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Active
              </span>
            </div>

            {/* Assigned Tables for Waiter */}
            {role === 'waiter' && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assigned Tables</span>
                {loadingTables ? (
                  <span className="text-xs text-slate-400">Loading tables...</span>
                ) : assignedTables.length === 0 ? (
                  <span className="text-xs text-slate-400">No tables assigned</span>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {assignedTables.map((table) => (
                      <span key={table.id} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
                        {table.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <p className="text-center text-xs text-slate-400 px-4 leading-normal">
          Profile settings and credentials management belong to the Owner Dashboard. Contact your manager to update your role or table assignments.
        </p>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 mt-2 rounded-2xl py-3 text-sm font-bold transition-all bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </EmployeeLayout>
  );
}
