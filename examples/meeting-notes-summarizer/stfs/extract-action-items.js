// Extracts structured data from meeting notes text.
// Identifies action items (TODO/action keywords), decisions, and participants.
// Heuristic-based — works best with well-formatted notes.

export default function (input) {
  const text = input.text || '';
  const language = input.language || 'en';

  if (!text.trim()) {
    return { action_items: [], decisions: [], participants: [], word_count: 0 };
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const actionPatterns = language === 'ja'
    ? [/TODO[:：]\s*(.+)/i, /アクション[:：]\s*(.+)/i, /担当[:：]\s*(.+)/i, /→\s*(.+)/]
    : [/TODO[:]\s*(.+)/i, /ACTION[:]\s*(.+)/i, /\[ \]\s*(.+)/, /→\s*(.+)/, /- \*\*TODO\*\*[:]\s*(.+)/i];

  const decisionPatterns = language === 'ja'
    ? [/決定[:：]\s*(.+)/i, /合意[:：]\s*(.+)/i, /結論[:：]\s*(.+)/i]
    : [/DECISION[:]\s*(.+)/i, /DECIDED[:]\s*(.+)/i, /AGREED[:]\s*(.+)/i, /RESOLVED[:]\s*(.+)/i];

  const assigneePattern = language === 'ja'
    ? /[（(]([^）)]+)[）)]/
    : /\(([^)]+)\)|\[@([^\]]+)\]/;

  const deadlinePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}\/\d{1,2})/;

  const actionItems = [];
  const decisions = [];
  const participantSet = new Set();

  for (const line of lines) {
    let matchedAction = false;
    let matchedDecision = false;

    for (const pattern of actionPatterns) {
      const match = line.match(pattern);
      if (match) {
        matchedAction = true;
        const content = match[1].trim();
        const assigneeMatch = content.match(assigneePattern);
        const deadlineMatch = content.match(deadlinePattern);

        actionItems.push({
          content: content.replace(assigneePattern, '').replace(deadlinePattern, '').trim(),
          assignee: assigneeMatch ? (assigneeMatch[1] || assigneeMatch[2]).trim() : 'TBD',
          deadline: deadlineMatch ? deadlineMatch[0] : null,
          priority: guessPriority(content, language),
          source_line: line
        });

        if (assigneeMatch) {
          participantSet.add((assigneeMatch[1] || assigneeMatch[2]).trim());
        }
        break;
      }
    }

    if (!matchedAction) {
      for (const pattern of decisionPatterns) {
        const match = line.match(pattern);
        if (match) {
          matchedDecision = true;
          decisions.push({ content: match[1].trim(), source_line: line });
          break;
        }
      }
    }

    if (!matchedAction && !matchedDecision) {
      const namePattern = language === 'ja'
        ? /^([^\s:：]+)(?:さん)?[:：]/
        : /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)[:]/;
      const nameMatch = line.match(namePattern);
      if (nameMatch) {
        participantSet.add(nameMatch[1].trim());
      }
    }
  }

  return {
    action_items: actionItems,
    action_count: actionItems.length,
    decisions,
    decision_count: decisions.length,
    participants: Array.from(participantSet),
    word_count: text.split(/\s+/).length,
    line_count: lines.length,
    unassigned_count: actionItems.filter((a) => a.assignee === 'TBD').length
  };
}

function guessPriority(text, language) {
  const highKeywords = language === 'ja'
    ? ['至急', '緊急', '最優先', 'ASAP', '今日中']
    : ['urgent', 'asap', 'critical', 'blocker', 'immediately', 'high priority'];

  const lowKeywords = language === 'ja'
    ? ['余裕があれば', '時間があれば', 'nice to have']
    : ['nice to have', 'low priority', 'when possible', 'eventually'];

  const lower = text.toLowerCase();

  if (highKeywords.some((kw) => lower.includes(kw.toLowerCase()))) return 'high';
  if (lowKeywords.some((kw) => lower.includes(kw.toLowerCase()))) return 'low';
  return 'medium';
}
