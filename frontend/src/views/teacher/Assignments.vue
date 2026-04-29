<template>
  <div class="assignment-management">
    <div class="page-header">
      <h2>作业发布</h2>
      <p>发布和管理作业任务</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>作业列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            发布作业
          </el-button>
        </div>
      </template>
      
      <el-table :data="assignments" style="width: 100%" v-loading="loading">
        <el-table-column prop="title" label="作业名称" />
        <el-table-column prop="paperTitle" label="试卷" width="180">
          <template #default="scope">
            {{ scope.row.paperTitle || (scope.row.questionCount ? '题库组卷' : '-') }}
          </template>
        </el-table-column>
        <el-table-column label="题目数" width="90">
          <template #default="scope">
            {{ scope.row.questionCount || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="className" label="班级" width="140" />
        <el-table-column prop="answerCount" label="已提交人数" width="110" />
        <el-table-column label="层次" width="180">
          <template #default="scope">
            <span>{{ getLevelsText(scope.row.levels || scope.row.level) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="deadline" label="截止时间" width="180">
          <template #default="scope">
            {{ scope.row.deadline ? formatDate(scope.row.deadline) : '未设置' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag type="success">{{ scope.row.status === 'published' ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button type="primary" link @click="viewAssignment(scope.row)">查看</el-button>
            <el-button type="danger" link @click="deleteAssignment(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="dialogVisible" title="发布作业" width="760px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="作业名称" prop="title">
          <el-input v-model="form.title" placeholder="请输入作业名称" />
        </el-form-item>

        <el-alert
          title="可选择试卷，或直接从题库勾选题目组卷；两者至少选一种。"
          type="info"
          :closable="false"
          show-icon
          class="form-tip"
        />

        <el-form-item label="选择试卷" prop="paperId">
          <el-select v-model="form.paperId" clearable placeholder="可不选试卷">
            <el-option v-for="p in papers" :key="p.id" :label="p.title" :value="p.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="知识树筛选">
          <el-cascader
            v-model="selectedKnowledgePath"
            :options="knowledgeTree"
            :props="cascaderProps"
            clearable
            filterable
            placeholder="按知识树节点筛选题目"
            @change="handleKnowledgePathChange"
          />
        </el-form-item>

        <el-form-item label="选择题目" prop="questionIds">
          <div class="question-filter-panel">
            <el-select v-model="questionFilter.type" clearable placeholder="全部题型" style="width: 140px">
              <el-option label="选择题" value="choice" />
              <el-option label="填空题" value="fill" />
              <el-option label="简答题" value="shortAnswer" />
            </el-select>
            <el-select v-model="questionFilter.difficulty" clearable placeholder="全部难度" style="width: 140px">
              <el-option label="1级" :value="1" />
              <el-option label="2级" :value="2" />
              <el-option label="3级" :value="3" />
              <el-option label="4级" :value="4" />
              <el-option label="5级" :value="5" />
            </el-select>
          </div>
          <el-select
            v-model="form.questionIds"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="按知识树分类后的题库"
          >
            <el-option
              v-for="q in filteredQuestionBank"
              :key="q.id"
              :label="buildQuestionLabel(q)"
              :value="q.id"
            />
          </el-select>
          <div class="selected-question-summary">
            已选 {{ form.questionIds.length }} 题
          </div>
        </el-form-item>

        <el-form-item label="选择班级" prop="classId">
          <el-select v-model="form.classId" placeholder="请选择班级">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="作业层次" prop="levels">
          <el-checkbox-group v-model="form.levels">
            <el-checkbox label="weak">薄弱层</el-checkbox>
            <el-checkbox label="normal">普通层</el-checkbox>
            <el-checkbox label="strong">优秀层</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="截止时间" prop="deadline">
          <el-date-picker v-model="form.deadline" type="datetime" placeholder="选择截止时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="作业详情" width="700px">
      <div v-if="currentAssignment">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="作业名称">{{ currentAssignment.title }}</el-descriptions-item>
          <el-descriptions-item label="来源类型">
            {{ getAssignmentSourceText(currentAssignment) }}
          </el-descriptions-item>
          <el-descriptions-item label="试卷">
            {{ currentAssignment.paper && currentAssignment.paper.title ? currentAssignment.paper.title : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="题目数量">
            {{ getAssignmentQuestionCount(currentAssignment) }}
          </el-descriptions-item>
          <el-descriptions-item label="班级">{{ currentAssignment.classInfo && currentAssignment.classInfo.name ? currentAssignment.classInfo.name : '-' }}</el-descriptions-item>
          <el-descriptions-item label="作业层次">{{ getLevelsText(currentAssignment.levels || currentAssignment.level) }}</el-descriptions-item>
          <el-descriptions-item label="截止时间">{{ formatDate(currentAssignment.deadline) }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-subtitle">已提交记录</div>
        <el-table :data="currentAssignment.answers || []" style="width: 100%">
          <el-table-column prop="studentName" label="学生" />
          <el-table-column prop="submittedAt" label="提交时间" width="180">
            <template #default="scope">{{ formatDate(scope.row.submittedAt) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="totalScore" label="得分" width="100" />
          <el-table-column label="操作" width="140">
            <template #default="scope">
              <el-button type="primary" link @click="viewAnswerDetail(scope.row)">
                查看答题详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="selectedAnswerDetail" class="answer-detail-panel">
  <div class="detail-subtitle">答题明细</div>

  <el-alert
    :title="`学生 ${selectedAnswerDetail.studentName || '未命名学生'} 的答题详情`"
    type="info"
    :closable="false"
    show-icon
    class="answer-detail-alert"
  />

  <div class="answer-question-list">
    <div
      v-for="item in selectedAnswerDetail.questionResults || []"
      :key="item.questionId"
      class="answer-question-card"
    >
      <div class="answer-question-head">
        <div class="answer-question-type">
          <el-tag size="small" effect="plain">
            {{ getQuestionTypeText(item.questionType) }}
          </el-tag>
          <el-tag :type="item.correct ? 'success' : 'danger'" size="small">
            {{ item.correct ? '正确' : '错误' }}
          </el-tag>
        </div>
        <div class="answer-question-score">
          {{ item.score }}/{{ item.fullScore }} 分
        </div>
      </div>

      <div class="answer-question-content">
        {{ item.content }}
      </div>

      <div
        v-if="item.options && item.options.length"
        class="answer-option-list"
      >
        <div
          v-for="(option, index) in item.options"
          :key="index"
          class="answer-option-item"
        >
          {{ String.fromCharCode(65 + index) }}. {{ option }}
        </div>
      </div>

      <div class="answer-meta-list">
        <div><strong>正确答案：</strong>{{ item.standardAnswer || '-' }}</div>
        <div><strong>学生答案：</strong>{{ item.studentAnswer || '-' }}</div>
        <div><strong>知识点：</strong>{{ (item.knowledgePoints || []).join('、') || '-' }}</div>
      </div>

      <div v-if="item.comment" class="teacher-comment">
        <strong>教师评语：</strong>{{ item.comment }}
      </div>

      <div v-if="item.correction" class="teacher-comment">
        <strong>订正建议：</strong>{{ item.correction }}
      </div>
    </div>
  </div>
</div>
      </div>
      <template #footer>
        <el-button @click="closeDetailDialog">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '@/utils/api'
import dayjs from 'dayjs'
import { buildSharedKnowledgeTree, KNOWLEDGE_CATEGORY_LEAF_MAP } from '@/utils/knowledge-meta'

var loading = ref(false)
var dialogVisible = ref(false)
var detailVisible = ref(false)
var formRef = ref(null)
var assignments = ref([])
var papers = ref([])
var classes = ref([])
var questionBank = ref([])
var knowledgeTree = ref([])
var currentAssignment = ref(null)
var selectedAnswerDetail = ref(null)
var selectedKnowledgePath = ref([])
var questionFilter = reactive({ type: '', difficulty: '' })
var cascaderProps = { value: 'id', label: 'name', children: 'children', emitPath: true, checkStrictly: true }
var questionKpAliasMap = {
  'kp-001': 'alg-1', 'kp-002': 'alg-2', 'kp-003': 'alg-3', 'kp-004': 'alg-1', 'kp-005': 'alg-5',
  'kp-006': 'geo-1', 'kp-007': 'geo-2', 'kp-008': 'alg-5', 'kp-009': 'alg-6', 'kp-010': 'alg-4',
  'kp-011': 'alg-3', 'kp-012': 'stat-1'
}
var teacherKnowledgeTreeConfig = buildSharedKnowledgeTree()
var categoryLeafMap = KNOWLEDGE_CATEGORY_LEAF_MAP

var form = reactive({
  title: '',
  paperId: '',
  classId: '',
  questionIds: [],
  levels: ['strong'],
  deadline: ''
})

var filteredQuestionBank = computed(function() {
  var leafId = selectedKnowledgePath.value.length ? selectedKnowledgePath.value[selectedKnowledgePath.value.length - 1] : ''
  var actualLeafIds = leafId
    ? ((categoryLeafMap[leafId] || [leafId]).concat(questionKpAliasMap[leafId] ? [questionKpAliasMap[leafId]] : [])).filter(Boolean)
    : []
  return questionBank.value.filter(function(question) {
    var kpIds = Array.isArray(question.knowledgePoints) ? question.knowledgePoints : (question.knowledgePointId ? [question.knowledgePointId] : [])
    if (actualLeafIds.length && !actualLeafIds.some(function(id) { return kpIds.indexOf(id) !== -1 })) return false
    if (questionFilter.type && question.type !== questionFilter.type) return false
    if (questionFilter.difficulty && Number(question.difficultyLevel || question.difficulty || 0) !== Number(questionFilter.difficulty)) return false
    return true
  })
})

onMounted(function() {
  loadData()
})

function loadData() {
  loading.value = true

  Promise.all([
    api.get('/teacher/assignments'),
    api.get('/teacher/papers', { pageSize: 100 }),
    api.get('/teacher/classes'),
    api.get('/teacher/questions'),
    api.get('/common/knowledge-points')
  ])
    .then(function(results) {
      if (results[0].success) assignments.value = results[0].data
      if (results[1].success) papers.value = results[1].data.data
      if (results[2].success) classes.value = results[2].data
      if (results[3].success) questionBank.value = Array.isArray(results[3].data) ? results[3].data : []
      if (results[4].success) knowledgeTree.value = teacherKnowledgeTreeConfig
    })
    .catch(function() {
      ElMessage.error('基础数据加载失败')
    })
    .finally(function() {
      loading.value = false
    })

  api.get('/teacher/questions')
    .then(function(res) {
      if (res.success) {
        questionBank.value = Array.isArray(res.data) ? res.data : []
      }
    })
    .catch(function() {
      questionBank.value = []
      ElMessage.warning('题库题目加载失败，暂时只能按试卷发布作业')
    })
}

function showAddDialog() {
  form.title = ''
  form.paperId = ''
  form.classId = ''
  form.questionIds = []
  form.levels = ['strong']
  form.deadline = ''
  selectedKnowledgePath.value = []
  questionFilter.type = ''
  questionFilter.difficulty = ''
  dialogVisible.value = true
}

function handleKnowledgePathChange() {
  form.questionIds = form.questionIds.filter(function(id) {
    return filteredQuestionBank.value.some(function(question) { return question.id === id })
  })
}

function submitForm() {
  formRef.value.validate()
    .then(function() {
      if (!form.paperId && form.questionIds.length === 0) {
        ElMessage.warning('请选择试卷或至少选择一道题目')
        return
      }

      if (form.levels.length === 0) {
        ElMessage.warning('请至少选择一个作业层次')
        return
      }

      api.post('/teacher/assignments', {
        title: form.title,
        paperId: form.paperId || '',
        classId: form.classId,
        questionIds: form.questionIds,
        levels: form.levels,
        level: form.levels[0],
        deadline: form.deadline
      })
        .then(function(res) {
          if (res.success) {
            ElMessage.success('发布成功')
            dialogVisible.value = false
            loadData()
          }
        })
        .catch(function(error) {
          ElMessage.error(error && error.message ? error.message : '发布失败')
        })
    })
    .catch(function() {})
}

function viewAssignment(row) {
  api.get('/teacher/assignments/' + row.id)
    .then(function(res) {
      if (res.success) {
        currentAssignment.value = res.data
        selectedAnswerDetail.value =
          res.data.answers && res.data.answers.length ? res.data.answers[0] : null
        detailVisible.value = true
      }
    })
    .catch(function() {
      ElMessage.error('加载作业详情失败')
    })
}

function viewAnswerDetail(answerRow) {
  selectedAnswerDetail.value = answerRow
}

function closeDetailDialog() {
  detailVisible.value = false
  selectedAnswerDetail.value = null
}

function deleteAssignment(row) {
  ElMessageBox.confirm('删除作业后，其下答题记录也会一并删除，确定继续吗？', '提示', { type: 'warning' })
    .then(function() {
      api.delete('/teacher/assignments/' + row.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('删除成功')
            loadData()
          }
        })
        .catch(function() {
          ElMessage.error('删除失败')
        })
    })
    .catch(function() {})
}

function buildQuestionLabel(question) {
  var prefix = question.type === 'choice' ? '选择题' : (question.type === 'fill' ? '填空题' : '简答题')
  var kpName = question.knowledgeNodeName || question.knowledgePointName || (Array.isArray(question.knowledgePoints) && question.knowledgePoints.length ? question.knowledgePoints[0] : '未分类')
  return prefix + ' · ' + kpName + ' · ' + question.content
}

function getAssignmentSourceText(assignment) {
  if (assignment && assignment.paper && assignment.paper.source === 'question-bank') {
    return '题库组卷'
  }
  return '试卷发布'
}

function getAssignmentQuestionCount(assignment) {
  if (assignment && assignment.paper && Array.isArray(assignment.paper.questions)) {
    return assignment.paper.questions.length
  }
  return 0
}

function getLevelsText(levels) {
  var normalized = Array.isArray(levels) ? levels : (levels ? [levels] : [])
  if (normalized.length === 0) return '未设置'
  return normalized.map(function(level) {
    if (level === 'weak') return '薄弱层'
    if (level === 'normal') return '普通层'
    if (level === 'strong') return '优秀层'
    return level
  }).join('、')
}

function getQuestionTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '题目'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-subtitle {
  margin: 20px 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.form-tip {
  margin-bottom: 18px;
}

.selected-question-summary {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}

.question-filter-panel {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.answer-detail-panel {
  margin-top: 24px;
}

.answer-detail-alert {
  margin-bottom: 16px;
}

.answer-question-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.answer-question-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
}

.answer-question-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.answer-question-type {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.answer-question-score {
  font-weight: 700;
  color: #2563eb;
}

.answer-question-content {
  margin-top: 12px;
  color: #111827;
  font-size: 15px;
  line-height: 1.8;
}

.answer-option-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.answer-option-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  color: #374151;
}

.answer-meta-list {
  margin-top: 14px;
  display: grid;
  gap: 8px;
  color: #4b5563;
}

.teacher-comment {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f9fafb;
  color: #374151;
}
</style>
