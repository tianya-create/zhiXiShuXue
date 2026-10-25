<template>
  <NotebookShell :menu="menu" subtitle="学习中心" role-label="学生" profile-path="/student/profile">
    <!-- 反馈页已有心理便利贴与像素教师，避免两个悬浮角色互相遮挡。 -->
    <template #extra><AiTutorWidget v-if="route.name !== 'StudentAdaptiveFeedback'" /></template>
  </NotebookShell>
</template>

<script setup>
import { useRoute } from 'vue-router'
import NotebookShell from '@/components/NotebookShell.vue'
import AiTutorWidget from '@/components/AiTutorWidget.vue'

const route = useRoute()

const menu = [
  { index: '/student/dashboard', label: '学习工作台', icon: 'House' },
  { index: '/student/assignments', label: '我的作业', icon: 'Document' },
  { index: '/student/knowledge', label: '知识图谱', icon: 'Share' },
  { index: '/student/weak-points', label: '薄弱知识点', icon: 'WarningFilled' },
  { index: '/student/practice', label: '薄弱补练', icon: 'EditPen' },
  { index: '/student/wrong-questions', label: '错题本', icon: 'Notebook' },
  { index: '/student/learning-track', label: '学习轨迹', icon: 'TrendCharts' }
]
</script>
