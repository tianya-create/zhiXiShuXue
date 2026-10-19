<template>
  <component :is="tag" class="math-text" v-html="html" />
</template>

<script setup>
import { computed } from 'vue'
import 'katex/dist/katex.min.css'
import { renderMath } from '@/utils/math-render'

const props = defineProps({
  text: { type: [String, Number], default: '' },
  tag: { type: String, default: 'span' }
})

const html = computed(() => renderMath(props.text))
</script>

<style scoped>
.math-text :deep(.katex) { font-size: 1.05em; }
.math-text :deep(.katex-display) { margin: 0.4em 0; overflow-x: auto; overflow-y: hidden; }
</style>
