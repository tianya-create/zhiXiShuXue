<template>
  <div class="wrong-questions-page">
    <div class="page-header">
      <h2>个人错题本</h2>
      <p>汇总全部错题，支持重做、掌握状态管理、笔记记录，并联动个性化补练推荐。</p>
    </div>

    <div class="page-grid">
      <div class="main-column">
        <el-card v-if="recommendations.length" class="recommend-card gradient-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">个性化补练推荐</div>
                <div class="section-desc">根据当前薄弱知识点自动推送，建议优先完成。</div>
              </div>
              <el-tag type="warning">{{ recommendations.length }} 个知识点</el-tag>
            </div>
          </template>

          <div class="recommend-list">
            <div v-for="item in recommendations" :key="item.knowledgePointId" class="recommend-item">
              <div class="recommend-main">
                <div class="recommend-title">{{ item.knowledgePointName }}</div>
                <div class="recommend-desc">
                  当前掌握度 {{ item.masteryRate }}%，系统已为你自动生成补练题。
                </div>
              </div>
              <el-button type="primary" @click="goPractice(item)">去补练</el-button>
            </div>
          </div>
        </el-card>

        <el-card class="gradient-card">
          <template #header>
            <div class="section-header">
              <div>
                <div class="section-title">错题列表</div>
                <div class="section-desc">做对后可标记已掌握，做错会继续回流巩固。</div>
              </div>
              <el-tag type="danger">{{ filteredWrongQuestions.length }} 道</el-tag>
            </div>
          </template>

          <div class="wrong-question-list" v-loading="loading">
            <div
              v-for="row in filteredWrongQuestions"
              :key="row.id"
              class="wrong-question-card"
            >
              <div class="question-top">
                <div class="question-top-left">
                  <el-tag effect="plain">{{ getTypeText(row.type) }}</el-tag>
                  <el-tag :type="getMasteryTagType(row)">
                    {{ row.mastered ? '已掌握' : '待巩固' }}
                  </el-tag>
                  <span class="question-time">最近时间：{{ formatDate(row.submittedAt) }}</span>
                </div>
                <div class="question-top-right">
                  累计出错 {{ row.wrongCount }} 次
                </div>
              </div>

              <div class="question-content">{{ row.content }}</div>

              <div v-if="row.options && row.options.length" class="option-list">
                <div v-for="(option, index) in row.options" :key="index" class="option-item">
                  {{ String.fromCharCode(65 + index) }}. {{ option }}
                </div>
              </div>

              <div class="answer-meta">
                <span>上次作答：{{ row.studentAnswerDisplay || row.studentAnswer || '未作答' }}</span>
                <span>正确答案：{{ row.answerDisplay || row.answer || '-' }}</span>
              </div>

              <div class="note-panel">
                <div class="note-label">我的笔记</div>
                <el-input
                  v-model="notesMap[row.id]"
                  type="textarea"
                  :rows="3"
                  placeholder="记录这道题出错原因、解题提醒或易混点"
                />
                <div class="note-actions">
                  <el-button size="small" type="info" plain @click="saveNote(row)">保存笔记</el-button>
                </div>
              </div>

              <div v-if="activeRedoId === row.id" class="redo-panel">
                <div class="redo-title">错题重做</div>
                <el-input
                  v-model="redoAnswer"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入你的重做答案"
                />
                <div class="redo-actions roomy-actions">
                  <el-button size="large" @click="cancelRedo">取消</el-button>
                  <el-button
                    size="large"
                    type="primary"
                    :loading="redoSubmitting"
                    @click="submitRedo(row)"
                  >
                    提交重做
                  </el-button>
                </div>

                <div
                  v-if="redoResult"
                  class="redo-result"
                  :class="redoResult.correct ? 'is-correct' : 'is-wrong'"
                >
                  <div class="redo-result-title">
                    {{ redoResult.correct ? '回答正确，已自动标记为已掌握' : '这次还没答对，建议先回顾解析' }}
                  </div>
                  <div class="redo-result-line">你的答案：{{ redoResult.studentAnswer || '未作答' }}</div>
                  <div class="redo-result-line">正确答案：{{ redoResult.answer || '-' }}</div>
                  <div v-if="redoResult.analysis" class="redo-result-analysis">
                    解析：{{ redoResult.analysis }}
                  </div>
                </div>
              </div>

              <div v-else class="question-actions">
                <el-button type="primary" @click="openRedo(row)">重做</el-button>
                <el-button
                  v-if="!row.mastered"
                  type="success"
                  plain
                  @click="markMastered(row)"
                >
                  标记已掌握
                </el-button>
                <el-button
                  v-else
                  type="warning"
                  plain
                  @click="markUnmastered(row)"
                >
                  标记未掌握
                </el-button>
              </div>
            </div>

            <el-empty
              v-if="!filteredWrongQuestions.length && !loading"
              description="当前没有错题记录"
            />
          </div>
        </el-card>
      </div>

      <div class="side-column">
        <el-card class="gradient-card summary-card">
          <template #header>
            <div class="section-title">错题概览</div>
          </template>

          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-label">错题总数</div>
              <div class="summary-value">{{ filteredWrongQuestions.length }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">已掌握</div>
              <div class="summary-value">{{ masteredCount }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">待巩固</div>
              <div class="summary-value">{{ unmasteredCount }}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">笔记数</div>
              <div class="summary-value">{{ noteCount }}</div>
            </div>
          </div>
        </el-card>

        <el-card class="gradient-card trend-card">
          <template #header>
            <div class="section-title">复盘建议</div>
          </template>

          <div class="advice-list">
            <div class="advice-item">优先处理重复出错次数较高的题目。</div>
            <div class="advice-item">先完成“待巩固”题，再回头整理“已掌握”题笔记。</div>
            <div class="advice-item">每道错题至少写一句“错误原因”，更利于避免重复失误。</div>
            <div class="advice-item">做完错题后，建议进入对应知识点的薄弱补练。</div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const wrongQuestions = ref([])
const recommendations = ref([])
const loading = ref(false)
const activeRedoId = ref('')
const redoAnswer = ref('')
const redoSubmitting = ref(false)
const redoResult = ref(null)
const notesMap = ref({})

const filteredWrongQuestions = computed(() => {
  const kpId = route.query.kpId
  if (!kpId) return wrongQuestions.value
  return wrongQuestions.value.filter(item => {
    return item.knowledgePoints && item.knowledgePoints.indexOf(kpId) > -1
  })
})

const masteredCount = computed(() =>
  filteredWrongQuestions.value.filter(item => item.mastered).length
)

const unmasteredCount = computed(() =>
  filteredWrongQuestions.value.filter(item => !item.mastered).length
)

const noteCount = computed(() =>
  Object.values(notesMap.value).filter(Boolean).length
)

onMounted(() => {
  loadAll()
  loadRecommendations()
})

watch(
  () => route.query.kpId,
  () => {
    loading.value = false
  }
)

function loadAll() {
  loading.value = true
  api.get('/student/wrong-questions')
    .then((res) => {
      if (res.success) {
        wrongQuestions.value = res.data || []
        const noteMap = {}
        wrongQuestions.value.forEach(item => {
          noteMap[item.id] = item.note || ''
        })
        notesMap.value = noteMap
      }
    })
    .catch((error) => {
      console.error('加载失败:', error)
      ElMessage.error('加载错题本失败')
    })
    .finally(() => {
      loading.value = false
    })
}

function loadRecommendations() {
  api.get('/student/practice-recommendations')
    .then((res) => {
      if (res.success) {
        recommendations.value = res.data || []
      }
    })
    .catch((error) => {
      console.error('加载推荐失败:', error)
    })
}

function openRedo(row) {
  activeRedoId.value = row.id
  redoAnswer.value = ''
  redoResult.value = null
}

function cancelRedo() {
  activeRedoId.value = ''
  redoAnswer.value = ''
  redoResult.value = null
}

function submitRedo(row) {
  if (!redoAnswer.value.trim()) {
    ElMessage.warning('请先输入答案')
    return
  }

  redoSubmitting.value = true
  api.post('/student/practice/' + ((row.knowledgePoints && row.knowledgePoints[0]) || 'custom') + '/submit', {
    answers: { [row.id]: redoAnswer.value.trim() },
    questionIds: [row.id],
    mode: 'wrong-question',
    title: '错题重做'
  })
    .then((res) => {
      if (res && res.success) {
        const result = res.data && res.data.questionResults ? res.data.questionResults[0] : null
        redoResult.value = {
          correct: !!(result && result.correct),
          studentAnswer: redoAnswer.value.trim(),
          answer: row.answerDisplay || row.answer,
          analysis: buildAnalysisText(row, result && result.correct)
        }
        ElMessage.success(res.message || '重做提交成功')
        loadAll()
      }
    })
    .catch((error) => {
      console.error('重做提交失败:', error)
      ElMessage.error('重做提交失败')
    })
    .finally(() => {
      redoSubmitting.value = false
    })
}

function buildAnalysisText(row, correct) {
  if (correct) {
    return '本题已答对，系统已自动将该错题标记为已掌握。'
  }
  if (row.type === 'choice') {
    return '建议重新核对题干条件与各选项之间的对应关系。'
  }
  if (row.type === 'fill') {
    return '建议重新检查计算步骤、符号和结果是否完整。'
  }
  return '建议对照标准答案补全解题思路，再重新整理关键步骤。'
}

function goPractice(item) {
  router.push({ path: '/student/practice', query: { kpId: item.knowledgePointId } })
}

function markMastered(row) {
  api.post('/student/wrong-questions/' + row.id + '/master')
    .then((res) => {
      if (res.success) {
        ElMessage.success(res.message || '已标记为已掌握')
        loadAll()
      }
    })
    .catch((error) => {
      console.error('标记失败:', error)
      ElMessage.error('标记失败')
    })
}

function markUnmastered(row) {
  api.post('/student/wrong-questions/' + row.id + '/unmaster')
    .then((res) => {
      if (res.success) {
        ElMessage.success(res.message || '已回流到待巩固状态')
        loadAll()
      }
    })
    .catch((error) => {
      console.error('回流失败:', error)
      ElMessage.error('回流失败')
    })
}

function saveNote(row) {
  api.post('/student/wrong-questions/' + row.id + '/note', {
    note: notesMap.value[row.id] || ''
  })
    .then((res) => {
      if (res.success) {
        row.note = notesMap.value[row.id] || ''
        ElMessage.success(res.message || '笔记已保存')
      }
    })
    .catch((error) => {
      console.error('保存笔记失败:', error)
      ElMessage.error('保存笔记失败')
    })
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '题目'
}

function getMasteryRate(row) {
  const kpId = row && row.knowledgePoints && row.knowledgePoints.length ? row.knowledgePoints[0] : ''
  const recommendation = recommendations.value.find(function(item) {
    return item.knowledgePointId === kpId
  })
  if (recommendation) return parseInt(recommendation.masteryRate || 0)
  return row.mastered ? 80 : 59
}

function getMasteryText(row) {
  const rate = getMasteryRate(row)
  if (row.mastered || rate >= 80) return '???'
  if (rate >= 60) return '???'
  return '??'
}

function getMasteryTagType(row) {
  const text = getMasteryText(row)
  if (text === '???') return 'success'
  if (text === '???') return 'warning'
  return 'danger'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.wrong-questions-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) 320px;
  gap: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gradient-card {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(145deg, rgba(255,255,255,0.98), rgba(247,250,255,0.96));
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.section-desc,
.recommend-desc,
.answer-meta,
.question-time,
.question-top-right,
.advice-item {
  color: #6b7280;
  line-height: 1.8;
}

.recommend-list,
.wrong-question-list,
.advice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recommend-item,
.wrong-question-card {
  border-radius: 18px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid #e8eef8;
  box-shadow: 0 10px 24px rgba(31, 41, 55, 0.06);
}

.recommend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recommend-title,
.redo-title,
.note-label {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}

.question-top,
.question-top-left,
.question-actions,
.redo-actions,
.note-actions,
.wrong-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.question-top {
  justify-content: space-between;
}

.question-content {
  margin-top: 14px;
  color: #111827;
  font-size: 16px;
  line-height: 1.85;
  font-weight: 500;
}

.option-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.option-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #374151;
}

.answer-meta {
  margin-top: 14px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.note-panel {
  margin-top: 18px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px dashed rgba(59, 130, 246, 0.18);
}

.note-actions {
  margin-top: 12px;
}

.question-actions,
.redo-panel {
  margin-top: 20px;
}

.redo-panel {
  padding-top: 20px;
  border-top: 1px dashed #dbe4f0;
}

.roomy-actions {
  gap: 16px;
  margin-top: 16px;
}

.redo-result {
  margin-top: 18px;
  border-radius: 12px;
  padding: 14px 16px;
}

.redo-result.is-correct {
  background: #f0fdf4;
  color: #166534;
}

.redo-result.is-wrong {
  background: #fff7ed;
  color: #9a3412;
}

.redo-result-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.redo-result-line + .redo-result-line,
.redo-result-analysis {
  margin-top: 6px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.summary-box {
  padding: 16px;
  border-radius: 16px;
  background: rgba(37, 99, 235, 0.05);
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.summary-label {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.summary-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 900;
  color: #0f172a;
}

.advice-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

@media (max-width: 1200px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}
</style>