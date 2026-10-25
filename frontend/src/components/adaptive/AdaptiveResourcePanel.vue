<template>
  <section :class="['resource-panel', `mode-${normalizedMode}`]">
    <div class="mode-mark" aria-hidden="true">{{ current.icon }}</div>
    <div class="mode-copy">
      <span>资源呈现 · {{ current.label }}</span>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
    </div>
    <div v-if="normalizedMode === 'visual'" class="mode-resource visual-resource" aria-label="关系图优先">
      <span class="map-node">核心概念</span><i>→</i><span class="map-node map-focus">关键关系</span><i>→</i><span class="map-node">题目应用</span>
      <small>{{ learningTarget }}：先辨认条件之间的关系，再落到计算或判断。</small>
    </div>
    <div v-else-if="normalizedMode === 'aural'" class="mode-resource aural-resource" aria-label="语音讲解优先">
      <button type="button" @click="playAuralGuide">{{ speaking ? '■ 停止讲解' : '▶ 播放思路旁白' }}</button>
      <span>先听“确认条件—选择规则—检查结果”的口述思路，再开始本轮作答。</span>
    </div>
    <div v-else-if="normalizedMode === 'readWrite'" class="mode-resource reading-resource" aria-label="文字概念解析">
      <article><b>概念</b><span>本题先确认已知条件和所求。</span></article>
      <article><b>规则</b><span>调用对应的运算或等式性质。</span></article>
      <article><b>表达</b><span>按规范步骤写出推导过程。</span></article>
    </div>
    <div v-else class="mode-resource practice-resource" aria-label="练习试错优先">
      <strong>先独立作答</strong>
      <span>提交后会保留你的错误线索，再给针对性提示。</span>
      <em>本轮 {{ learningTarget }} 以练习为主</em>
    </div>
    <p v-if="secondaryCurrent" class="secondary-channel">同时搭配：{{ secondaryCurrent.label }}，让你用两种方式建立理解。</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
const props = defineProps({
  mode: { type: String, default: 'readWrite' },
  secondaryMode: { type: String, default: '' },
  knowledgePointName: { type: String, default: '' }
})
const normalizedMode = computed(() => ['visual', 'aural', 'readWrite', 'kinesthetic'].includes(props.mode) ? props.mode : 'readWrite')
const modes = {
  visual: { icon: '🗺️', label: '图示优先', title: '先看关系，再处理细节', description: '本轮会优先保留关系图、条件标注和颜色线索，减少连续大段文字。' },
  aural: { icon: '🎧', label: '语音讲解优先', title: '听思路，再跟进步骤', description: '本轮优先提供解题思路口述和步骤旁白，文字只保留关键提示。' },
  readWrite: { icon: '📝', label: '规范文字优先', title: '定义、性质、表达分层呈现', description: '本轮以规整文字和公式说明为主，必要图形仍会保留。' },
  kinesthetic: { icon: '🧩', label: '练习试错优先', title: '少讲一点，先动手验证', description: '本轮快速进入题目，作答后再根据具体错误给提示。' }
}
const current = computed(() => modes[normalizedMode.value])
const secondaryCurrent = computed(() => props.secondaryMode && props.secondaryMode !== normalizedMode.value ? modes[props.secondaryMode] : null)
const learningTarget = computed(() => props.knowledgePointName || '当前知识点')
const speaking = ref(false)
function playAuralGuide() {
  if (!('speechSynthesis' in window)) return
  if (speaking.value) {
    window.speechSynthesis.cancel()
    speaking.value = false
    return
  }
  const speech = new SpeechSynthesisUtterance(`${learningTarget.value}练习。先确认题目给出的条件和所求，再选择对应的运算规则，完成后检查每一步是否成立。`)
  speech.lang = 'zh-CN'
  speech.onend = () => { speaking.value = false }
  speaking.value = true
  window.speechSynthesis.speak(speech)
}
onBeforeUnmount(() => window.speechSynthesis?.cancel())
</script>

<style scoped>
.resource-panel { display: grid; grid-template-columns: 54px minmax(210px, .9fr) minmax(310px, 1.35fr); gap: 14px; align-items: center; padding: 14px 16px; border: 1px solid var(--mode-color, var(--nb-blue)); border-radius: 14px; background: var(--mode-soft, var(--nb-blue-soft)); }
.mode-mark { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: var(--nb-sheet); font-size: 28px; }.mode-copy span { color: var(--mode-color, var(--nb-blue)); font-size: 12px; font-weight: 800; }.mode-copy h3 { margin: 2px 0; font-size: 17px; }.mode-copy p { margin: 0; color: var(--nb-ink-2); font-size: 13px; line-height: 1.5; }
.mode-visual { --mode-color:#557ad7; --mode-soft:#edf2ff; }.mode-aural { --mode-color:#8b5dc5; --mode-soft:#f5edff; }.mode-readWrite { --mode-color:#387e72; --mode-soft:#e9f7f2; }.mode-kinesthetic { --mode-color:#b56a2d; --mode-soft:#fff2df; }
.mode-resource { min-width: 0; }.visual-resource { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 5px; }.visual-resource small { grid-column: 1 / -1; color: var(--nb-ink-2); font-size: 12px; line-height: 1.45; }.visual-resource i { color: var(--mode-color); font-size: 18px; font-style: normal; }.map-node { display: grid; min-height: 38px; place-items: center; padding: 5px; border-radius: 9px; background: var(--nb-sheet); color: var(--nb-ink-2); font-size: 12px; text-align: center; }.map-node.map-focus { border: 1px solid var(--mode-color); color: var(--mode-color); font-weight: 800; }
.example-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin: 0; padding: 0; list-style: none; }.example-steps li { display: grid; gap: 3px; padding: 8px; border-radius: 8px; background: var(--nb-sheet); }.example-steps b { color: var(--mode-color); font-size: 12px; }.example-steps span { color: var(--nb-ink-2); font-size: 11px; line-height: 1.35; }
.reading-resource { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }.reading-resource article { display: grid; gap: 4px; min-height: 60px; padding: 8px; border-left: 3px solid var(--mode-color); border-radius: 0 8px 8px 0; background: var(--nb-sheet); }.reading-resource b { color: var(--mode-color); font-size: 12px; }.reading-resource span { color: var(--nb-ink-2); font-size: 11px; line-height: 1.35; }
.aural-resource { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,.55); }.aural-resource button { flex: 0 0 auto; padding: 9px 12px; border: 0; border-radius: 999px; background: var(--mode-color); color: #fff; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }.aural-resource span { color: var(--nb-ink-2); font-size: 12px; line-height: 1.5; }
.practice-resource { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 5px 9px; padding: 9px 12px; border: 1px dashed var(--mode-color); border-radius: 10px; background: rgba(255,255,255,.42); }.practice-resource strong { padding: 8px 10px; border-radius: 8px; background: var(--mode-color); color: #fff; font-size: 13px; }.practice-resource span { color: var(--nb-ink-2); font-size: 12px; line-height: 1.4; }.practice-resource em { grid-column: 1 / -1; color: var(--mode-color); font-size: 11px; font-style: normal; }
.secondary-channel { grid-column: 2 / -1; margin: -4px 0 0; color: var(--nb-ink-2); font-size: 12px; }
@media (max-width: 860px) { .resource-panel { grid-template-columns: 50px 1fr; }.mode-resource { grid-column: 1 / -1; }.secondary-channel { grid-column: 1 / -1; }.example-steps, .reading-resource { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 540px) { .visual-resource { grid-template-columns: 1fr; }.visual-resource i { display: none; }.example-steps, .reading-resource { grid-template-columns: 1fr; } }
</style>
