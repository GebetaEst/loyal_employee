import { getUrgencyConfig, computeTableElapsedMinutes } from '../lib/orderUrgency';

export default function TableCard({ table, orders = [], now = 0, onClick }) {
  const activeOrdersCount = orders.length;
  const unservedOrders = orders.filter((o) => {
    const step = (o.currentStepKey || '').toLowerCase();
    return step !== 'served' && step !== 'completed' && step !== 'cancelled';
  });
  const unservedOrdersCount = unservedOrders.length;
  const elapsedMinutes = computeTableElapsedMinutes(orders, now);
  const urgency = getUrgencyConfig(elapsedMinutes, activeOrdersCount, unservedOrdersCount);

  // Summarize items across table's active orders
  const totalItemsCount = orders.reduce((sum, o) => {
    return sum + (o.items?.reduce((iSum, item) => iSum + (item.quantity || 1), 0) || 0);
  }, 0);

  const statusText = activeOrdersCount === 0
    ? (table.code ? `Code: ${table.code}` : 'Available')
    : unservedOrdersCount === 0
    ? 'All orders served'
    : `${activeOrdersCount} ${activeOrdersCount === 1 ? 'order' : 'orders'} (${totalItemsCount} items)`;

  const bottomLabel = activeOrdersCount === 0
    ? 'Idle'
    : unservedOrdersCount === 0
    ? 'Served'
    : `${elapsedMinutes}m wait`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full aspect-[4/3] sm:aspect-square bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 border-2 select-none active:scale-95 hover:shadow-md ${
        urgency.isPulsing ? 'animate-table-pulse' : 'hover:border-slate-300'
      }`}
      style={{
        borderColor: urgency.borderColor,
        '--pulse-ring': urgency.glowRing,
        '--pulse-glow': urgency.glowShadow,
      }}
    >
      {/* Top-Left Pill Badge (Inspired by +30% in denomination image) */}
      {activeOrdersCount > 0 && (
        <div
          className="absolute -top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide shadow-xs flex items-center gap-1 z-10 transition-colors"
          style={{
            background: urgency.badgeBg,
            color: urgency.badgeText,
          }}
        >
          {urgency.badgeLabel}
        </div>
      )}

      {/* Main Table Identifier (Prominent center typography like denomination numbers) */}
      <div className="flex flex-col items-center justify-center my-auto">
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
          {table.name || `Table ${table.code || '?'}`}
        </h3>

        {/* Subtitle / Description excerpt or status */}
        <p className={`text-[11px] sm:text-xs font-semibold mt-1.5 line-clamp-1 max-w-[120px] sm:max-w-[150px] ${urgency.subtitleColor || 'text-slate-500'}`}>
          {statusText}
        </p>

        {table.description && (
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1 max-w-[110px] sm:max-w-[140px]">
            {table.description}
          </p>
        )}
      </div>

      {/* Bottom Mini Indicator */}
      <div className="mt-auto w-full flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <span className="font-bold uppercase tracking-wider text-[9px] text-slate-400 truncate">
          {table.code ? `T-${table.code}` : 'Table'}
        </span>
        <div className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: urgency.isPulsing ? urgency.badgeBg : (activeOrdersCount > 0 ? '#3b82f6' : '#cbd5e1')
            }}
          />
          <span className="font-semibold text-slate-600">
            {bottomLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
