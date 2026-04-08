<template>
  <div class="knowledge-graph">
    <div class="page-header">
      <h2>知识图谱</h2>
      <p>查看您的知识点掌握情况，并可直达相关错题</p>
    </div>

    <el-card class="gradient-card">
      <template #header>
        <span>知识点掌握状态</span>
      </template>

      <div class="knowledge-container">
        <div v-for="kp in knowledgePoints" :key="kp.id" class="knowledge-category">
          <h3>{{ kp.name }}</h3>
          <div class="knowledge-nodes">
            <div v-for="child in kp.children" :key="child.id" :class="['knowledge-node', getMasteryClass(child.masteryRate)]">
              <div class="node-main" @click="viewDetail(child)">
                <div class="node-name">{{ child.name }}</div>
                <div class="node-meta">
                  <span class="mastery-rate">{{ child.masteryRate }}%</span>
                  <el-tag size="small" :type="getTagType(child.masteryLabel)">{{ child.masteryLabel }}</el-tag>
                </div>
                <div class="node-footer">
                  错题 {{ child.wrongCount || 0 }} · 补练 {{ child.practiceCount || 0 }}
                </div>
                <div class="node-actions">
                  <el-button size="small" type="danger" plain @click.stop="goWrongQuestions(child)">查看错题</el-button>
                  <el-button size="small" type="primary" plain @click.stop="goPractice(child)">进行补练</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

var router = useRouter()
var knowledgePoints = ref([])

onMounted(function() {
  loadKnowledge()
})

function loadKnowledge() {
  api.get('/student/knowledge-graph')
    .then(function(res) {
      if (res.success) {
        var result = []
        for (var i = 0; i < res.data.length; i++) {
          if (!res.data[i].parentId) {
            result.push(res.data[i])
          }
        }
        knowledgePoints.value = result
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
}

function getMasteryClass(rate) {
  if (rate >= 80) return 'mastered'
  if (rate >= 60) return 'learning'
  return 'weak'
}

function getTagType(label) {
  if (label === '已掌握') return 'success'
  if (label === '学习中') return 'warning'
  return 'danger'
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '题目'
}

function viewDetail(kp) {
  goPractice(kp)
}

function goWrongQuestions(kp) {
  router.push({ path: '/student/wrong-questions', query: { kpId: kp.id } })
}

function goPractice(kp) {
  router.push({ path: '/student/practice', query: { kpId: kp.id } })
}
</script>

<style scoped>
.knowledge-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.knowledge-category h3 {
  margin-bottom: 16px;
  color: var(--text-primary);
}

.knowledge-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.knowledge-node {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 240px;
  max-width: 320px;
  padding: 14px 18px;
  border-radius: 14px;
  transition: all 0.3s;
}

.node-main {
  cursor: pointer;
}

.knowledge-node.mastered {
  background: linear-gradient(135deg, #67C23A, #85CE61);
  color: white;
}

.knowledge-node.learning {
  background: linear-gradient(135deg, #E6A23C, #F3D19E);
  color: white;
}

.knowledge-node.weak {
  background: linear-gradient(135deg, #F56C6C, #FAACA8);
  color: white;
}

.knowledge-node:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.node-name {
  font-weight: 700;
}

.node-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mastery-rate,
.node-footer {
  font-size: 12px;
  opacity: 0.92;
}


.node-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.action-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.action-btn-primary {
  border-color: rgba(255, 255, 255, 0.85);
}

.action-btn-danger {
  border-color: rgba(255, 255, 255, 0.85);
}

</style>
