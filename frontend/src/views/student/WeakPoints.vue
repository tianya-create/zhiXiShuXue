<template>
  <div class="weak-points">
    <div class="page-header">
      <h2>薄弱知识点</h2>
      <p>按掌握度排序，优先补齐最需要强化的知识点</p>
    </div>

    <el-card v-if="newRecommendations.length" class="gradient-card recommend-card">
      <template #header>
        <div class="recommend-header">
          <div>
            <div class="recommend-title">老师批改后生成了新的补练推荐</div>
            <div class="recommend-subtitle">以下知识点来自最近一次作业结果，建议优先完成补练。</div>
          </div>
          <el-tag type="danger">新推荐 {{ newRecommendations.length }}</el-tag>
        </div>
      </template>

      <div class="recommend-list">
        <div v-for="item in newRecommendations" :key="item.id" class="recommend-item">
          <div class="recommend-main">
            <div class="recommend-name-row">
              <span class="recommend-name">{{ item.name }}</span>
              <el-tag type="warning" effect="dark">来自最近批改</el-tag>
            </div>
            <div class="recommend-meta">
              <span>错误次数 {{ item.wrongCount }}</span>
              <span>掌握度 {{ item.masteryRate }}%</span>
              <span v-if="item.lastHomeworkAt">作业时间 {{ formatDate(item.lastHomeworkAt) }}</span>
            </div>
          </div>
          <el-button type="danger" @click="startPractice(item)">立即补练</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="gradient-card">
      <el-table :data="weakPoints" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="知识点" min-width="180">
          <template #default="scope">
            <div class="kp-name-cell">
              <span>{{ scope.row.name }}</span>
              <el-tag v-if="scope.row.hasNewRecommendation" type="danger" size="small">新推荐</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="wrongCount" label="错误次数" width="100" />
        <el-table-column prop="practiceCount" label="补练次数" width="100" />
        <el-table-column prop="masteryRate" label="掌握度" width="180">
          <template #default="scope">
            <el-progress :percentage="parseInt(scope.row.masteryRate)" :color="getProgressColor(scope.row.masteryRate)" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="160">
          <template #default="scope">
            <div class="status-tags">
              <el-tag :type="scope.row.improved ? 'success' : 'danger'">
                {{ scope.row.improved ? '有提升' : '待加强' }}
              </el-tag>
              <el-tag v-if="scope.row.hasNewRecommendation" type="warning">待优先补练</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button :type="scope.row.hasNewRecommendation ? 'danger' : 'primary'" size="small" @click="startPractice(scope.row)">开始补练</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import dayjs from 'dayjs'

var router = useRouter()
var weakPoints = ref([])
var loading = ref(false)

var newRecommendations = computed(function() {
  return weakPoints.value.filter(function(item) {
    return !!item.hasNewRecommendation
  })
})

onMounted(function() {
  loadData()
})

function loadData() {
  loading.value = true
  api.get('/student/weak-points')
    .then(function(res) {
      if (res.success) {
        weakPoints.value = res.data || []
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
    .finally(function() {
      loading.value = false
    })
}

function getProgressColor(rate) {
  var num = parseInt(rate)
  if (num >= 80) return '#67C23A'
  if (num >= 60) return '#E6A23C'
  return '#F56C6C'
}

function startPractice(row) {
  router.push({ path: '/student/practice', query: { kpId: row.id } })
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.recommend-card {
  margin-bottom: 20px;
}

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.recommend-title {
  font-size: 16px;
  font-weight: 700;
}

.recommend-subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff1f0, #fff7e6);
}

.recommend-main {
  flex: 1;
}

.recommend-name-row,
.kp-name-cell,
.status-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recommend-name {
  font-size: 15px;
  font-weight: 700;
}

.recommend-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 8px;
  color: #6b7280;
  font-size: 13px;
}
</style>
