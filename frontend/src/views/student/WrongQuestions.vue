<template>
  <div class="wrong-page">
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>错题本</h2>
          <p>卡片化展示错题摘要，支持知识点、错误类型、掌握状态智能筛选。</p>
        </div>
        <el-radio-group v-model="sortBy" size="small">
          <el-radio-button label="time">按最后练习时间</el-radio-button>
          <el-radio-button label="count">按错误次数</el-radio-button>
        </el-radio-group>
      </div>
    </header>

    <el-card class="filter-card">
      <el-form :inline="true">
        <el-form-item label="知识点">
          <el-select v-model="filters.kpCode" clearable placeholder="全部知识点" style="width: 180px">
            <el-option v-for="item in kpOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="错误类型">
          <el-select v-model="filters.errorType" clearable placeholder="全部类型" style="width: 160px">
            <el-option label="计算" value="计算" />
            <el-option label="概念" value="概念" />
            <el-option label="审题" value="审题" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="掌握状态">
          <el-select v-model="filters.masteryStatus" clearable placeholder="全部状态" style="width: 160px">
            <el-option label="待强化" value="待强化" />
            <el-option label="待巩固" value="待巩固" />
            <el-option label="已掌握" value="已掌握" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-loading="loading" class="wrong-list">
      <el-card v-for="item in filteredList" :key="item.questionId" class="wrong-card" shadow="hover">
        <div class="wrong-card-top">
          <div>
            <div class="summary">{{ item.content }}</div>
            <div class="meta-row">
              <el-tag size="small">{{ item.kpCode || '未分类' }}</el-tag>
              <el-tag size="small" type="warning">{{ item.errorType || '其他' }}</el-tag>
              <el-tag size="small" :type="statusType(item.masteryStatus)">{{ item.masteryStatus || '待强化' }}</el-tag>
            </div>
          </div>
          <div class="side-meta">
            <div>错误次数 {{ item.wrongCount || 1 }}</div>
            <div>{{ formatTime(item.lastPracticeTime) }}</div>
          </div>
        </div>

        <el-collapse>
          <el-collapse-item title="查看详情">
            <div class="detail-box">
              <div>题目序号：{{ item.visibleQuestionNo || ('错题' + (filteredList.indexOf(item) + 1)) }}</div>
              <div>难度：{{ item.difficulty || 3 }}</div>
              <div>题型：{{ item.question && item.question.type }}</div>
            </div>
            <div class="redo-row">
              <el-button type="primary" size="small" @click="redoOne(item)">进入重做模式</el-button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      <el-empty v-if="!loading && !filteredList.length" description="暂无符合条件的错题" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import api from '@/utils/api'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const sortBy = ref('time')
const filters = ref({ kpCode: '', errorType: '', masteryStatus: '' })

const kpOptions = computed(() => Array.from(new Set(list.value.map(item => item.kpCode).filter(Boolean))))

const filteredList = computed(() => {
  var result = list.value.slice()
  if (filters.value.kpCode) result = result.filter(item => item.kpCode === filters.value.kpCode)
  if (filters.value.errorType) result = result.filter(item => item.errorType === filters.value.errorType)
  if (filters.value.masteryStatus) result = result.filter(item => item.masteryStatus === filters.value.masteryStatus)
  result.sort((a, b) => {
    if (sortBy.value === 'count') return (b.wrongCount || 0) - (a.wrongCount || 0)
    return new Date(b.lastPracticeTime || 0) - new Date(a.lastPracticeTime || 0)
  })
  return result
})

function formatTime(value) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '暂无'
}

function statusType(status) {
  if (status === '已掌握') return 'success'
  if (status === '待巩固' || status === '学习中') return 'warning'
  return 'danger'
}

function loadData() {
  loading.value = true
  api.student.getWrongQuestions().then(res => {
    if (res.success) list.value = (res.data || []).map((item, index) => ({
      ...item,
      visibleQuestionNo: item.visibleQuestionNo || `错题${index + 1}`
    }))
  }).finally(() => {
    loading.value = false
  })
}

function redoOne(item) {
  if (!item || !item.questionId) return
  router.push({ path: '/student/practice', query: { kpId: item.knowledgePointId || 'custom', questionId: item.questionId, mode: 'wrong-redo' } })
}

onMounted(loadData)
</script>

<style scoped>
.wrong-page { padding: 24px; }
.header-content { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.header-text { flex: 1; }
.filter-card { margin-bottom: 16px; border-radius: 16px; }
.wrong-list { display: grid; gap: 16px; }
.wrong-card { border-radius: 18px; }
.wrong-card-top { display: flex; justify-content: space-between; gap: 16px; }
.summary { font-size: 15px; color: #111827; line-height: 1.7; margin-bottom: 10px; }
.meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
.side-meta { text-align: right; color: #6b7280; font-size: 13px; min-width: 120px; }
.detail-box { color: #4b5563; line-height: 1.9; }
.redo-row { margin-top: 12px; display: flex; justify-content: flex-end; }
</style>
