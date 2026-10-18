<template>
  <el-card class="question-card-ui" shadow="hover">
    <div class="question-card-header">
      <div>
        <div class="question-index">第 {{ index + 1 }} 题</div>
        <MathText class="question-title" :text="question.content" />
        <img v-if="question.imageUrl" :src="question.imageUrl" alt="题目附图" class="question-image" />
      </div>
      <div class="question-tags">
        <el-tag size="small">{{ question.type === 'subjective' ? '主观题' : '客观题' }}</el-tag>
        <el-tag size="small" effect="plain">难度 {{ question.difficulty || 3 }}</el-tag>
      </div>
    </div>

    <div v-if="isObjective && question.options && question.options.length" class="options-list">
      <el-radio-group v-model="localValue">
        <el-radio v-for="(option, idx) in question.options" :key="idx" :label="option">
          {{ String.fromCharCode(65 + idx) }}. <MathText :text="option" />
        </el-radio>
      </el-radio-group>
    </div>

    <el-input
      v-else
      v-model="localValue"
      type="textarea"
      :rows="4"
      placeholder="请输入你的答案"
    />

    <div v-if="result" class="question-result" :class="result.needsReview ? 'pending' : (result.isCorrect ? 'ok' : 'bad')">
      <div>你的答案：<MathText :text="result.userAnswer || '未作答'" /></div>
      <div v-if="result.needsReview">本题正在等待老师复核，复核后掌握度会更新。</div>
      <template v-else>
        <div>正确答案：<MathText :text="result.correctAnswer || '-'" /></div>
        <div>解析：<MathText :text="result.explanation || '暂无解析'" /></div>
      </template>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import MathText from '@/components/MathText.vue'

const props = defineProps({
  question: { type: Object, required: true },
  index: { type: Number, default: 0 },
  modelValue: { type: String, default: '' },
  result: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

const isObjective = computed(() => props.question.type !== 'subjective')
const localValue = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  }
})
</script>

<style scoped>
.question-card-ui { margin-bottom: 16px; border-radius: 16px; }
.question-card-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.question-index { color: #2563eb; font-size: 13px; margin-bottom: 6px; }
.question-title { font-size: 15px; line-height: 1.7; color: #1f2937; }
.question-image { max-width: 100%; margin-top: 8px; border-radius: 8px; }
.options-list { margin: 12px 0; }
.question-result { margin-top: 12px; padding: 12px; border-radius: 12px; font-size: 13px; }
.question-result.ok { background: #ecfdf5; color: #047857; }
.question-result.bad { background: #fef2f2; color: #b91c1c; }
.question-result.pending { background: #fffbeb; color: #b45309; }
</style>
