// Validates journal entry balance: debit total must equal credit total.
// Returns validation result with totals and per-entry breakdown.
//
// d6e STF code style: top-level code (no function wrapper, no export).
// The runtime binds the step input to the global $input and wraps this
// file in an async IIFE, so a top-level `return` ends the STF.

const entries = $input.entries || [];

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
let validationError = null;

for (const entry of entries) {
  const debit = Number(entry.debit) || 0;
  const credit = Number(entry.credit) || 0;

  if (debit < 0 || credit < 0) {
    validationError = `Negative amount found in account ${entry.account_code}: debit=${debit}, credit=${credit}`;
    break;
  }

  if (debit > 0 && credit > 0) {
    validationError = `Account ${entry.account_code} has both debit and credit. Split into separate lines.`;
    break;
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

if (validationError) {
  return {
    valid: false,
    error: validationError,
    debit_total: debitTotal,
    credit_total: creditTotal,
    difference: Math.round((debitTotal - creditTotal) * 100) / 100,
    entries: validated
  };
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
