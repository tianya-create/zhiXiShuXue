<template>
  <NotebookShell :menu="menu" subtitle="教师空间" role-label="教师" profile-path="/teacher/profile" />
</template>

<script setup>
import NotebookShell from '@/components/NotebookShell.vue'

const menu = [
  { index: '/teacher/review-center', label: '复核与纠错', icon: 'EditPen' },
  { index: '/teacher/dashboard', label: '首页概览', icon: 'House' },
  {
    index: 'management',
    label: '班级与学生',
    icon: 'Management',
    children: [
      { index: '/teacher/classes', label: '班级管理' },
      { index: '/teacher/students', label: '学生管理' }
    ]
  },
  {
    index: 'papers',
    label: '试卷与作业',
    icon: 'Document',
    children: [
      { index: '/teacher/papers', label: '试卷管理' },
      { index: '/teacher/questions', label: '题目管理' },
      { index: '/teacher/assignments', label: '作业发布' }
    ]
  },
  { index: '/teacher/grading', label: '批改中心', icon: 'EditPen' },
  {
    index: 'analytics',
    label: '学情分析',
    icon: 'TrendCharts',
    children: [
      { index: '/teacher/analytics/class', label: '班级学情' },
      { index: '/teacher/analytics/student', label: '学生学情' }
    ]
  },
  { index: '/teacher/profile', label: '个人设置', icon: 'Setting' }
]
</script>
