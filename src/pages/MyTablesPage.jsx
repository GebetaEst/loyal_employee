import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';

export default function MyTablesPage() {
  const { restaurant, employee } = useStore();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const restaurantId = restaurant?._id || restaurant?.id || employee?.restaurant;

  const fetchTables = useCallback(async () => {
    if (!restaurantId) {
      setError('Restaurant context missing. Please log in again.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const res = await api.get(`/api/restaurants/${restaurantId}/tables`);
      if (res.data?.success) {
        setTables(res.data.data || []);
      } else {
        setError('Failed to load tables.');
      }
    } catch (err) {
      console.error('🔥 Error fetching tables:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to sync tables.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const employeeId = employee?.id || employee?._id;

  // Filter tables assigned to the logged-in waiter
  const assignedTables = tables.filter((table) => {
    const assignedId = table.assignedWaiter?.id || table.assignedWaiter?._id || table.assignedWaiter;
    return assignedId && employeeId && assignedId.toString() === employeeId.toString();
  });

  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-black text-white">My Tables</h1>
          <p className="text-xs text-white/40">Read-only list of tables assigned to you</p>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner / Skeletons */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass rounded-3xl p-5 border border-white/5 flex flex-col gap-2">
                <div className="skeleton h-6 w-1/2" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : assignedTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-3xl">
              🪑
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Assigned Tables</h3>
              <p className="text-xs text-white/40 mt-1 max-w-[260px]">
                You haven't been assigned to any tables. Please contact your restaurant manager or owner.
              </p>
            </div>
          </div>
        ) : (
          /* Grid list of tables */
          <div className="grid grid-cols-2 gap-4">
            {assignedTables.map((table) => (
              <div
                key={table.id}
                className="glass rounded-3xl p-5 border border-white/10 flex flex-col gap-2 transition-all hover:scale-[1.01]"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Table Code: {table.code}</span>
                <h3 className="text-lg font-black text-white">{table.name}</h3>
                {table.description && (
                  <p className="text-xs text-white/55 leading-relaxed">{table.description}</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-green-400 bg-green-500/5 border border-green-500/15 rounded-lg px-2.5 py-1 self-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Assigned Waiter: Active
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
