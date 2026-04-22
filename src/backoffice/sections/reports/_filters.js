// v4.6.15: Period computation, check filters, and compare-period math.
// Used by every report in the new reporting suite.

export const PERIODS = [
  { id:'today',      label:'Today'        },
  { id:'yesterday',  label:'Yesterday'    },
  { id:'this-week',  label:'This week'    },
  { id:'last-week',  label:'Last week'    },
  { id:'this-month', label:'This month'   },
  { id:'last-month', label:'Last month'   },
  { id:'last-7',     label:'Last 7 days'  },
  { id:'last-30',    label:'Last 30 days' },
  { id:'custom',     label:'Custom'       },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

// Returns { from, to, prevFrom, prevTo } — prev period is same length, immediately preceding.
export function getPeriodRange(periodId, custom) {
  const now = new Date();
  let from, to;
  switch (periodId) {
    case 'today':      from = startOfDay(now); to = endOfDay(now); break;
    case 'yesterday': { const y = new Date(now); y.setDate(now.getDate()-1); from = startOfDay(y); to = endOfDay(y); break; }
    case 'this-week': { const d = new Date(now); const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow); from = startOfDay(d); to = endOfDay(now); break; }
    case 'last-week': { const d = new Date(now); const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow-7); from = startOfDay(d); const t = new Date(d); t.setDate(d.getDate()+6); to = endOfDay(t); break; }
    case 'this-month':  from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));    to = endOfDay(now); break;
    case 'last-month':  from = startOfDay(new Date(now.getFullYear(), now.getMonth()-1, 1));  to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)); break;
    case 'last-7':    { const d = new Date(now); d.setDate(now.getDate()-6);  from = startOfDay(d); to = endOfDay(now); break; }
    case 'last-30':   { const d = new Date(now); d.setDate(now.getDate()-29); from = startOfDay(d); to = endOfDay(now); break; }
    case 'custom':
      from = custom?.from ? startOfDay(new Date(custom.from)) : startOfDay(now);
      to   = custom?.to   ? endOfDay(new Date(custom.to))     : endOfDay(now); break;
    default: from = startOfDay(now); to = endOfDay(now);
  }
  const lengthMs = to.getTime() - from.getTime();
  const prevTo   = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from, to, prevFrom, prevTo };
}

export function periodLabel(periodId, custom, range) {
  if (periodId === 'custom' && custom?.from && custom?.to) {
    return `${new Date(custom.from).toLocaleDateString('en-GB')} \u2192 ${new Date(custom.to).toLocaleDateString('en-GB')}`;
  }
  if (!range) return '';
  const sameDay = range.from.toDateString() === range.to.toDateString();
  return sameDay
    ? range.from.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
    : `${range.from.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} \u2192 ${range.to.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`;
}

// Apply server + order type filters (global filters live on the shell).
export function applyFilters(checks, filters) {
  return (checks||[]).filter(c => {
    if (filters?.server    && filters.server    !== 'all' && (c.server || '') !== filters.server)        return false;
    if (filters?.orderType && filters.orderType !== 'all' && (c.orderType || 'dine-in') !== filters.orderType) return false;
    return true;
  });
}

// Signed percent change. Null when there's no prior data to compare.
export function pctDelta(current, previous) {
  if (!previous || !isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function uniqueServers(checks) {
  const set = new Set();
  (checks||[]).forEach(c => { if (c.server) set.add(c.server); });
  return [...set].sort();
}

export function uniqueOrderTypes(checks) {
  const set = new Set();
  (checks||[]).forEach(c => set.add(c.orderType || 'dine-in'));
  return [...set].sort();
}
