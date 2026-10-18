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

// 判断题的口语化写法先归一到标准表述，再走等价判定
function normalizeJudge(value) {
  const text = String(value || '').replace(/\s/g, '').toLowerCase();
  if (['正确', '对', '√', 'true', 't', '1', 'yes', '是'].includes(text)) return '正确';
  if (['错误', '错', '×', 'x', 'false', 'f', '0', 'no', '否'].includes(text)) return '错误';
  return text;
}

// 难度较高的符号：出现这些符号时，字符串不等就不能断言学生答错
const AMBIGUOUS_PATTERN = /[√π±\\{},;]|或|(?:sin|cos|tan)|\^\d+\.\d+|\/[^=]*[a-z]/;

function gradeAnswer(question, userAnswer) {
  const type = question.type === 'shortAnswer' ? 'subjective' : question.type;
  const normalizedUserAnswer = String(userAnswer || '').trim();
  const correctAnswer = String(question.answer_text || question.answerText || question.answer || '').trim();

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
    if (!normalizedUserAnswer) {
      return {
        isCorrect: false,
        needsReview: false,
        correctAnswer,
        explanation: question.explanation || question.analysis || '',
        userAnswer: normalizedUserAnswer,
        similarity: 0
      };
    }
    // 先做代数等价判定（1/2 = 0.5、2(x+1) = 2x+2、x=6 与 6=x 等），
    // 解析器覆盖不到时退化为文本比较，仅当符号可疑时转人工复核。
    const candidates = [correctAnswer, ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [])];
    const comparable = type === 'judge'
      ? { user: normalizeJudge(normalizedUserAnswer), standard: candidates.map(normalizeJudge) }
      : { user: normalizedUserAnswer, standard: candidates };
    const matched = comparable.standard.some((answer) => answer && equivalent(comparable.user, answer));
    const ambiguous = !matched && AMBIGUOUS_PATTERN.test(comparable.user + comparable.standard.join(''));
    const needsReview = ambiguous && comparable.user !== comparable.standard[0];
    return {
      isCorrect: needsReview ? null : matched,
      needsReview,
      correctAnswer: needsReview ? '' : correctAnswer,
      explanation: question.explanation || question.analysis || '',
      userAnswer: normalizedUserAnswer,
      similarity: matched ? 1 : 0
    };
  }

  // 解答题只看最终答案不足以判断解题过程：给出相似度建议，但一律交由教师复核。
  const suggestedCorrect = equivalent(normalizedUserAnswer, correctAnswer);
  const score = similarity(normalizedUserAnswer, correctAnswer);

  return {
    isCorrect: suggestedCorrect || score >= 0.9,
    needsReview: true,
    correctAnswer,
    explanation: question.explanation || question.analysis || '',
    userAnswer: normalizedUserAnswer,
    suggestedCorrect,
    similarity: score
  };
}

module.exports = {
  levenshtein,
  similarity,
  looksLikeRegex,
  normalizeChoiceAnswer,
  buildChoiceDisplay,
  gradeAnswer
};
