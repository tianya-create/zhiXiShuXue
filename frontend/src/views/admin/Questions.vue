<template>
  <div class="question-bank">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h2>题库管理</h2>
          <p>管理系统中的所有题目，支持增删改查</p>
        </div>
      </div>
    </header>

    <!-- 题库卡片 -->
    <el-card class="panel-card">
      <template #header>
        <div class="card-header">
          <div class="filters">
            <el-select v-model="filterType" placeholder="题型" clearable style="width: 130px;">
              <el-option label="全部题型" value="" />
              <el-option label="选择题" value="choice" />
              <el-option label="填空题" value="fill" />
              <el-option label="简答题" value="shortAnswer" />
            </el-select>
            <el-select v-model="filterDifficulty" placeholder="难度" clearable style="width: 130px; margin-left: 12px;">
              <el-option label="全部难度" value="" />
              <el-option label="简单" value="easy" />
              <el-option label="中等" value="medium" />
              <el-option label="困难" value="hard" />
            </el-select>
            <el-button style="margin-left: 12px;" @click="loadQuestions">筛选</el-button>
          </div>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            添加题目
          </el-button>
        </div>
      </template>

      <el-table :data="questions" style="width: 100%" v-loading="loading" stripe>
        <el-table-column prop="type" label="题型" width="110">
          <template #default="scope">
            <el-tag type="info">{{ getTypeText(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="题目内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="difficulty" label="难度" width="90">
          <template #default="scope">
            <el-tag :type="getDifficultyType(scope.row.difficulty)" size="small">
              {{ getDifficultyText(scope.row.difficulty) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="分值" width="80" align="center" />
        <el-table-column prop="knowledgePoint" label="知识点" width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="160" align="center">
          <template #default="scope">
            <el-button type="primary" link @click="editQuestion(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteQuestion(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadQuestions"
          @current-change="loadQuestions"
        />
      </div>
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑题目' : '添加题目'"
      width="600px"
      class="advanced-dialog"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="题型" prop="type">
          <el-select v-model="form.type" style="width: 100%;">
            <el-option label="选择题" value="choice" />
            <el-option label="填空题" value="fill" />
            <el-option label="简答题" value="shortAnswer" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="3" placeholder="请输入题目内容" />
        </el-form-item>
        <el-form-item v-if="form.type === 'choice'" label="选项" prop="optionsText">
          <el-input
            v-model="form.optionsText"
            type="textarea"
            :rows="4"
            placeholder="每行一个选项，例如：&#10;选项A&#10;选项B&#10;选项C&#10;选项D"
          />
        </el-form-item>
        <el-form-item label="答案" prop="answer">
          <el-input v-model="form.answer" placeholder="请输入答案" />
        </el-form-item>
        <el-form-item label="分值">
          <el-input-number v-model="form.score" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio label="easy">简单</el-radio>
            <el-radio label="medium">中等</el-radio>
            <el-radio label="hard">困难</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

var loading = ref(false)
var currentPage = ref(1)
var pageSize = ref(20)
var total = ref(0)
var filterType = ref('')
var filterDifficulty = ref('')
var dialogVisible = ref(false)
var isEdit = ref(false)
var formRef = ref(null)
var questions = ref([])

var form = reactive({
  id: '',
  type: 'choice',
  content: '',
  optionsText: '',
  answer: '',
  score: 5,
  difficulty: 'medium',
  knowledgePoint: ''
})

var rules = {
  type: [{ required: true, message: '请选择题型', trigger: 'change' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }]
}

onMounted(function() {
  loadQuestions()
})

function loadQuestions() {
  loading.value = true
  api.get('/admin/questions', {
    page: currentPage.value,
    pageSize: pageSize.value,
    type: filterType.value,
    difficulty: filterDifficulty.value
  })
    .then(function(res) {
      if (res.success) {
        questions.value = res.data.data || []
        total.value = res.data.total || 0
      }
    })
    .catch(function(error) {
      console.error('加载失败:', error)
    })
    .finally(function() {
      loading.value = false
    })
}

function showAddDialog() {
  isEdit.value = false
  form.id = ''
  form.type = 'choice'
  form.content = ''
  form.optionsText = ''
  form.answer = ''
  form.score = 5
  form.difficulty = 'medium'
  form.knowledgePoint = ''
  dialogVisible.value = true
}

function editQuestion(row) {
  isEdit.value = true
  form.id = row.id
  form.type = row.type
  form.content = row.content
  form.optionsText = Array.isArray(row.options) ? row.options.join('\n') : ''
  form.answer = row.answer
  form.score = row.score
  form.difficulty = row.difficulty
  form.knowledgePoint = row.knowledgePoint || ''
  dialogVisible.value = true
}

function deleteQuestion(row) {
  ElMessageBox.confirm('确定删除该题目？此操作不可撤销。', '删除确认', { type: 'warning' })
    .then(function() {
      api.delete('/admin/questions/' + row.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('删除成功')
            loadQuestions()
          }
        })
        .catch(function() {
          ElMessage.error('删除失败')
        })
    })
    .catch(function() {})
}

function submitForm() {
  formRef.value.validate()
    .then(function() {
      var payload = {
        type: form.type,
        content: form.content,
        answer: form.answer,
        score: form.score,
        difficulty: form.difficulty,
        options: form.type === 'choice'
          ? form.optionsText.split('\n').map(function(item) { return item.trim() }).filter(Boolean)
          : [],
        knowledgePoint: form.knowledgePoint
      }

      if (payload.type === 'choice' && payload.options.length < 2) {
        ElMessage.warning('选择题至少需要填写两个选项')
        return
      }

      var request
      if (isEdit.value) {
        request = api.put('/admin/questions/' + form.id, payload)
      } else {
        request = api.post('/admin/questions', payload)
      }

      request
        .then(function(res) {
          if (res.success) {
            ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
            dialogVisible.value = false
            loadQuestions()
          }
        })
        .catch(function() {
          ElMessage.error('操作失败')
        })
    })
    .catch(function() {})
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '简答题'
  return '未知'
}

function getDifficultyType(difficulty) {
  if (difficulty === 'easy') return 'success'
  if (difficulty === 'medium') return 'warning'
  if (difficulty === 'hard') return 'danger'
  return 'info'
}

function getDifficultyText(difficulty) {
  if (difficulty === 'easy') return '简单'
  if (difficulty === 'medium') return '中等'
  if (difficulty === 'hard') return '困难'
  return '未知'
}
</script>

<style scoped>
.question-bank {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 页面头部 */
.page-header {
  background: var(--surface-overlay);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  padding: 32px 36px;
  border: 1px solid hsla(0, 0%, 100%, 0.9);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
  animation: slideUp var(--duration-slow) var(--ease-spring);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--brand-gradient);
}

.page-header::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 300px;
  height: 100%;
  background: radial-gradient(ellipse at top right, hsla(var(--brand-hue), 84%, 68%, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  position: relative;
  z-index: 1;
}

.header-text h2 {
  font-family: 'Noto Serif SC', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.02em;
}

.header-text p {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

/* 面板卡片 */
.panel-card {
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--border-subtle) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all var(--duration-normal) var(--ease-spring) !important;
  background: var(--surface-raised);
  animation: slideUp var(--duration-slow) var(--ease-spring);
  animation-delay: 0.1s;
  animation-fill-mode: backwards;
}

.panel-card:hover {
  box-shadow: var(--shadow-lg) !important;
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.filters {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 分页包装器 */
.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

/* 高级弹窗样式覆盖 */
:deep(.el-dialog) {
  border-radius: 24px !important;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  padding: 24px 28px;
  background: white;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  margin: 0;
}

:deep(.el-dialog__body) {
  padding: 28px;
}

:deep(.el-dialog__footer) {
  padding: 20px 28px;
  background: var(--bg-hover);
  border-top: 1px solid rgba(226, 232, 240, 0.6);
}

:deep(.el-dialog::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #6366F1, #8B5CF6);
}
</style>
