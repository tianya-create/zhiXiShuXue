<template>
  <section :class="['resource-panel', `mode-${normalizedMode}`]">
    <div class="mode-mark" aria-hidden="true">{{ current.icon }}</div>
    <div class="mode-copy">
      <span>资源呈现 · {{ current.label }}</span>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
    </div>
    <div v-if="normalizedMode === 'visual'" class="visual-map" aria-label="关系图优先">
      <i>概念</i><b>→</b><i>关系</i><b>→</b><i>应用</i>
    </div>
    <ol v-else-if="normalizedMode === 'workedExample'" class="example-steps">
      <li>先看相近例题</li><li>逐步说明依据</li><li>再独立作答</li>
    </ol>
    <div v-else-if="normalizedMode === 'readWrite'" class="reading-tabs">
      <b>定义</b><b>性质</b><b>规范表达</b>
    </div>
    <div v-else class="practice-cue"><b>先做题</b><span>根据错误获得针对性提示</span></div>
    <p v-if="secondaryCurrent" class="secondary-channel">同时搭配：{{ secondaryCurrent.label }}，让你用两种方式建立理解。</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ mode: { type: String, default: 'readWrite' }, secondaryMode: { type: String, default: '' } })
const normalizedMode = computed(() => ['visual', 'workedExample', 'readWrite', 'practice'].includes(props.mode) ? props.mode : 'readWrite')
const modes = {
  visual: { icon: '🗺️', label: '图示优先', title: '先看关系，再处理细节', description: '本轮会优先保留关系图、条件标注和颜色线索，减少连续大段文字。' },
  workedExample: { icon: '🧑‍🏫', label: '讲解示范优先', title: '跟着示范走一遍', description: '本轮优先提供相近例题和逐步讲解，再逐渐撤掉提示。' },
  readWrite: { icon: '📝', label: '规范文字优先', title: '定义、性质、表达分层呈现', description: '本轮以规整文字和公式说明为主，必要图形仍会保留。' },
  practice: { icon: '🧩', label: '练习试错优先', title: '少讲一点，先动手验证', description: '本轮快速进入题目，作答后再根据具体错误给提示。' }
}
const current = computed(() => modes[normalizedMode.value])
const secondaryCurrent = computed(() => props.secondaryMode && props.secondaryMode !== normalizedMode.value ? modes[props.secondaryMode] : null)
</script>

<style scoped>
.resource-panel { display: grid; grid-template-columns: 54px minmax(220px, 1fr) minmax(210px, auto); gap: 14px; align-items: center; padding: 14px 16px; border: 1px solid var(--mode-color, var(--nb-blue)); border-radius: 14px; background: var(--mode-soft, var(--nb-blue-soft)); }
.mode-mark { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: var(--nb-sheet); font-size: 28px; }.mode-copy span { color: var(--mode-color, var(--nb-blue)); font-size: 12px; font-weight: 800; }.mode-copy h3 { margin: 2px 0; font-size: 17px; }.mode-copy p { margin: 0; color: var(--nb-ink-2); font-size: 13px; line-height: 1.5; }
.mode-visual { --mode-color:#557ad7; --mode-soft:#edf2ff; }.mode-workedExample { --mode-color:#8b5dc5; --mode-soft:#f5edff; }.mode-readWrite { --mode-color:#387e72; --mode-soft:#e9f7f2; }.mode-practice { --mode-color:#b56a2d; --mode-soft:#fff2df; }
.visual-map, .reading-tabs { display: flex; align-items: center; gap: 7px; }.visual-map i, .reading-tabs b { padding: 7px 9px; border-radius: 8px; background: var(--nb-sheet); font-style: normal; font-size: 13px; }.example-steps { display: flex; gap: 6px; margin: 0; padding: 0; list-style-position: inside; }.example-steps li { padding: 7px; border-radius: 7px; background: var(--nb-sheet); font-size: 12px; }.practice-cue { display: grid; gap: 4px; padding: 9px 12px; border: 1px dashed var(--mode-color); border-radius: 9px; }.practice-cue span { font-size: 12px; color: var(--nb-ink-2); }
.secondary-channel { grid-column: 2 / -1; margin: -4px 0 0; color: var(--nb-ink-2); font-size: 12px; }
@media (max-width: 760px) { .resource-panel { grid-template-columns: 50px 1fr; }.resource-panel > :last-child { grid-column: 1 / -1; }.example-steps { flex-direction: column; } }
</style>
