<template>
  <el-dialog
    :model-value="modelValue"
    width="min(820px, 94vw)"
    class="practice-preference-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <section v-if="result" class="preference-result" aria-live="polite">
      <span class="result-kicker">本周学习偏好结果</span>
      <div class="result-main">
        <span class="result-icon">{{ currentPreference.icon }}</span>
        <div>
          <h2>你目前更偏好<span>{{ currentPreference.title }}</span></h2>
          <p>{{ currentPreference.description }}</p>
        </div>
      </div>
      <p v-if="secondaryPreference" class="mixed-note">本轮也会搭配 {{ secondaryPreference.icon }} {{ secondaryPreference.title }} 的资源形式。</p>
      <p class="result-note">结果会保留 7 天。下面会按这个资源形式组织薄弱补练；题目难度仍由答题表现和之后的自评共同决定。</p>
      <div class="result-actions">
        <el-button @click="retake">重新填写</el-button>
        <el-button type="primary" size="large" @click="startPractice">开始本轮薄弱补练</el-button>
      </div>
    </section>

    <template v-else>
      <header class="dialog-head">
        <img src="/images/pixel-math-teacher.png" alt="像素风数学老师" />
        <div>
          <span>开始补练前 · 学习偏好小问卷</span>
          <h2>这一次，你更希望怎样理解数学？</h2>
          <p>没有标准答案。选完后会先告诉你本轮的资源呈现偏好，再开始薄弱补练。</p>
        </div>
      </header>

      <section class="scale-guide" aria-label="选项分数说明">
        <b>每道题都按符合程度选择：</b>
        <div>
          <span v-for="(label, index) in labels" :key="label"><strong>{{ index + 1 }}</strong>{{ label }}</span>
        </div>
      </section>

      <el-skeleton v-if="loading" :rows="8" animated />
      <div v-else class="question-groups">
        <section v-for="group in groups" :key="group.key" class="preference-group">
          <header><span>{{ group.icon }}</span><div><h3>{{ group.title }}</h3><p>{{ group.desc }}</p></div></header>
          <article v-for="(question, index) in group.questions" :key="question.id" class="preference-question">
            <p><b>{{ index + 1 }}</b>{{ question.text }}</p>
            <div class="score-row">
              <button v-for="score in 5" :key="score" type="button" :class="{ active: answers[question.id] === score }" @click="answers[question.id] = score">
                {{ score }}<small>{{ labels[score - 1] }}</small>
              </button>
            </div>
          </article>
        </section>
      </div>
      <footer class="dialog-footer">
        <span>已完成 {{ answeredCount }} / {{ questions.length }} 题</span>
        <el-button type="primary" size="large" :loading="submitting" @click="submit">查看本轮偏好结果</el-button>
      </footer>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['completed'])
const loading = ref(false)
const submitting = ref(false)
const questions = ref([])
const result = ref(null)
const answers = reactive({})
const labels = ['很不符合', '不太符合', '一般', '比较符合', '非常符合']
const meta = {
  V: { icon: '🗺️', title: '图示与关系', desc: '思维导图、示意图和关系线索' },
  A: { icon: '🎧', title: '语音与讲解', desc: '口述思路、步骤旁白和微课语音' },
  R: { icon: '📝', title: '文字与整理', desc: '概念文字、公式和规范表达' },
  K: { icon: '🧩', title: '练习与试错', desc: '优先作答、即时反馈和边做边理解' }
}
const options = {
  visual: { icon: '🗺️', title: '图示与关系', description: '会优先用关系图、条件标注和更少的连续文字组织内容。' },
  readWrite: { icon: '📝', title: '文字与整理', description: '会优先用清晰的概念解析、规则说明和规范表达组织内容。' },
  aural: { icon: '🎧', title: '语音讲解', description: '会优先提供思路口述和步骤旁白，帮助你从听觉线索理解过程。' },
  kinesthetic: { icon: '🧩', title: '练习与试错', description: '会减少前置讲解，让你优先作答并获得针对性反馈。' }
}
const groups = computed(() => Object.keys(meta).map(key => ({ key, ...meta[key], questions: questions.value.filter(item => item.dimension === key) })))
const answeredCount = computed(() => Object.keys(answers).filter(key => answers[key]).length)
const currentPreference = computed(() => options[result.value?.presentationMode?.primary] || options.readWrite)
const secondaryPreference = computed(() => {
  const mode = result.value?.presentationMode?.secondary
  return mode && mode !== result.value?.presentationMode?.primary ? options[mode] : null
})

async function loadQuestionnaire() {
  loading.value = true
  result.value = null
  Object.keys(answers).forEach(key => delete answers[key])
  try {
    const response = await api.get('/student/presentation-preference/questionnaire')
    if (response.success) questions.value = response.data.questions || []
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, visible => {
  if (visible) loadQuestionnaire()
})

function submit() {
  if (answeredCount.value !== questions.value.length) {
    ElMessage.warning(`还有 ${questions.value.length - answeredCount.value} 题没有选择`)
    return
  }
  submitting.value = true
  api.post('/student/presentation-preference', { answers: { ...answers } })
    .then(response => {
      if (response.success) result.value = response.data
    })
    .catch(error => ElMessage.error(error.response?.data?.message || '保存偏好失败，请稍后再试'))
    .finally(() => { submitting.value = false })
}

function retake() {
  result.value = null
}

function startPractice() {
  emit('completed', result.value)
}
</script>

<style scoped>
.dialog-head { display: grid; grid-template-columns: 86px 1fr; gap: 16px; align-items: center; margin: -6px 0 18px; }.dialog-head img { width: 86px; height: 86px; object-fit: contain; image-rendering: pixelated; }.dialog-head span, .result-kicker { color: var(--nb-blue); font-size: 13px; font-weight: 800; }.dialog-head h2 { margin: 4px 0 6px; font-family: var(--nb-font-display); font-size: 26px; font-weight: 500; }.dialog-head p { margin: 0; color: var(--nb-ink-2); line-height: 1.55; }
.scale-guide { margin: -4px 0 14px; padding: 11px 13px; border: 1px solid var(--nb-line); border-radius: 11px; background: var(--nb-blue-soft); }.scale-guide > b { display: block; margin-bottom: 8px; color: var(--nb-ink); font-size: 13px; }.scale-guide > div { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }.scale-guide span { display: flex; align-items: center; justify-content: center; gap: 5px; color: var(--nb-ink-2); font-size: 12px; text-align: center; }.scale-guide strong { display: grid; flex: 0 0 22px; height: 22px; place-items: center; border-radius: 50%; background: var(--nb-sheet); color: var(--nb-blue); font-size: 13px; }
.question-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-height: min(58vh, 560px); overflow: auto; padding-right: 4px; }.preference-group { padding: 14px; border: 1px solid var(--nb-line); border-radius: 13px; background: var(--nb-sheet); }.preference-group > header { display: flex; gap: 9px; align-items: center; padding-bottom: 10px; border-bottom: 1px dashed var(--nb-line); }.preference-group > header > span { font-size: 25px; }.preference-group h3, .preference-group header p { margin: 0; }.preference-group h3 { font-size: 16px; }.preference-group header p { margin-top: 2px; color: var(--nb-ink-3); font-size: 12px; }.preference-question { padding: 11px 0; border-bottom: 1px solid #edf0f5; }.preference-question:last-child { padding-bottom: 0; border-bottom: 0; }.preference-question p { display: flex; gap: 7px; margin: 0 0 8px; color: var(--nb-ink); font-size: 13px; line-height: 1.48; }.preference-question p b { display: grid; place-items: center; flex: 0 0 20px; height: 20px; border-radius: 50%; background: var(--nb-blue-soft); color: var(--nb-blue); font-size: 12px; }.score-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }.score-row button { display: grid; gap: 2px; min-height: 48px; padding: 5px 2px; border: 1px solid var(--nb-line); border-radius: 6px; background: #fff; color: var(--nb-ink-2); font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }.score-row button.active { border-color: var(--nb-blue); background: var(--nb-blue-soft); color: var(--nb-blue); }.score-row small { display: block; color: inherit; font-size: 9px; font-weight: 500; line-height: 1.15; }
.dialog-footer, .result-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 18px; }.dialog-footer { color: var(--nb-ink-3); font-size: 14px; }.preference-result { padding: 18px 6px 6px; text-align: center; }.result-main { display: flex; align-items: center; justify-content: center; gap: 15px; max-width: 570px; margin: 18px auto; text-align: left; }.result-icon { display: grid; flex: 0 0 76px; height: 76px; place-items: center; border-radius: 50%; background: var(--nb-blue-soft); font-size: 38px; }.result-main h2 { margin: 0; font-family: var(--nb-font-display); font-size: 27px; font-weight: 500; }.result-main h2 span { margin-left: 7px; color: var(--nb-blue); }.result-main p, .mixed-note, .result-note { margin: 7px 0 0; color: var(--nb-ink-2); line-height: 1.6; }.mixed-note { display: inline-block; padding: 8px 12px; border-radius: 8px; background: var(--nb-blue-soft); }.result-note { max-width: 590px; margin: 16px auto 0; font-size: 14px; }.result-actions { justify-content: center; }
@media (max-width: 650px) { .question-groups { grid-template-columns: 1fr; }.dialog-head { grid-template-columns: 64px 1fr; }.dialog-head img { width: 64px; height: 64px; }.dialog-head h2 { font-size: 21px; }.scale-guide > div { grid-template-columns: 1fr; gap: 4px; }.scale-guide span { justify-content: flex-start; }.result-main { align-items: flex-start; }.dialog-footer { align-items: stretch; flex-direction: column; } }
</style>
