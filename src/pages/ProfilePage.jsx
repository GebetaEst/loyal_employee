import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import EmployeeLayout from '../components/EmployeeLayout';
import { useStore } from '../store/useStore';

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden">
          <div className="skeleton h-28 w-full" />
          <div className="p-3 flex flex-col gap-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuItem({ item }) {
  return (
    <div className="glass rounded-2xl overflow-hidden transition-all hover:scale-[1.01] flex gap-3 p-3">
      <div className="flex-shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl" loading="lazy" />
        ) : (
          <div className="w-16 h-16 flex items-center justify-center text-3xl rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            🍽️
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/90 line-clamp-1">{item.name}</p>
        {item.price != null && (
          <p className="text-base font-bold mt-0.5" style={{ color: 'var(--brand-primary)' }}>
            ETB {Number(item.price).toFixed(2)}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-snug">{item.description}</p>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { restaurant, employee, menu: storedMenu, logout } = useStore();
  const [assignedTables, setAssignedTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const role = employee?.role || 'employee';
  const employeeName = employee?.name || 'Staff';
  const restaurantName = restaurant?.name || 'Restaurant';
  const restaurantId = restaurant?._id || restaurant?.id || employee?.restaurant;
  const employeeId = employee?.id || employee?._id;

  // Load menu items when accordion is toggled
  useEffect(() => {
    if (!menuOpen || menu.length > 0 || !restaurantId) return;

    if (storedMenu && storedMenu.length > 0) {
      const items = storedMenu.flatMap(category => category.items || [category]);
      setMenu(items);
      return;
    }

    setMenuLoading(true);
    api.get(`/api/menus/restaurant/${restaurantId}`)
      .then(res => {
        const data = res.data;
        const items = Array.isArray(data)
          ? data.flatMap(category => category.items || [category])
          : data?.items || data?.menu || [];
        setMenu(items);
      })
      .catch(() => setMenu([]))
      .finally(() => setMenuLoading(false));
  }, [menuOpen, restaurantId, storedMenu, menu.length]);

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
          <h1 className="text-2xl font-black text-white font-sans">Employee Profile</h1>
          <p className="text-xs text-white/40">Your operational profile details</p>
        </div>

        {/* Profile Card */}
        <div className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-5">
          {/* Avatar Icon */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-white/5 border border-white/10 uppercase" style={{ color: 'var(--brand-primary)' }}>
              {employeeName[0]}
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{employeeName}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/5 uppercase tracking-wider mt-1 inline-block capitalize">
                {role}
              </span>
            </div>
          </div>

          {/* Details list */}
          <div className="border-t border-white/5 pt-4 flex flex-col gap-3.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/40">Restaurant</span>
              <span className="font-bold text-white">{restaurantName}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/40">Account Status</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Active
              </span>
            </div>

            {/* Assigned Tables for Waiter */}
            {role === 'waiter' && (
              <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Assigned Tables</span>
                {loadingTables ? (
                  <span className="text-xs text-white/30">Loading tables...</span>
                ) : assignedTables.length === 0 ? (
                  <span className="text-xs text-white/30">No tables assigned</span>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {assignedTables.map((table) => (
                      <span key={table.id} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
                        {table.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Restaurant Menu section */}
        <section>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center justify-between rounded-2xl px-4 py-3 mb-4 transition-all bg-white/5 border border-white/8"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--brand-primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary-text)" strokeWidth="2.5">
                  <path d="M3 2l1.5 15.5L12 20l7.5-2.5L21 2" /><path d="M3 7h18" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Restaurant Menu</p>
                <p className="text-xs text-white/35">View restaurant items</p>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" className="transition-transform text-white/40"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {menuOpen && (
            <div className="animate-fade-in-up">
              {menuLoading ? (
                <MenuSkeleton />
              ) : menu.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="text-4xl">🍽️</span>
                  <p className="text-sm text-white/40">No menu items available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {menu.map((item, i) => (
                    <MenuItem key={item._id || item.id || i} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Info Banner */}
        <p className="text-center text-[10px] text-white/20 px-4 leading-normal">
          Profile settings and credentials management belong to the Owner Dashboard. Contact your manager to update your role or table assignments.
        </p>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
          style={{ height: '48px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
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
