// Validates an array of records against configurable rules.
// Supports checks: required, type, pattern (regex), min, max, enum.
// Returns per-record results with detailed issue descriptions.

export default function (input) {
  const records = input.records || [];
  const rules = input.rules || [];

  if (records.length === 0) {
    return { total: 0, passed: 0, failed: 0, issues: [], summary: {} };
  }

  const results = [];
  const issueCounts = {};
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordIssues = [];

    for (const rule of rules) {
      const value = record[rule.field];
      const issue = checkRule(rule, value, i);

      if (issue) {
        recordIssues.push(issue);
        const key = `${rule.field}:${rule.check}`;
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      }
    }

    if (recordIssues.length > 0) {
      failed++;
      results.push({ index: i, record, issues: recordIssues });
    } else {
      passed++;
    }
  }

  const summary = Object.entries(issueCounts)
    .map(([key, count]) => {
      const [field, check] = key.split(':');
      return { field, check, count };
    })
    .sort((a, b) => b.count - a.count);

  return {
    total: records.length,
    passed,
    failed,
    pass_rate: Math.round((passed / records.length) * 10000) / 100,
    failing_records: results.slice(0, 50),
    summary
  };
}

function checkRule(rule, value, index) {
  const { field, check, expected } = rule;

  switch (check) {
    case 'required':
      if (value === undefined || value === null || value === '') {
        return { field, check, message: `Missing required field "${field}"` };
      }
      break;

    case 'type': {
      if (value === undefined || value === null) break;
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== expected) {
        return { field, check, message: `Expected type "${expected}", got "${actualType}"`, actual: value };
      }
      break;
    }

    case 'pattern':
      if (value === undefined || value === null) break;
      try {
        if (!new RegExp(expected).test(String(value))) {
          return { field, check, message: `Value "${value}" does not match pattern "${expected}"` };
        }
      } catch (e) {
        return { field, check, message: `Invalid regex pattern: ${expected}` };
      }
      break;

    case 'min':
      if (value === undefined || value === null) break;
      if (Number(value) < Number(expected)) {
        return { field, check, message: `Value ${value} is below minimum ${expected}` };
      }
      break;

    case 'max':
      if (value === undefined || value === null) break;
      if (Number(value) > Number(expected)) {
        return { field, check, message: `Value ${value} exceeds maximum ${expected}` };
      }
      break;

    case 'enum':
      if (value === undefined || value === null) break;
      if (Array.isArray(expected) && !expected.includes(value)) {
        return { field, check, message: `Value "${value}" not in allowed values: ${expected.join(', ')}` };
      }
      break;
  }

  return null;
}
