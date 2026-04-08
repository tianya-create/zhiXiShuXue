<template>
  <div class="wrong-questions">
    <div class="page-header">
      <h2>错题本</h2>
      <p>汇总错题、支持重做、掌握状态标注与相关知识点推送</p>
    </div>

    <el-card v-if="recommendations.length" class="gradient-card recommend-card">
      <template #header>智能推荐补练</template>
      <div class="recommend-list">
        <div v-for="item in recommendations" :key="item.knowledgePointId" class="recommend-item">
          <div>
            <div class="recommend-title">{{ item.knowledgePointName }}</div>
            <div class="recommend-desc">可进入该知识点查看错题并进行对话补练 · 当前掌握度 {{ item.masteryRate }}%</div>
          </div>
          <el-button type="primary" @click="goPractice(item)">去补练</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="gradient-card">
      <el-table :data="filteredWrongQuestions" style="width: 100%" v-loading="loading">
        <el-table-column prop="content" label="题目内容" min-width="260" show-overflow-tooltip />
        <el-table-column prop="type" label="题型" width="100">
          <template #default="scope">
            <el-tag>{{ getTypeText(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="scope">
            <el-tag :type="scope.row.mastered ? 'success' : 'danger'">
              {{ scope.row.mastered ? '已掌握' : '待巩固' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="studentAnswer" label="最近作答" width="140" show-overflow-tooltip />
        <el-table-column prop="answer" label="正确答案" width="140" show-overflow-tooltip />
        <el-table-column prop="wrongCount" label="累计出错" width="100" />
        <el-table-column prop="submittedAt" label="最近时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button type="primary" link @click="redoQuestion(scope.row)">重做</el-button>
              <el-button v-if="!scope.row.mastered" type="success" link @click="markMastered(scope.row)">标记已掌握</el-button>
              <el-button v-else type="warning" link @click="markUnmastered(scope.row)">再次出错回流</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var router = useRouter()
var route = useRoute()
var wrongQuestions = ref([])
var recommendations = ref([])
var loading = ref(false)

var filteredWrongQuestions = computed(function() {
  var kpId = route.query.kpId
  if (!kpId) return wrongQuestions.value
  return wrongQuestions.value.filter(function(item) {
    return item.knowledgePoints && item.knowledgePoints.indexOf(kpId) > -1
  })
})

onMounted(function() {
  loadData()
  loadRecommendations()
})

watch(function() {
  return route.query.kpId
}, function() {
  loading.value = false
})

function loadData() {
  loading.value = true
  api.get('/student/wrong-questions')
    .then(function(res) {
      if (res.success) {
        wrongQuestions.value = res.data || []
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
      ElMessage.error('加载错题本失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function loadRecommendations() {
  api.get('/student/practice-recommendations')
    .then(function(res) {
      if (res.success) {
        recommendations.value = res.data || []
      }
    })
    .catch(function(error) {
      console.error('加载推荐失败:', error)
    })
}

function redoQuestion(row) {
  var kpId = row.knowledgePoints && row.knowledgePoints.length ? row.knowledgePoints[0] : ''
  router.push({ path: '/student/practice', query: { kpId: kpId, questionId: row.id } })
}

function goPractice(item) {
  router.push({ path: '/student/practice', query: { kpId: item.knowledgePointId } })
}

function markMastered(row) {
  api.post('/student/wrong-questions/' + row.id + '/master')
    .then(function(res) {
      if (res.success) {
        ElMessage.success(res.message || '已标记为已掌握')
        loadData()
      }
    })
    .catch(function(error) {
      console.error('标记失败:', error)
      ElMessage.error('标记失败')
    })
}

function markUnmastered(row) {
  api.post('/student/wrong-questions/' + row.id + '/unmaster')
    .then(function(res) {
      if (res.success) {
        ElMessage.success(res.message || '已回流到待巩固状态')
        loadData()
      }
    })
    .catch(function(error) {
      console.error('回流失败:', error)
      ElMessage.error('回流失败')
    })
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '未知'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.recommend-card {
  margin-bottom: 20px;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
}

.recommend-title {
  font-weight: 700;
}

.recommend-desc {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}
</style>

