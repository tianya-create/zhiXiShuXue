<template>
  <div class="preference-page">
    <header class="survey-intro">
      <img src="/images/pixel-math-teacher.png" alt="像素风数学老师" />
      <div>
        <span>首次学习小设置 · 约 2 分钟</span>
        <h1>你更喜欢怎样学习数学？</h1>
        <p>没有“最好”的类型，也不会给你贴标签。选择真实习惯后，系统会优先安排更顺手的资源形式，你之后可以重新测评。</p>
      </div>
    </header>

    <el-skeleton v-if="loading" :rows="8" animated />
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
const answers = reactive({})
const labels = ['很不符合', '不太符合', '一般', '比较符合', '非常符合']
const meta = {
  V: { icon: '🗺️', title: '图形与关系', desc: '示意图、思维导图和视觉关系' },
  A: { icon: '🎧', title: '讲解与倾听', desc: '老师讲解、微课和口头说明' },
  R: { icon: '📝', title: '文字与整理', desc: '概念文字、公式和笔记整理' },
  K: { icon: '🧩', title: '尝试与操作', desc: '例题、练习和边做边理解' }
}
const groups = computed(() => Object.keys(meta).map(key => ({ key, ...meta[key], questions: questions.value.filter(item => item.dimension === key) })))
const answeredCount = computed(() => Object.keys(answers).filter(key => answers[key]).length)

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
      ElMessage.success('已保存，你可以随时在个人设置中重新测评')
      router.replace('/student/dashboard')
    })
    .catch(error => ElMessage.error(error.response?.data?.message || '保存失败'))
    .finally(() => { submitting.value = false })
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
@media (max-width: 650px) { .survey-intro { grid-template-columns: 90px 1fr; padding: 18px; }.survey-intro img { width: 90px; height: 90px; }.survey-scale { padding-left: 0; }.survey-scale span { display: none; } }
</style>
