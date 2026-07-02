// Aggregates raw sales records into KPIs grouped by period, product, or rep.
// Computes: total revenue, transaction count, average deal size, and top items.
// Also emits a human-readable "summary" string used by the notify-slack effect.
//
// d6e STF code style: top-level code (no function wrapper, no export).
// The runtime binds the step input to the global $input and wraps this
// file in an async IIFE, so a top-level `return` ends the STF.

function getGroupKey(record, groupBy) {
  switch (groupBy) {
    case 'month': {
      const d = new Date(record.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    case 'week': {
      const d = new Date(record.date);
      const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'product':
      return record.product || 'unknown';
    case 'rep':
      return record.rep || 'unknown';
    default:
      return 'all';
  }
}

const records = $input.records || [];
const groupBy = $input.group_by || 'month';

if (records.length === 0) {
  return {
    groups: [],
    totals: { revenue: 0, transaction_count: 0, avg_deal_size: 0 },
    group_by: groupBy,
    record_count: 0,
    summary: 'Sales summary: no records for this period.'
  };
}

const groups = {};

for (const record of records) {
  const key = getGroupKey(record, groupBy);
  if (!groups[key]) {
    groups[key] = { key, revenue: 0, count: 0, products: {}, reps: {} };
  }

  const amount = Number(record.amount) || 0;
  groups[key].revenue += amount;
  groups[key].count += 1;

  if (record.product) {
    groups[key].products[record.product] = (groups[key].products[record.product] || 0) + amount;
  }
  if (record.rep) {
    groups[key].reps[record.rep] = (groups[key].reps[record.rep] || 0) + amount;
  }
}

let totalRevenue = 0;
let totalCount = 0;

const result = Object.values(groups)
  .map((g) => {
    totalRevenue += g.revenue;
    totalCount += g.count;

    const topProduct = Object.entries(g.products)
      .sort((a, b) => b[1] - a[1])[0];
    const topRep = Object.entries(g.reps)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      group: g.key,
      revenue: Math.round(g.revenue),
      transaction_count: g.count,
      avg_deal_size: Math.round(g.revenue / g.count),
      top_product: topProduct ? { name: topProduct[0], revenue: Math.round(topProduct[1]) } : null,
      top_rep: topRep ? { name: topRep[0], revenue: Math.round(topRep[1]) } : null
    };
  })
  .sort((a, b) => a.group.localeCompare(b.group));

const totals = {
  revenue: Math.round(totalRevenue),
  transaction_count: totalCount,
  avg_deal_size: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0
};

// Human-readable one-liner consumed by the notify-slack effect
// ($steps[0].summary in the workflow's effect step mapping).
const summary =
  `Sales summary (by ${groupBy}): revenue ${totals.revenue}, ` +
  `${totals.transaction_count} transactions, avg deal size ${totals.avg_deal_size}.`;

return {
  groups: result,
  totals,
  group_by: groupBy,
  record_count: records.length,
  summary
};
