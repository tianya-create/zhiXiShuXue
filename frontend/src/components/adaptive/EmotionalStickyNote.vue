<template>
  <aside v-if="visible && guidance" :class="['guidance-note', `tone-${guidance.tone || 'steady'}`]" role="status">
    <button class="close" type="button" aria-label="关闭提示" @click="visible = false">×</button>
    <img src="/images/pixel-math-teacher.png" alt="" aria-hidden="true" />
    <div>
      <span class="emoji">{{ guidance.emoji }}</span>
      <h3>{{ guidance.title }}</h3>
      <p>{{ guidance.message }}</p>
      <button v-if="showSupport" class="support" type="button" @click="$emit('support')">我想和老师说说</button>
    </div>
  </aside>
</template>

<script setup>
import { ref, watch } from 'vue'
const props = defineProps({ guidance: { type: Object, default: null }, showSupport: Boolean })
defineEmits(['support'])
const visible = ref(Boolean(props.guidance))
watch(() => props.guidance, value => { visible.value = Boolean(value) })
</script>

<style scoped>
.guidance-note { position: fixed; right: 28px; bottom: 26px; z-index: 30; width: min(390px, calc(100vw - 32px)); display: grid; grid-template-columns: 82px 1fr; gap: 12px; padding: 18px 18px 16px 12px; border: 1px solid #d8c98e; border-radius: 6px 14px 8px 12px; background: #fff4b8; color: #403918; box-shadow: 0 16px 38px rgba(64, 55, 22, .2); transform: rotate(-.6deg); }
.guidance-note::after { content: ''; position: absolute; left: 42%; top: -9px; width: 72px; height: 20px; background: rgba(229, 216, 178, .75); transform: rotate(3deg); }
.guidance-note img { width: 82px; height: 82px; object-fit: contain; image-rendering: pixelated; align-self: end; }
.guidance-note h3 { margin: 0 24px 5px 0; font-family: var(--nb-font-hand); font-size: 22px; line-height: 1.15; }
.guidance-note p { margin: 0; font-size: 14px; line-height: 1.65; }
.emoji { float: right; font-size: 25px; }
.close { position: absolute; right: 8px; top: 5px; border: 0; background: transparent; color: inherit; font-size: 22px; cursor: pointer; }
.support { margin-top: 8px; padding: 5px 9px; border: 1px dashed currentColor; border-radius: 7px; background: rgba(255,255,255,.38); color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.tone-challenging { background: #ddecff; border-color: #8bb1e3; color: #203c62; }
.tone-steady { background: #e7f5dd; border-color: #9bc080; color: #2f4d25; }
@media (max-width: 700px) { .guidance-note { right: 16px; bottom: 14px; } }
</style>
