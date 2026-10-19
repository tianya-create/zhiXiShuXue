<template>
  <div class="admin-statistics">
    <div class="page-header">
      <h2>数据统计</h2>
      <p>平台的用户、题目和答题数据，可以导出成表格。</p>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>数据概览</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户总数">{{ stats.userCount }}</el-descriptions-item>
            <el-descriptions-item label="教师数量">{{ stats.teacherCount }}</el-descriptions-item>
            <el-descriptions-item label="学生数量">{{ stats.studentCount }}</el-descriptions-item>
            <el-descriptions-item label="班级数量">{{ stats.classCount }}</el-descriptions-item>
            <el-descriptions-item label="试卷数量">{{ stats.paperCount }}</el-descriptions-item>
            <el-descriptions-item label="题目数量">{{ stats.questionCount }}</el-descriptions-item>
            <el-descriptions-item label="答题记录">{{ stats.answerCount }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>数据导出</template>
          <div class="export-buttons">
            <button
              v-for="item in exportItems"
              :key="item.key"
              type="button"
              class="export-tile"
              :style="{ '--tile': item.color, '--tile-soft': item.soft }"
              @click="exportData(item.key)"
            >
              <span class="export-icon"><el-icon><Download /></el-icon></span>
              <span class="export-label">{{ item.label }}</span>
            </button>
          </div>
        </el-card>
        
        <el-card class="gradient-card" style="margin-top: 20px;">
          <template #header>数据备份</template>
          <div class="backup-actions">
            <el-button type="primary" @click="backupData">备份数据</el-button>
            <el-upload
              :show-file-list="false"
              accept=".json"
              :before-upload="restoreData"
            >
              <el-button>恢复数据</el-button>
            </el-upload>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
const exportItems = [
  { key: 'users', label: '用户数据', color: 'var(--nb-blue)', soft: 'var(--nb-blue-soft)' },
  { key: 'students', label: '学生数据', color: 'var(--nb-purple)', soft: 'var(--nb-purple-soft)' },
  { key: 'teachers', label: '教师数据', color: 'var(--nb-pink)', soft: 'var(--nb-pink-soft)' },
  { key: 'classes', label: '班级数据', color: 'var(--nb-teal)', soft: 'var(--nb-teal-soft)' },
  { key: 'papers', label: '试卷数据', color: 'var(--nb-orange)', soft: 'var(--nb-orange-soft)' },
  { key: 'answers', label: '答题数据', color: 'var(--nb-green)', soft: 'var(--nb-green-soft)' }
]

import { reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

var stats = reactive({
  userCount: 0,
  teacherCount: 0,
  studentCount: 0,
  classCount: 0,
  paperCount: 0,
  questionCount: 0,
  answerCount: 0
})

onMounted(function() {
  loadStats()
})

function loadStats() {
  api.get('/admin/statistics/overview')
    .then(function(res) {
      if (res.success) {
        stats.userCount = res.data.userCount || 0
        stats.teacherCount = res.data.teacherCount || 0
        stats.studentCount = res.data.studentCount || 0
        stats.classCount = res.data.classCount || 0
        stats.paperCount = res.data.paperCount || 0
        stats.questionCount = res.data.questionCount || 0
        stats.answerCount = res.data.answerCount || 0
      }
    })
    .catch(function(error) {
      console.error('加载统计失败:', error)
    })
}

function exportData(type) {
  api.get('/admin/export/' + type)
    .then(function(res) {
      if (res.success) {
        var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        var url = URL.createObjectURL(blob)
        var link = document.createElement('a')
        link.href = url
        var date = new Date().toISOString().slice(0, 10)
        link.download = type + '_' + date + '.json'
        link.click()
        URL.revokeObjectURL(url)
        ElMessage.success('导出成功')
      }
    })
    .catch(function(error) {
      ElMessage.error('导出失败')
    })
}

function backupData() {
  api.get('/admin/backup')
    .then(function(res) {
      if (res.success) {
        var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        var url = URL.createObjectURL(blob)
        var link = document.createElement('a')
        link.href = url
        var date = new Date().toISOString().slice(0, 10)
        link.download = 'backup_' + date + '.json'
        link.click()
        URL.revokeObjectURL(url)
        ElMessage.success('备份成功')
      }
    })
    .catch(function(error) {
      ElMessage.error('备份失败')
    })
}

function restoreData(file) {
  var reader = new FileReader()
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result)
      api.post('/admin/restore', { data: data.data })
        .then(function(res) {
          if (res.success) {
            ElMessage.success('恢复成功')
            loadStats()
          }
        })
        .catch(function(error) {
          ElMessage.error('恢复失败')
        })
    } catch (error) {
      ElMessage.error('恢复失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  return false
}
</script>

<style scoped>
.export-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.export-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--tile-soft);
  border-radius: 12px;
  background: var(--tile-soft);
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  color: var(--nb-ink);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.export-tile:hover {
  border-color: var(--tile);
  transform: translateY(-1px);
}

.export-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--tile);
  color: #fff;
  font-size: 18px;
}

.backup-actions {
  display: flex;
  gap: 12px;
}
</style>
