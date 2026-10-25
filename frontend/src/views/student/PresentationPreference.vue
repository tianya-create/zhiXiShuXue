<template>
  <div class="preference-page">
    <header class="survey-intro">
      <img src="/images/pixel-math-teacher.png" alt="像素风数学老师" />
      <div>
        <span>学习偏好测评 · 结果有效 7 天</span>
        <h1>你更喜欢怎样学习数学？</h1>
        <p>没有“最好”的类型，也不会给你贴标签。选择真实习惯后，系统会优先安排更顺手的资源形式，你之后可以重新测评。</p>
      </div>
    </header>

    <section v-if="result" class="preference-result" aria-live="polite">
      <span class="result-kicker">测评结果已保存</span>
      <div class="result-main">
        <span class="result-icon">{{ currentPreference.icon }}</span>
        <div>
          <h2>你目前更喜欢<span>{{ currentPreference.title }}</span></h2>
          <p>{{ currentPreference.description }}</p>
        </div>
      </div>
      <div v-if="secondaryPreference" class="mixed-note">
        <b>也会搭配：{{ secondaryPreference.icon }} {{ secondaryPreference.title }}</b>
        <span>你的两种偏好分数接近，系统会结合使用两种资源形式。</span>
      </div>
      <p class="result-boundary">这不是能力标签。系统会优先这样组织资源，但题目难度仍由本轮学习表现和自评共同决定。</p>
      <el-button type="primary" size="large" @click="startLearning">进入学习工作台</el-button>
      <button type="button" class="retake-link" @click="result = null">重新填写</button>
    </section>
    <el-skeleton v-else-if="loading" :rows="8" animated />
    <template v-else>
      <section v-for="group in groups" :key="group.key" class="survey-group">
        <div class="group-title">
          <span>{{ group.icon }}</span>
          <div><h2>{{ group.title }}</h2><p>{{ group.desc }}</p></div>
        </div>
        <article v-for="(question, index) in group.questions" :key="question.id" class="survey-question">
          <p><b>{{ index + 1 }}</b>{{ question.text }}</p>
          <div class="survey-scale">
            <button v-for="score in 5" :key="score" type="button" :class="{ active: answers[question.id] === score }" @click="answers[question.id] = score">
              <strong>{{ score }}</strong><span>{{ labels[score - 1] }}</span>
            </button>
          </div>
        </article>
      </section>
      <footer class="survey-submit">
        <span>已完成 {{ answeredCount }} / {{ questions.length }} 题</span>
        <el-button type="primary" size="large" :loading="submitting" @click="submit">保存并进入学习</el-button>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const router = useRouter()
const loading = ref(true)
const submitting = ref(false)
const questions = ref([])
const result = ref(null)
const answers = reactive({})
const labels = ['很不符合', '不太符合', '一般', '比较符合', '非常符合']
const meta = {
  V: { icon: '🗺️', title: '图形与关系', desc: '示意图、思维导图和视觉关系' },
  A: { icon: '🎧', title: '语音与讲解', desc: '口述思路、步骤旁白和微课语音' },
  R: { icon: '📝', title: '文字与整理', desc: '概念文字、公式和笔记整理' },
  K: { icon: '🧩', title: '练习与试错', desc: '优先作答、即时反馈和边做边理解' }
}
const groups = computed(() => Object.keys(meta).map(key => ({ key, ...meta[key], questions: questions.value.filter(item => item.dimension === key) })))
const answeredCount = computed(() => Object.keys(answers).filter(key => answers[key]).length)
const preferenceOptions = {
  visual: { icon: '🗺️', title: '图示与关系', description: '接下来会优先用示意图、关系图和条件标注帮你建立理解。' },
  readWrite: { icon: '📝', title: '文字与整理', description: '接下来会优先用清晰的概念文字、公式解释和分段笔记帮助你整理方法。' },
  aural: { icon: '🎧', title: '语音讲解', description: '接下来会优先提供思路口述、步骤旁白和语音讲解。' },
  kinesthetic: { icon: '✏️', title: '尝试与练习', description: '接下来会减少前置讲解，优先让你在练习和即时反馈中建立方法。' }
}
const currentPreference = computed(() => preferenceOptions[result.value?.presentationMode?.primary] || preferenceOptions.readWrite)
const secondaryPreference = computed(() => {
  const secondary = result.value?.presentationMode?.secondary
  return secondary && secondary !== result.value?.presentationMode?.primary ? preferenceOptions[secondary] : null
})

onMounted(() => {
  api.get('/student/presentation-preference/questionnaire')
    .then(res => { if (res.success) questions.value = res.data.questions || [] })
    .finally(() => { loading.value = false })
})

function submit() {
  if (answeredCount.value !== questions.value.length) {
    ElMessage.warning(`还有 ${questions.value.length - answeredCount.value} 题没有选择`)
    return
  }
  submitting.value = true
  api.post('/student/presentation-preference', { answers: { ...answers } })
    .then(res => {
      if (!res.success) return
      result.value = res.data
      ElMessage.success('学习偏好已保存')
    })
    .catch(error => ElMessage.error(error.response?.data?.message || '保存失败'))
    .finally(() => { submitting.value = false })
}

function startLearning() {
  router.replace('/student/dashboard')
}
</script>

<style scoped>
.preference-page { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }
.survey-intro { display: grid; grid-template-columns: 150px 1fr; gap: 24px; align-items: center; padding: 24px 30px; border: 1px solid var(--nb-line); border-radius: 20px; background: linear-gradient(135deg, var(--nb-blue-soft), var(--nb-sheet)); box-shadow: var(--nb-shadow); }
.survey-intro img { width: 150px; height: 150px; object-fit: contain; image-rendering: pixelated; }
.survey-intro span { color: var(--nb-blue); font-weight: 800; }
.survey-intro h1 { margin: 6px 0; font-family: var(--nb-font-display); font-size: 34px; font-weight: 500; }
.survey-intro p { margin: 0; color: var(--nb-ink-2); line-height: 1.7; }
.survey-group { margin-top: 18px; padding: 22px; border: 1px solid var(--nb-line); border-radius: var(--nb-radius); background: var(--nb-sheet); box-shadow: var(--nb-shadow); }
.group-title { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px dashed var(--nb-line); }
.group-title > span { font-size: 30px; }
.group-title h2, .group-title p { margin: 0; }
.group-title h2 { font-size: 20px; }.group-title p { margin-top: 3px; color: var(--nb-ink-3); font-size: 14px; }
.survey-question { padding: 17px 0; border-bottom: 1px solid var(--nb-line); }.survey-question:last-child { border-bottom: 0; padding-bottom: 0; }
.survey-question p { display: flex; gap: 10px; margin: 0 0 12px; line-height: 1.6; }.survey-question p b { display: grid; place-items: center; flex: 0 0 26px; height: 26px; border-radius: 50%; background: var(--nb-blue-soft); color: var(--nb-blue); }
.survey-scale { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; padding-left: 36px; }
.survey-scale button { display: grid; gap: 2px; padding: 9px 4px; border: 1px solid var(--nb-line); border-radius: 9px; background: transparent; color: var(--nb-ink-2); font: inherit; cursor: pointer; }.survey-scale button.active { border-color: var(--nb-blue); background: var(--nb-blue-soft); color: var(--nb-blue); }.survey-scale span { font-size: 12px; }
.survey-submit { position: sticky; bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 20px; padding: 14px 18px; border: 1px solid var(--nb-line-strong); border-radius: 14px; background: color-mix(in srgb, var(--nb-sheet) 94%, transparent); box-shadow: 0 14px 30px -18px rgba(28,37,65,.45); backdrop-filter: blur(10px); }
.preference-result { margin-top: 22px; padding: 34px; border: 1px solid #b9daf7; border-radius: 22px; background: linear-gradient(135deg, #edf8ff, #fffdf5 75%); box-shadow: var(--nb-shadow); text-align: center; }.result-kicker { color: var(--nb-blue); font-size: 14px; font-weight: 800; }.result-main { display: flex; justify-content: center; align-items: center; gap: 18px; margin: 18px auto; text-align: left; }.result-icon { display: grid; place-items: center; flex: 0 0 84px; height: 84px; border-radius: 50%; background: #fff; box-shadow: 0 8px 24px rgba(39,119,215,.14); font-size: 42px; }.result-main h2 { margin: 0; color: var(--nb-ink); font-family: var(--nb-font-display); font-size: 29px; font-weight: 500; }.result-main h2 span { margin-left: 8px; color: var(--nb-blue); }.result-main p { max-width: 470px; margin: 7px 0 0; color: var(--nb-ink-2); line-height: 1.65; }.mixed-note { display: grid; gap: 4px; max-width: 590px; margin: 20px auto 0; padding: 14px 16px; border-radius: 13px; background: rgba(255,255,255,.75); color: var(--nb-ink-2); text-align: left; }.mixed-note b { color: var(--nb-ink); }.mixed-note span { font-size: 14px; line-height: 1.55; }.result-boundary { max-width: 610px; margin: 18px auto; color: var(--nb-ink-3); font-size: 14px; line-height: 1.65; }.retake-link { display: block; margin: 13px auto 0; border: 0; background: transparent; color: var(--nb-blue); font: inherit; cursor: pointer; text-decoration: underline; }
@media (max-width: 650px) { .survey-intro { grid-template-columns: 90px 1fr; padding: 18px; }.survey-intro img { width: 90px; height: 90px; }.survey-scale { padding-left: 0; }.survey-scale span { display: none; } }
</style>
