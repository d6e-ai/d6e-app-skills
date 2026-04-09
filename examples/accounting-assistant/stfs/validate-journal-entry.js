// Validates journal entry balance: debit total must equal credit total.
// Returns validation result with totals and per-entry breakdown.

export default function (input) {
  const entries = input.entries || [];

  if (entries.length === 0) {
    return {
      valid: false,
      error: 'No entries provided',
      debit_total: 0,
      credit_total: 0,
      difference: 0,
      entries: []
    };
  }

  let debitTotal = 0;
  let creditTotal = 0;
  const validated = [];

  for (const entry of entries) {
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;

    if (debit < 0 || credit < 0) {
      return {
        valid: false,
        error: `Negative amount found in account ${entry.account_code}: debit=${debit}, credit=${credit}`,
        debit_total: debitTotal,
        credit_total: creditTotal,
        difference: 0,
        entries: validated
      };
    }

    if (debit > 0 && credit > 0) {
      return {
        valid: false,
        error: `Account ${entry.account_code} has both debit and credit. Split into separate lines.`,
        debit_total: debitTotal,
        credit_total: creditTotal,
        difference: 0,
        entries: validated
      };
    }

    debitTotal += debit;
    creditTotal += credit;

    validated.push({
      account_code: entry.account_code,
      account_name: entry.account_name,
      debit,
      credit,
      side: debit > 0 ? 'debit' : credit > 0 ? 'credit' : 'none'
    });
  }

  const difference = Math.round((debitTotal - creditTotal) * 100) / 100;

  return {
    valid: difference === 0,
    error: difference !== 0 ? `Unbalanced: debit total (${debitTotal}) - credit total (${creditTotal}) = ${difference}` : null,
    debit_total: debitTotal,
    credit_total: creditTotal,
    difference,
    entry_count: validated.length,
    entries: validated
  };
}
