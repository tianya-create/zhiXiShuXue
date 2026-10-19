const { equivalent } = require('./math-equivalence');
function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[s.length][t.length];
}

function similarity(a, b) {
  const s = String(a || '').trim();
  const t = String(b || '').trim();
  if (!s && !t) return 1;
  const maxLen = Math.max(s.length, t.length, 1);
  return 1 - levenshtein(s, t) / maxLen;
}

function looksLikeRegex(pattern) {
  const text = String(pattern || '').trim();
  if (!text) return false;
  return text.startsWith('^') || text.endsWith('$') || /\\d|\\s|\\w|\[.*\]|\(.*\)|\|/.test(text);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getOptionLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeChoiceAnswer(question, rawAnswer) {
  const answerText = String(rawAnswer || '').trim();
  const normalizedAnswer = normalizeText(answerText);
  const options = Array.isArray(question.options) ? question.options : [];

  if (!normalizedAnswer) {
    return {
      raw: answerText,
      normalized: '',
      label: '',
      content: ''
    };
  }

  const optionIndexByLabel = options.findIndex((_option, index) => normalizeText(getOptionLabel(index)) === normalizedAnswer);
  if (optionIndexByLabel >= 0) {
    return {
      raw: answerText,
      normalized: normalizeText(getOptionLabel(optionIndexByLabel)),
      label: getOptionLabel(optionIndexByLabel),
      content: options[optionIndexByLabel]
    };
  }

  const optionIndexByContent = options.findIndex(option => normalizeText(option) === normalizedAnswer);
  if (optionIndexByContent >= 0) {
    return {
      raw: answerText,
      normalized: normalizeText(getOptionLabel(optionIndexByContent)),
      label: getOptionLabel(optionIndexByContent),
      content: options[optionIndexByContent]
    };
  }

  return {
    raw: answerText,
    normalized: normalizedAnswer,
    label: answerText.toUpperCase(),
    content: answerText
  };
}

function buildChoiceDisplay(question, rawAnswer) {
  const info = normalizeChoiceAnswer(question, rawAnswer);
  if (!info.normalized) return '-';
  if (info.label && info.content) return `${info.label}（${info.content}）`;
  return info.content || info.label || '-';
}

function normalizeJudge(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['对', '正确', 'true', '√', 't', 'yes', '是'].includes(text)) return '正确';
  if (['错', '错误', 'false', '×', 'x', 'f', 'no', '否'].includes(text)) return '错误';
  return text;
}

function gradeAnswer(question, userAnswer) {
  const type = question.type === 'shortAnswer' ? 'subjective' : question.type;
  const normalizedUserAnswer = String(userAnswer || '').trim();
  const correctAnswer = String(question.answer_text || question.answerText || question.answer || '').trim();

  if (type === 'judge' || type === 'truefalse') {
    const user = normalizeJudge(normalizedUserAnswer);
    const standard = normalizeJudge(correctAnswer);
    const isCorrect = !!user && !!standard && user === standard;
    return {
      isCorrect,
      correctAnswer: standard || correctAnswer,
      explanation: question.explanation || question.analysis || '',
      userAnswer: normalizedUserAnswer,
      similarity: isCorrect ? 1 : 0
    };
  }

  if (type === 'choice') {
    const normalizedUser = normalizeChoiceAnswer(question, normalizedUserAnswer);
    const normalizedStandard = normalizeChoiceAnswer(question, correctAnswer);
    const isCorrect = !!normalizedUser.normalized && normalizedUser.normalized === normalizedStandard.normalized;
    return {
      isCorrect,
      correctAnswer: buildChoiceDisplay(question, correctAnswer),
      explanation: question.explanation || question.analysis || '',
      userAnswer: normalizedUserAnswer,
      similarity: isCorrect ? 1 : 0
    };
  }

  if (type !== 'subjective') {
    const isCorrect = [correctAnswer, ...(question.acceptedAnswers || [])].some(answer => equivalent(normalizedUserAnswer, answer));
    const needsReview = !isCorrect && /[√π±\\{},;]|或|(?:sin|cos|tan)|\^\d+\.\d+|\/[^=]*[a-z]/.test(normalizedUserAnswer + correctAnswer);
    return {
      needsReview,
      isCorrect: needsReview ? null : isCorrect,
      correctAnswer: needsReview ? '' : correctAnswer,
      explanation: question.explanation || question.analysis || '',
      userAnswer: normalizedUserAnswer,
      similarity: isCorrect ? 1 : 0
    };
  }

  // A correct-looking final answer is insufficient evidence for a proof or a
  // multi-step solution. The teacher reviews the process and awards step scores.
  return {
    isCorrect: null,
    needsReview: true,
    correctAnswer,
    explanation: question.explanation || question.analysis || '',
    userAnswer: normalizedUserAnswer,
    suggestedCorrect: equivalent(normalizedUserAnswer, correctAnswer),
    similarity: null
  };
}

module.exports = { levenshtein, similarity, looksLikeRegex, normalizeChoiceAnswer, buildChoiceDisplay, gradeAnswer };
