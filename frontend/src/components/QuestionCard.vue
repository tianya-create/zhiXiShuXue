<template>
  <article :class="['nb-question', `presentation-${presentationMode}`, result && !result.needsReview ? (result.isCorrect ? 'is-right' : 'is-wrong') : '']">
    <!-- 红笔批改记号：提交后出现 -->
    <svg v-if="result && !result.needsReview" class="pen-mark" viewBox="0 0 120 100" aria-hidden="true">
      <path
        v-if="result.isCorrect"
        class="pen-stroke"
        d="M14 56 C 26 64, 36 74, 44 86 C 58 58, 80 30, 110 10"
      />
      <template v-else>
        <path class="pen-stroke" d="M22 18 C 46 40, 70 62, 98 88" />
        <path class="pen-stroke is-second" d="M98 16 C 74 38, 50 62, 20 86" />
      </template>
    </svg>
    <span v-if="result" class="sr-only">{{ result.isCorrect ? '回答正确' : '回答错误' }}</span>

    <header class="q-head">
      <span class="q-index">第 {{ index + 1 }} 题</span>
      <span class="q-meta">{{ typeText }}</span>
      <span class="q-meta">难度{{ difficultyText }}</span>
    </header>

    <MathText class="q-stem" tag="div" :text="question.content" />
    <img v-if="question.imageUrl" :src="question.imageUrl" alt="题目附图" style="max-width:100%;max-height:300px" />
    <QuestionTools :question="question" :answered="!!result" />

    <details v-if="!result && question.adaptiveScaffoldSteps?.length" class="q-scaffold" :open="autoExpandScaffold">
      <summary>需要时展开分步提示</summary>
      <ol><li v-for="step in question.adaptiveScaffoldSteps" :key="step"><MathText :text="step" /></li></ol>
    </details>

    <!-- 选择题 -->
    <div v-if="isChoice" class="q-options" role="radiogroup" :aria-label="'第 ' + (index + 1) + ' 题选项'">
      <label
        v-for="(option, idx) in question.options"
        :key="idx"
        :class="['q-option', {
          'is-picked': localValue === option,
          'is-answer': result && isAnswerOption(option, idx),
          'is-miss': result && localValue === option && !result.isCorrect
        }]"
      >
        <input
          v-model="localValue"
          class="q-radio"
          type="radio"
          :name="'q-' + (question.id || index)"
          :value="option"
          :disabled="!!result"
        >
        <span class="q-letter">{{ letter(idx) }}</span>
        <MathText class="q-option-text" :text="option" />
        <span v-if="result && isAnswerOption(option, idx)" class="q-tick" aria-label="正确答案">✓</span>
      </label>
    </div>

    <!-- 填空题 -->
    <el-input
      v-else-if="question.type === 'fill'"
      v-model="localValue"
      class="q-input"
      :disabled="!!result"
      placeholder="在这里填答案"
    />

    <!-- 解答题 -->
    <el-input
      v-else
      v-model="localValue"
      class="q-input"
      type="textarea"
      :rows="4"
      :disabled="!!result"
      placeholder="写下你的解题过程和答案"
    />

    <!-- 批改结果 -->
    <p v-if="result?.needsReview" class="q-note">这道解答题已保存，等待老师复核解题过程。</p>
    <section v-if="result && !result.needsReview" class="q-result">
      <dl class="q-answers">
        <div v-if="!isChoice || !result.isCorrect">
          <dt>你的答案</dt>
          <dd :class="{ 'is-miss-text': !result.isCorrect }"><MathText :text="result.userAnswer || '没有作答'" /></dd>
        </div>
        <div>
          <dt>正确答案</dt>
          <dd class="is-answer-text"><MathText :text="result.correctAnswer || '-'" /></dd>
        </div>
        <div>
          <dt>解析</dt>
          <dd><MathText :text="explanationText" /></dd>
        </div>
      </dl>
      <div v-if="!result.isCorrect" class="q-result-foot">
        <span class="q-note">这道题已经记进错题本。</span>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import QuestionTools from '@/components/QuestionTools.vue'
import MathText from '@/components/MathText.vue'

const props = defineProps({
  question: { type: Object, required: true },
  index: { type: Number, default: 0 },
  modelValue: { type: String, default: '' },
  result: { type: Object, default: null },
  presentationMode: { type: String, default: 'readWrite' },
  autoExpandScaffold: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const DIFFICULTY_TEXT = { easy: '易', medium: '中', hard: '难', 1: '易', 2: '易', 3: '中', 4: '难', 5: '难' }
const TYPE_TEXT = { choice: '选择题', objective: '选择题', single: '选择题', fill: '填空题', judge: '判断题', subjective: '解答题' }

const isChoice = computed(() => Array.isArray(props.question.options) && props.question.options.length > 0 && props.question.type !== 'subjective')
const typeText = computed(() => TYPE_TEXT[props.question.type] || (isChoice.value ? '选择题' : '解答题'))
const difficultyText = computed(() => {
  const value = props.question.difficulty || props.question.difficultyLevel || 3
  return DIFFICULTY_TEXT[value] || value
})
const explanationText = computed(() => {
  const r = props.result || {}
  const q = props.question || {}
  return r.explanation || q.analysis || q.explanation || '这道题暂时没有文字解析。'
})

const localValue = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  }
})

function letter(idx) {
  return String.fromCharCode(65 + idx)
}

// 正确答案可能是选项原文（“2”）、字母（“B”）或“B（2）”这种写法，三种都认
function isAnswerOption(option, idx) {
  const candidates = [
    props.result && props.result.correctAnswer,
    props.question.answer,
    props.question.standardAnswer,
    props.question.answerDisplay
  ].filter(Boolean).map(item => String(item).trim())
  const text = String(option).trim()
  return candidates.some(item => item === text || /^[A-H]([（(.、\s]|$)/.test(item) && item.charAt(0) === letter(idx))
}

</script>

<style scoped>
.nb-question {
  position: relative;
  margin-bottom: 16px;
  padding: 20px 22px 22px;
  background: var(--nb-sheet, #fff);
  border: 1px solid var(--nb-line, #dce3ef);
  border-radius: var(--nb-radius, 12px);
  box-shadow: var(--nb-shadow, none);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---------- 题头 ---------- */
.q-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  padding-right: 72px;
}

.q-index {
  font-family: var(--nb-font-display);
  font-size: 19px;
  color: var(--nb-blue);
}

.q-meta {
  padding: 1px 8px;
  border-radius: 5px;
  background: #f1f4f9;
  color: var(--nb-ink-3);
  font-size: 14px;
}

.q-stem {
  margin-top: 10px;
  padding-right: 72px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--nb-ink);
}
.q-scaffold { margin-top: 12px; padding: 10px 13px; border: 1px dashed var(--nb-blue); border-radius: 9px; background: var(--nb-blue-soft); color: var(--nb-ink-2); }
.q-scaffold summary { color: var(--nb-blue); font-weight: 700; cursor: pointer; }.q-scaffold ol { margin: 10px 0 0; padding-left: 24px; }.q-scaffold li { margin: 6px 0; line-height: 1.55; }

/* 第二层资源呈现：不改变题目难度，只改变进入和理解题目的支架形式。 */
.presentation-visual .q-stem { padding: 10px 12px; border-left: 4px solid #557ad7; border-radius: 0 9px 9px 0; background: #f3f6ff; }
.presentation-visual .q-options { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.presentation-readWrite .q-stem { max-width: 64ch; padding-bottom: 10px; border-bottom: 1px solid var(--nb-line); font-size: 17px; line-height: 1.95; }
.presentation-readWrite .q-meta { border-radius: 3px; background: #e9f7f2; color: #387e72; }
.presentation-aural .q-head { padding-bottom: 8px; border-bottom: 2px solid #c9afe8; }
.presentation-aural .q-meta { background: #f5edff; color: #7749ae; }
.presentation-kinesthetic .q-head { padding-bottom: 8px; border-bottom: 2px solid #f0c78e; }
.presentation-kinesthetic .q-stem { margin-top: 14px; font-size: 18px; font-weight: 650; }

/* ---------- 选项 ---------- */
.q-options {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.q-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 14px 8px 10px;
  border: 1.5px solid var(--nb-line);
  border-radius: 10px;
  background: var(--nb-sheet);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.q-option:hover {
  border-color: var(--nb-line-strong);
  background: #f8fafd;
}

.q-option.is-picked {
  border-color: var(--nb-blue);
  background: var(--nb-blue-soft);
}

.q-option:has(.q-radio:focus-visible) {
  outline: 2px solid var(--nb-blue);
  outline-offset: 2px;
}

.q-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.q-option:has(.q-radio:disabled) {
  cursor: default;
}

.q-letter {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1.5px solid var(--nb-line-strong);
  font-family: var(--nb-font-num);
  font-weight: 700;
  font-size: 14px;
  color: var(--nb-ink-2);
}

.q-option.is-picked .q-letter {
  border-color: var(--nb-blue);
  background: var(--nb-blue);
  color: #fff;
}

.q-option-text {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: var(--nb-ink);
}

/* 批改后：选错的选项被红笔圈出来，正确选项打勾 */
.q-option.is-miss {
  border-color: var(--nb-red);
  background: var(--nb-red-soft);
}

.q-option.is-miss .q-letter {
  border: 2px solid var(--nb-red);
  background: transparent;
  color: var(--nb-red-ink);
  transform: rotate(-8deg) scale(1.08);
}

.q-option.is-answer {
  border-color: var(--nb-green);
  background: var(--nb-green-soft);
}

.q-option.is-answer .q-letter {
  border-color: var(--nb-green);
  background: var(--nb-green);
  color: #fff;
}

.q-tick {
  font-family: var(--nb-font-hand);
  font-size: 30px;
  line-height: 1;
  font-weight: 700;
  color: var(--nb-red-ink);
}

.q-input {
  margin-top: 14px;
}

/* ---------- 红笔记号 ---------- */
.pen-mark {
  position: absolute;
  top: 10px;
  right: 14px;
  width: 76px;
  height: 64px;
  overflow: visible;
  pointer-events: none;
}

.pen-stroke {
  fill: none;
  stroke: var(--nb-red);
  stroke-width: 9;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: pen-draw 0.45s cubic-bezier(0.6, 0, 0.3, 1) forwards;
}

.pen-stroke.is-second {
  animation-delay: 0.3s;
}

@keyframes pen-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* ---------- 批改结果 ---------- */
.q-result {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed var(--nb-line-strong);
}

.q-answers {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.q-answers > div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
}

.q-answers dt {
  color: var(--nb-ink-3);
  font-size: 14px;
  line-height: 1.8;
}

.q-answers dd {
  margin: 0;
  color: var(--nb-ink);
  font-size: 15px;
  line-height: 1.7;
}

.q-answers .is-miss-text {
  color: var(--nb-ink-2);
  text-decoration: line-through;
  text-decoration-color: var(--nb-red);
  text-decoration-thickness: 2px;
}

.q-answers .is-answer-text {
  color: var(--nb-red-ink);
  font-weight: 700;
}

.q-result-foot {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.q-note {
  color: var(--nb-ink-3);
  font-size: 14px;
}

@media (max-width: 640px) {
  .nb-question {
    padding: 16px 16px 18px;
  }

  .pen-mark {
    width: 56px;
    height: 48px;
  }

  .q-head,
  .q-stem {
    padding-right: 52px;
  }

  .q-answers > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pen-stroke {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
