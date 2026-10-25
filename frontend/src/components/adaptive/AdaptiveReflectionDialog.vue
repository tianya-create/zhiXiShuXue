<template>
  <el-dialog
    :model-value="modelValue"
    width="min(680px, 94vw)"
    class="reflection-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="reflection-head">
      <img src="/images/pixel-math-teacher.png" alt="像素风数学老师" />
      <div>
        <p class="eyebrow">完成啦 · 用 20 秒告诉老师你的真实感受</p>
        <h2>这组题做下来，你感觉怎么样？</h2>
        <p>答案没有对错，只用于安排下一组更适合你的题目。</p>
      </div>
    </div>

    <section class="emotion-section">
      <h3>现在的感受更接近哪一个？</h3>
      <div class="emotion-grid">
        <button
          v-for="item in emotions"
          :key="item.value"
          type="button"
          :class="['emotion-button', { active: form.emotion === item.value }]"
          @click="form.emotion = item.value"
        >
          <span>{{ item.emoji }}</span>{{ item.label }}
        </button>
      </div>
    </section>

    <section v-for="item in items" :key="item.id" class="likert-item">
      <div class="question-line">
        <span>{{ item.text }}</span>
        <small>1=很不符合，5=非常符合</small>
      </div>
      <div class="likert-scale">
        <button
          v-for="score in 5"
          :key="score"
          type="button"
          :class="{ active: form[item.id] === score }"
          @click="form[item.id] = score"
        >
          <b>{{ score }}</b><span>{{ scaleLabels[score - 1] }}</span>
        </button>
      </div>
    </section>

    <template #footer>
      <div class="dialog-footer">
        <span>{{ validationHint }}</span>
        <el-button type="primary" size="large" :loading="submitting" @click="submit">保存感受并调整下一组</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const props = defineProps({
  modelValue: Boolean,
  round: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'completed'])
const items = [
  { id: 'controlItem1', dimension: 'control', text: '做完这组题，我有信心掌握刚才涉及的知识点。' },
  { id: 'controlItem2', dimension: 'control', text: '如果再遇到同类型的题，我觉得自己能够独立做出来。' },
  { id: 'cognitiveLoadItem', dimension: 'load', text: '完成这组题时，我需要同时处理的信息很多，感觉比较费力。' }
]
const emotions = [
  { value: 'tired', emoji: '😮‍💨', label: '有点累' },
  { value: 'worried', emoji: '😟', label: '没把握' },
  { value: 'steady', emoji: '🙂', label: '还算稳定' },
  { value: 'confident', emoji: '😄', label: '很有把握' },
  { value: 'energized', emoji: '🤩', label: '想挑战' }
]
const scaleLabels = ['很不符合', '不太符合', '一般', '比较符合', '非常符合']
const form = reactive({ emotion: '', controlItem1: null, controlItem2: null, cognitiveLoadItem: null })
const submitting = ref(false)
const complete = computed(() => Boolean(form.emotion && form.controlItem1 && form.controlItem2 && form.cognitiveLoadItem))
const validationHint = computed(() => complete.value ? '已完成全部选择' : '请完成所有选择后提交')

watch(() => props.round?.id, () => {
  Object.assign(form, { emotion: '', controlItem1: null, controlItem2: null, cognitiveLoadItem: null })
})

function submit() {
  if (!complete.value) {
    ElMessage.warning('请先完成感受和三道评分')
    return
  }
  if (!props.round?.id) return
  submitting.value = true
  api.post(`/student/learning-rounds/${props.round.id}/reflection`, { ...form })
    .then(res => {
      if (!res.success) return
      emit('completed', res.data)
      emit('update:modelValue', false)
    })
    .catch(error => ElMessage.error(error.response?.data?.message || '保存失败，请稍后再试'))
    .finally(() => { submitting.value = false })
}
</script>

<style scoped>
.reflection-head { display: grid; grid-template-columns: 106px 1fr; gap: 20px; align-items: center; margin: -8px 0 22px; }
.reflection-head img { width: 106px; height: 106px; object-fit: contain; image-rendering: pixelated; filter: drop-shadow(0 8px 10px rgba(47, 57, 92, .16)); }
.reflection-head h2 { margin: 4px 0 6px; color: var(--nb-ink); font-family: var(--nb-font-display); font-size: 27px; font-weight: 500; }
.reflection-head p { margin: 0; color: var(--nb-ink-2); line-height: 1.6; }
.reflection-head .eyebrow { color: var(--nb-blue); font-size: 13px; font-weight: 800; letter-spacing: .04em; }
.emotion-section, .likert-item { padding: 16px; border: 1px solid var(--nb-line); border-radius: 14px; background: color-mix(in srgb, var(--nb-sheet) 90%, var(--nb-blue-soft)); }
.emotion-section h3 { margin: 0 0 12px; font-size: 16px; }
.emotion-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.emotion-button, .likert-scale button { border: 1px solid var(--nb-line); border-radius: 10px; background: var(--nb-sheet); color: var(--nb-ink-2); font: inherit; cursor: pointer; transition: .16s ease; }
.emotion-button { display: grid; place-items: center; gap: 4px; min-height: 72px; padding: 8px 4px; }
.emotion-button span { font-size: 28px; }
.emotion-button.active, .likert-scale button.active { color: var(--nb-blue); border-color: var(--nb-blue); background: var(--nb-blue-soft); box-shadow: 0 0 0 2px color-mix(in srgb, var(--nb-blue) 14%, transparent); }
.likert-item { margin-top: 12px; }
.question-line { display: flex; justify-content: space-between; gap: 14px; line-height: 1.55; font-weight: 700; }
.question-line small { flex-shrink: 0; color: var(--nb-ink-3); font-weight: 400; }
.likert-scale { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.likert-scale button { display: grid; gap: 2px; padding: 8px 4px; }
.likert-scale b { font-size: 18px; }
.likert-scale span { font-size: 12px; }
.dialog-footer { display: flex; justify-content: space-between; align-items: center; gap: 16px; color: var(--nb-ink-3); }
@media (max-width: 620px) {
  .reflection-head { grid-template-columns: 76px 1fr; }
  .reflection-head img { width: 76px; height: 76px; }
  .emotion-grid { grid-template-columns: repeat(3, 1fr); }
  .likert-scale span, .question-line small { display: none; }
  .dialog-footer { align-items: stretch; flex-direction: column; }
}
</style>
