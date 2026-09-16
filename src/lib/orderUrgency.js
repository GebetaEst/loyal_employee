/**
 * Calculates the wait time urgency level and style attributes based on elapsed minutes:
 * - Idle (0 active orders): Calm slate border, no pulse
 * - Served (all active orders served): Soft blue border, NO pulse
 * - Fresh unserved (< 5 min): Restaurant theme color (var(--brand-primary)), pulsing
 * - Medium unserved (5 - 12 min): Warm orange (#f97316), pulsing
 * - Urgent unserved (> 12 min): Critical alert red (#dc2626), pulsing
 */
export function getUrgencyConfig(elapsedMinutes, activeOrdersCount, unservedOrdersCount = 0) {
  // No active orders at all
  if (activeOrdersCount === 0) {
    return {
      level: 'idle',
      borderColor: '#e2e8f0', // slate-200
      badgeBg: '#f1f5f9',     // slate-100
      badgeText: '#64748b',   // slate-500
      glowRing: 'transparent',
      glowShadow: 'transparent',
      isPulsing: false,
      badgeLabel: 'Ready',
      textColor: 'text-slate-900',
      subtitleColor: 'text-slate-400'
    };
  }

  // All orders on this table have been served (no pending unserved orders)
  if (unservedOrdersCount === 0) {
    return {
      level: 'served',
      borderColor: '#93c5fd', // blue-300
      badgeBg: '#dbeafe',     // blue-100
      badgeText: '#1e40af',   // blue-800
      glowRing: 'transparent',
      glowShadow: 'transparent',
      isPulsing: false,       // STOP PULSING WHEN SERVED
      badgeLabel: '✓ Served',
      textColor: 'text-slate-900',
      subtitleColor: 'text-blue-700 font-semibold'
    };
  }

  // There are unserved orders waiting for service: pulse with urgency color
  if (elapsedMinutes < 5) {
    return {
      level: 'brand',
      borderColor: 'var(--brand-primary)',
      badgeBg: 'var(--brand-primary)',
      badgeText: 'var(--brand-primary-text)',
      glowRing: 'var(--brand-primary-ring)',
      glowShadow: 'var(--brand-primary-light)',
      isPulsing: true,
      badgeLabel: elapsedMinutes <= 0 ? '+NEW' : `+${unservedOrdersCount} • ${elapsedMinutes}m`,
      textColor: 'text-slate-900',
      subtitleColor: 'text-slate-600'
    };
  }

  if (elapsedMinutes <= 12) {
    return {
      level: 'orange',
      borderColor: '#f97316',
      badgeBg: '#f97316',
      badgeText: '#ffffff',
      glowRing: 'rgba(249, 115, 22, 0.35)',
      glowShadow: 'rgba(249, 115, 22, 0.25)',
      isPulsing: true,
      badgeLabel: `⏱️ ${elapsedMinutes}m`,
      textColor: 'text-slate-900',
      subtitleColor: 'text-orange-950 font-semibold'
    };
  }

  return {
    level: 'red',
    borderColor: '#dc2626',
    badgeBg: '#dc2626',
    badgeText: '#ffffff',
    glowRing: 'rgba(220, 38, 38, 0.45)',
    glowShadow: 'rgba(220, 38, 38, 0.3)',
    isPulsing: true,
    badgeLabel: `🔥 ${elapsedMinutes}m`,
    textColor: 'text-slate-900',
    subtitleColor: 'text-red-950 font-bold'
  };
}

/**
 * Computes elapsed waiting minutes for a table given its orders and current timestamp.
 * Evaluates the OLDEST unserved order so that newly placed orders do not reset wait time.
 */
export function computeTableElapsedMinutes(orders = [], currentTimestamp = 0) {
  if (!orders || orders.length === 0) return 0;
  const referenceTime = currentTimestamp || Date.now();

  const unservedOrders = orders.filter((o) => {
    const step = (o.currentStepKey || '').toLowerCase();
    return step !== 'served' && step !== 'completed' && step !== 'cancelled';
  });

  const referenceOrders = unservedOrders.length > 0 ? unservedOrders : orders;

  let oldestTimestamp = Infinity;
  for (const o of referenceOrders) {
    const dateVal = o.createdAt || o.timeline?.[0]?.createdAt;
    if (dateVal) {
      const ts = new Date(dateVal).getTime();
      if (!isNaN(ts) && ts < oldestTimestamp) {
        oldestTimestamp = ts;
      }
    }
  }

  if (oldestTimestamp === Infinity) return 0;
  return Math.max(0, Math.floor((referenceTime - oldestTimestamp) / 60000));
}
