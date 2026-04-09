// Aggregates raw sales records into KPIs grouped by period, product, or rep.
// Computes: total revenue, transaction count, average deal size, and top items.

export default function (input) {
  const records = input.records || [];
  const groupBy = input.group_by || 'month';

  if (records.length === 0) {
    return { groups: [], totals: { revenue: 0, count: 0, avg_deal: 0 } };
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

  return {
    groups: result,
    totals: {
      revenue: Math.round(totalRevenue),
      transaction_count: totalCount,
      avg_deal_size: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0
    },
    group_by: groupBy,
    record_count: records.length
  };
}

function getGroupKey(record, groupBy) {
  switch (groupBy) {
    case 'month': {
      const d = new Date(record.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    case 'week': {
      const d = new Date(record.date);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'product':
      return record.product || 'unknown';
    case 'rep':
      return record.rep || 'unknown';
    default:
      return 'all';
  }
}
