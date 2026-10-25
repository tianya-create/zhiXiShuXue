<template>
  <div class="adaptive-feedback-page">
    <div v-if="loading" class="feedback-loading"><el-skeleton :rows="8" animated /></div>

    <el-result
      v-else-if="errorMessage"
      icon="warning"
      title="暂时无法打开本轮反馈"
      :sub-title="errorMessage"
    >
      <template #extra><el-button type="primary" @click="router.replace('/student/practice')">返回练习</el-button></template>
    </el-result>

    <template v-else-if="feedbackReady">
      <header class="feedback-heading">
        <span class="eyebrow">学习已被认真记录</span>
        <h1>本轮学习反馈</h1>
        <p>系统结合答题表现和你的自评，为你准备好下一步。</p>
      </header>

      <section class="feedback-grid" aria-label="本轮学习结果">
        <article class="feedback-card performance-card">
          <div class="card-title"><span class="title-icon blue">▥</span><h2>本轮答题表现</h2></div>
          <div class="performance-body">
            <div class="accuracy-ring" :style="{ '--score': accuracy + '%' }" :aria-label="`本轮正确率 ${accuracy}%`">
              <div><strong>{{ accuracy }}%</strong><span>正确率</span></div>
            </div>
            <dl class="result-list">
              <div><dt><span>✓</span> 正确</dt><dd>{{ round.correctCount }} / {{ round.resolvedCount || round.questionIds?.length || 0 }}</dd></div>
              <div><dt><span>▥</span> 正答率</dt><dd>{{ accuracy }}%</dd></div>
              <div><dt><span>◉</span> 本轮认知负荷</dt><dd><em :class="`load-${round.taskComplexity}`">{{ complexityLabel(round.taskComplexity) }}</em></dd></div>
            </dl>
          </div>
        </article>

        <article class="feedback-card reflection-card">
          <div class="card-title"><span class="title-icon blue">▤</span><h2>本轮自评已提交</h2></div>
          <div class="reflection-complete"><span>{{ decision.guidance?.emoji || '✨' }}</span><h3>谢谢你认真说出真实感受</h3><p>自评结果只用于调整下一轮任务，学生端不会显示分数或等级。{{ decision.guidance?.message }}</p></div>
        </article>
      </section>

      <section class="feedback-card adjustment-card" aria-labelledby="adjustment-title">
        <div class="adjustment-heading">
          <div class="card-title"><span class="title-icon adjust">☷</span><h2 id="adjustment-title">下一轮为你这样调整</h2></div>
          <span class="rule-note">依据：正答率 + 任务复杂度 + 学业控制感</span>
        </div>
        <p class="strategy-copy">{{ decision.strategy }}</p>
        <div class="adjustment-tiles">
          <article v-for="item in adjustmentItems" :key="item.title" :class="['adjustment-tile', item.tone]">
            <span class="tile-icon">{{ item.icon }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </section>

      <section class="secondary-row">
        <article class="feedback-card resource-summary">
          <div class="card-title"><span class="title-icon resource">▣</span><h2>资源呈现偏好</h2></div>
          <div class="resource-content">
            <span class="resource-icon">{{ resourceInfo.icon }}</span>
            <div><b>{{ resourceInfo.label }} · {{ resourceInfo.title }}</b><p>{{ resourceInfo.description }}</p><small v-if="presentationCalibrationMessage" class="calibration-message">{{ presentationCalibrationMessage }}</small></div>
          </div>
        </article>
        <div class="decision-summary" aria-label="下一轮任务概要">
          <span>下一轮任务</span><b>{{ complexityLabel(decision.targetComplexity) }}</b><small>{{ densityLabel(decision.pageDensity) }}</small>
        </div>
      </section>

      <div class="action-row">
        <el-button class="next-round-button" type="primary" size="large" @click="goNextRound">进入下一轮 <span>›</span></el-button>
      </div>

      <EmotionalStickyNote
        :guidance="decision.guidance"
        :show-support="decision.supportAvailable && !supportRequested"
        @support="requestTeacherSupport"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import EmotionalStickyNote from '@/components/adaptive/EmotionalStickyNote.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const round = ref({})
const decision = ref({})
const presentationMode = ref({ primary: 'readWrite' })
const feedbackReady = ref(false)
const supportRequested = ref(false)

const accuracy = computed(() => Math.round(Number(round.value.accuracy || 0) * 100))
const resources = {
  visual: { icon: '▧', label: '视觉型', title: '优先显示示意图与关系图', description: '下一轮会优先用图示、颜色和条件标注帮助你建立联系。' },
  readWrite: { icon: '▤', label: '文字理解型', title: '规范文字分层呈现', description: '下一轮会用清晰的概念、性质与表达帮助你整理思路。' },
  aural: { icon: '🎧', label: '听觉型', title: '优先提供语音讲解', description: '下一轮会提供思路口述与步骤旁白，帮助你听清关键过程。' },
  kinesthetic: { icon: '▦', label: '动觉实操型', title: '先做题，再获得提示', description: '下一轮会减少长讲解，让你在尝试中获得有针对性的反馈。' }
}
const resourceInfo = computed(() => resources[presentationMode.value?.primary] || resources.readWrite)
const presentationCalibrationMessage = computed(() => presentationMode.value?.calibration?.message || '')

const adjustmentItems = computed(() => {
  const highScaffold = decision.value.scaffoldLevel === 'high'
  const lowDensity = decision.value.pageDensity === 'low'
  const challenge = Number(decision.value.difficultyAdjustment) > 0 || decision.value.upgradeEligible
  return [
    highScaffold
      ? { icon: '☷', title: '拆成更小的步骤', description: '每次先解决一个关键点，再继续下一步。', tone: 'blue-soft' }
      : challenge
        ? { icon: '↗', title: '加入变式挑战', description: '在同一知识点上加入迁移与变化，稳住基础再突破。', tone: 'yellow-soft' }
        : { icon: '◎', title: '保持合适节奏', description: '维持当前难度，把注意力放在关键步骤上。', tone: 'blue-soft' },
    lowDensity
      ? { icon: '◌', title: '降低认知负荷', description: '从基础小题重新建立把握感，减少同时处理的信息。', tone: 'yellow-soft' }
      : { icon: '▤', title: '保留完整题干', description: '维持标准信息量，继续练习读题与整合条件。', tone: 'green-soft' },
    lowDensity
      ? { icon: '▯', title: '减少页面信息', description: '突出当前步骤、增加留白，让注意力更集中。', tone: 'purple-soft' }
      : challenge
        ? { icon: '✓', title: '更多独立作答', description: '适度收起提示，用你的方法完成完整推理。', tone: 'purple-soft' }
        : { icon: '▧', title: '标准页面布局', description: '用熟悉的页面节奏继续练习，并保留必要提示。', tone: 'purple-soft' }
  ]
})

function complexityLabel(value) { return ({ low: '低', medium: '中', high: '高' })[value] || '中' }
function densityLabel(value) { return value === 'low' ? '低信息密度 · 分步呈现' : '标准信息密度' }

async function loadFeedback() {
  loading.value = true
  errorMessage.value = ''
  feedbackReady.value = false
  try {
    const response = await api.get(`/student/learning-rounds/${route.params.roundId}/feedback`)
    const data = response.data || {}
    if (!response.success || !data.feedbackReady) {
      errorMessage.value = '本轮反馈尚未生成，请先完成自评后再查看。'
      return
    }
    round.value = data.round || {}
    decision.value = data.decision || {}
    presentationMode.value = data.presentationMode || { primary: 'readWrite' }
    feedbackReady.value = true
  } catch (error) {
    errorMessage.value = error.response?.data?.message || '反馈数据加载失败，请稍后再试。'
  } finally {
    loading.value = false
  }
}

function goNextRound() {
  const source = route.query.source
  if (source === 'practice') {
    const plan = String(route.query.plan || '').split(',').filter(Boolean)
    const current = String(route.query.kpId || '')
    const index = plan.indexOf(current)
    if (index >= 0 && index < plan.length - 1) {
      router.replace({ path: '/student/practice', query: { ...route.query, kpId: plan[index + 1], source: undefined } })
      return
    }
    if (plan.length) {
      ElMessage.success('本次补练计划已完成，掌握情况已更新')
      router.replace('/student/weak-points')
      return
    }
  }
  router.replace({ path: '/student/practice', query: { kpId: round.value.knowledgePointId } })
}

function requestTeacherSupport() {
  api.post('/student/support-requests', { roundId: round.value.id })
    .then(response => {
      if (!response.success) return
      supportRequested.value = true
      ElMessage.success('已告诉老师。你可以继续按自己的节奏学习。')
    })
    .catch(error => ElMessage.error(error.response?.data?.message || '发送失败'))
}

onMounted(() => {
  document.documentElement.classList.add('adaptive-feedback-theme')
  loadFeedback()
})
onBeforeUnmount(() => document.documentElement.classList.remove('adaptive-feedback-theme'))
</script>

<style scoped>
:global(html.adaptive-feedback-theme body), :global(html.adaptive-feedback-theme .app-background) { background-color: #fcfaf4 !important; background-image: linear-gradient(rgba(88, 133, 184, .11) 1px, transparent 1px), linear-gradient(90deg, rgba(88, 133, 184, .11) 1px, transparent 1px) !important; background-size: 24px 24px !important; }
.adaptive-feedback-page { min-height: calc(100vh - 100px); padding-bottom: 36px; color: #142f68; }
.feedback-loading { max-width: 980px; padding-top: 42px; }
.feedback-heading { margin: 2px 0 22px; }.eyebrow { color: #3a8ceb; font-size: 14px; font-weight: 800; letter-spacing: .08em; }.feedback-heading h1 { margin: 4px 0 3px; font-family: var(--nb-font-display); font-size: clamp(38px, 4vw, 52px); line-height: 1.05; letter-spacing: .03em; }.feedback-heading p { margin: 0; color: #45659a; font-size: 18px; font-weight: 600; }
.feedback-grid { display: grid; grid-template-columns: 1.08fr .92fr; gap: 16px; }.feedback-card { border: 1px solid #b8e0fa; border-radius: 19px; background: rgba(255, 255, 255, .81); box-shadow: 0 12px 30px -24px rgba(16, 65, 122, .58); backdrop-filter: blur(7px); }.performance-card, .reflection-card { padding: 20px; min-height: 230px; }.card-title { display: flex; align-items: center; gap: 10px; }.card-title h2 { margin: 0; color: #173a7b; font-size: 21px; letter-spacing: .02em; }.title-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; color: #fff; font-size: 21px; font-weight: 800; }.title-icon.blue { background: linear-gradient(135deg, #28d5d6, #187cff); }.title-icon.adjust { background: linear-gradient(135deg, #52d8f5, #2c78f0); }.title-icon.resource { background: linear-gradient(135deg, #5fe2ec, #4497ff); }
.performance-body { display: grid; grid-template-columns: 250px 1fr; gap: 20px; align-items: center; padding: 18px 0 0; }.accuracy-ring { --score: 0%; display: grid; width: 190px; aspect-ratio: 1; place-items: center; margin: 0 auto; border-radius: 50%; background: conic-gradient(#129af8 var(--score), #27d8d2 var(--score), #ddecfa 0); position: relative; }.accuracy-ring::before { content: ''; position: absolute; inset: 18px; border-radius: inherit; background: rgba(255, 255, 255, .96); }.accuracy-ring div { position: relative; display: grid; text-align: center; }.accuracy-ring strong { color: #173d92; font-family: var(--nb-font-num); font-size: 45px; line-height: 1; }.accuracy-ring span { margin-top: 6px; color: #5b78a8; font-weight: 700; }.result-list { margin: 0; }.result-list div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #e1eef9; }.result-list div:last-child { border-bottom: 0; }.result-list dt { color: #315894; font-weight: 700; }.result-list dt span { color: #238cef; }.result-list dd { margin: 0; color: #102d70; font-family: var(--nb-font-num); font-size: 18px; font-weight: 800; }.result-list em { min-width: 39px; display: inline-block; border-radius: 999px; padding: 3px 10px; font-family: var(--nb-font-body); font-size: 13px; font-style: normal; text-align: center; }.load-low, .control-low { color: #9b5521; background: #fff0d9; }.load-medium, .control-medium { color: #48639b; background: #e9f0ff; }.load-high, .control-high { color: #a04728; background: #ffe4b4; }.control-low { color: #b44048; background: #ffe3e7; }.control-high { color: #286194; background: #ddecff; }
.answer-preview { display: grid; gap: 12px; margin-top: 20px; }.answer-row { display: grid; grid-template-columns: minmax(150px, 1fr) 135px 45px; align-items: center; gap: 12px; padding: 14px 15px; border-radius: 12px; background: rgba(255,255,255,.88); box-shadow: inset 0 0 0 1px #edf3fa; }.answer-row p { margin: 0; color: #244a87; font-weight: 700; }.scale { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }.scale i { height: 12px; border-radius: 999px; background: #d8eafb; }.scale i.active { background: linear-gradient(90deg, #2bd4da, #2384f7); }.answer-row b { color: #1475ef; font-family: var(--nb-font-num); font-size: 21px; text-align: right; }.answer-row small { color: #7891b5; font-size: 12px; }.reflection-note { margin: 13px 3px 0; color: #6d86ab; font-size: 13px; }
.reflection-complete { display: grid; place-items: center; padding: 24px 10px 8px; text-align: center; }.reflection-complete > span { font-size: 48px; }.reflection-complete h3 { margin: 8px 0 5px; color: #173a7b; }.reflection-complete p { margin: 0; color: #5b76a2; line-height: 1.65; }
.adjustment-card { margin-top: 16px; padding: 20px; }.adjustment-heading { display: flex; justify-content: space-between; gap: 16px; align-items: center; }.rule-note { color: #6a86b1; font-size: 13px; }.strategy-copy { margin: 12px 0 16px 44px; color: #45679e; font-weight: 600; }.adjustment-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }.adjustment-tile { min-height: 136px; padding: 18px; border-radius: 14px; }.adjustment-tile h3 { margin: 10px 0 6px; color: #173b80; font-size: 19px; }.adjustment-tile p { margin: 0; color: #56709e; font-size: 14px; line-height: 1.55; }.tile-icon { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 10px; color: #fff; font-size: 24px; font-weight: 800; }.blue-soft { background: #e9f6ff; }.blue-soft .tile-icon { background: #318df2; }.yellow-soft { background: #fff6df; }.yellow-soft .tile-icon { background: #f5a628; }.green-soft { background: #e8f7f5; }.green-soft .tile-icon { background: #30aa9d; }.purple-soft { background: #eef0ff; }.purple-soft .tile-icon { background: #6a78e9; }
.secondary-row { display: grid; grid-template-columns: 1fr 250px; gap: 16px; margin-top: 16px; }.resource-summary { padding: 17px 20px; }.resource-content { display: flex; align-items: center; gap: 13px; margin-top: 13px; }.resource-icon { display: grid; flex: 0 0 47px; height: 47px; place-items: center; border-radius: 11px; background: #e8f5ff; color: #2585ed; font-size: 27px; }.resource-content b { color: #224984; }.resource-content p { margin: 4px 0 0; color: #5b76a2; font-size: 13px; line-height: 1.45; }.calibration-message { display: block; margin-top: 7px; color: #5272a7; font-size: 12px; line-height: 1.45; }.decision-summary { display: grid; align-content: center; gap: 3px; padding: 17px 20px; border: 1px solid #bfe4fa; border-radius: 18px; background: linear-gradient(135deg, rgba(226,248,255,.92), rgba(235,242,255,.9)); }.decision-summary span { color: #5680b4; font-size: 13px; font-weight: 700; }.decision-summary b { color: #1d529e; font-size: 20px; }.decision-summary small { color: #6380a5; line-height: 1.35; }
.action-row { display: flex; justify-content: center; margin-top: 22px; }.next-round-button { width: min(380px, 100%); height: 54px; border: 0 !important; border-radius: 17px !important; background: linear-gradient(90deg, #25d5d4, #1688f5) !important; box-shadow: 0 10px 20px -12px #1688f5; font-size: 20px; font-weight: 800; }.next-round-button span { margin-left: 16px; font-size: 30px; line-height: 0; vertical-align: -2px; }
@media (max-width: 940px) { .feedback-grid { grid-template-columns: 1fr; }.secondary-row { grid-template-columns: 1fr; }.decision-summary { min-height: 88px; }.performance-body { grid-template-columns: 210px 1fr; } }
@media (max-width: 640px) { .adaptive-feedback-page { padding-bottom: 90px; }.feedback-heading h1 { font-size: 40px; }.feedback-heading p { font-size: 15px; }.performance-card, .reflection-card, .adjustment-card { padding: 16px; }.performance-body { grid-template-columns: 1fr; }.accuracy-ring { width: 168px; }.adjustment-heading { align-items: flex-start; flex-direction: column; gap: 6px; }.strategy-copy { margin-left: 0; }.adjustment-tiles { grid-template-columns: 1fr; }.adjustment-tile { min-height: 0; }.answer-row { grid-template-columns: 1fr auto; }.answer-row .scale { grid-column: 1 / -1; grid-row: 2; }.rule-note { font-size: 12px; }.card-title h2 { font-size: 19px; } }
</style>
