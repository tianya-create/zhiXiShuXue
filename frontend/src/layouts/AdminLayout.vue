<template>
  <NotebookShell
    :menu="menu"
    subtitle="管理后台"
    role-label="管理员"
    profile-path="/admin/settings"
    profile-label="系统设置"
  />
</template>

<script setup>
import NotebookShell from '@/components/NotebookShell.vue'

const menu = [
  { index: '/admin/dashboard', label: '首页概览', icon: 'House' },
  { index: '/admin/users', label: '用户管理', icon: 'User' },
  { index: '/admin/classes', label: '班级管理', icon: 'OfficeBuilding' },
  { index: '/admin/knowledge-points', label: '知识点管理', icon: 'Share' },
  { index: '/admin/questions', label: '题库管理', icon: 'Document' },
  { index: '/admin/statistics', label: '数据统计', icon: 'TrendCharts' },
  { index: '/admin/logs', label: '操作日志', icon: 'List' },
  { index: '/admin/settings', label: '系统设置', icon: 'Tools' }
]
</script>
