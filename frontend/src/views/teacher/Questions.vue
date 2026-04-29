<template>
  <div class="question-management">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-text">
        <h2>题目管理</h2>
        <p>支持按知识点、难度、题型三维筛选题库</p>
      </div>
      <div class="header-stats">
        共 {{ total }} 道题目
      </div>
    </header>

    <!-- 筛选卡片 -->
    <el-card class="panel-card filter-card">
      <div class="filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索题干" clearable style="width: 240px" @input="handleSearch" />
        <el-select v-model="filters.knowledgePoint" clearable placeholder="知识点" style="width: 180px" @change="handleSearch">
          <el-option v-for="item in knowledgeOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-select v-model="filters.difficulty" clearable placeholder="难度" style="width: 140px" @change="handleSearch">
          <el-option label="简单" value="easy" />
          <el-option label="中等" value="medium" />
          <el-option label="困难" value="hard" />
        </el-select>
        <el-select v-model="filters.type" clearable placeholder="题型" style="width: 140px" @change="handleSearch">
          <el-option label="选择题" value="choice" />
          <el-option label="填空题" value="fill" />
          <el-option label="解答题" value="shortAnswer" />
        </el-select>
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加题目
        </el-button>
      </div>
    </el-card>

    <!-- 题目列表 -->
    <el-card class="panel-card">
      <el-table :data="questions" style="width: 100%" v-loading="loading">
        <el-table-column prop="knowledgeNodeName" label="知识点" width="150" />
        <el-table-column prop="type" label="题型" width="100">
          <template #default="scope">
            <el-tag>{{ getTypeText(scope.row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="题目内容" show-overflow-tooltip />
        <el-table-column prop="difficultyLevel" label="难度" width="90">
          <template #default="scope">
            <el-tag :type="getDifficultyType(scope.row.difficultyLevel)">
              {{ scope.row.difficultyLevel || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="answerCount" label="作答人数" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="editQuestion(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteQuestion(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="total > 0">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 添加/编辑题目弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑题目' : '添加题目'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="题型" prop="type">
          <el-select v-model="form.type" placeholder="请选择题型">
            <el-option label="选择题" value="choice" />
            <el-option label="填空题" value="fill" />
            <el-option label="解答题" value="shortAnswer" />
          </el-select>
        </el-form-item>

        <el-form-item label="知识点" prop="knowledgePointId">
          <el-select v-model="form.knowledgePointId" placeholder="请选择知识点" style="width: 100%">
            <el-option v-for="item in knowledgeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="题目内容" prop="content">
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

        <el-form-item label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio label="easy">简单</el-radio>
            <el-radio label="medium">中等</el-radio>
            <el-radio label="hard">困难</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="分值">
          <el-input-number v-model="form.score" :min="1" :max="100" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

const loading = ref(false)
const submitting = ref(false)
const questions = ref([])
const knowledgeOptions = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const total = ref(0)

const filters = reactive({
  keyword: '',
  knowledgePoint: '',
  difficulty: '',
  type: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 50
})

const form = reactive({
  id: '',
  type: 'choice',
  knowledgePointId: '',
  content: '',
  optionsText: '',
  answer: '',
  score: 5,
  difficulty: 'medium'
})

const rules = {
  type: [{ required: true, message: '请选择题型', trigger: 'change' }],
  knowledgePointId: [{ required: true, message: '请选择知识点', trigger: 'change' }],
  content: [{ required: true, message: '请输入题目内容', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }]
}

let searchTimer = null

onMounted(() => {
  loadKnowledgeOptions()
  loadQuestions()
})

function loadKnowledgeOptions() {
  api.get('/admin/knowledge-points').then((res) => {
    if (res.success) {
      const flat = []
      function walk(items) {
        ;(items || []).forEach((item) => {
          flat.push({ id: item.id, name: item.name })
          walk(item.children)
        })
      }
      walk(res.data || [])
      knowledgeOptions.value = flat
    }
  })
}

function loadQuestions() {
  loading.value = true
  api.get('/admin/questions', {
    type: filters.type || undefined,
    difficulty: filters.difficulty || undefined,
    knowledgePoint: filters.knowledgePoint || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize
  }).then((res) => {
    if (res.success) {
      let data = res.data.data || []
      if (filters.keyword) {
        data = data.filter((item) => String(item.content || '').includes(filters.keyword))
      }
      questions.value = data
      total.value = res.data.total || data.length
    }
  }).finally(() => {
    loading.value = false
  })
}

function handleSearch() {
  pagination.page = 1
  loadQuestions()
}

function handleSizeChange() {
  pagination.page = 1
  loadQuestions()
}

function handlePageChange() {
  loadQuestions()
}

function showAddDialog() {
  isEdit.value = false
  form.id = ''
  form.type = 'choice'
  form.knowledgePointId = ''
  form.content = ''
  form.optionsText = ''
  form.answer = ''
  form.score = 5
  form.difficulty = 'medium'
  dialogVisible.value = true
}

function editQuestion(row) {
  isEdit.value = true
  form.id = row.id
  form.type = row.type
  form.knowledgePointId = row.knowledgePointId
  form.content = row.content
  form.optionsText = Array.isArray(row.options) ? row.options.join('\n') : ''
  form.answer = row.answer
  form.score = row.score || 5
  form.difficulty = row.difficulty || 'medium'
  dialogVisible.value = true
}

function deleteQuestion(row) {
  ElMessageBox.confirm('确定删除该题目？删除后无法恢复。', '提示', {
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消'
  }).then(() => {
    api.delete('/admin/questions/' + row.id).then((res) => {
      if (res.success) {
        ElMessage.success('删除成功')
        loadQuestions()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    }).catch(() => {
      ElMessage.error('删除失败')
    })
  }).catch(() => {})
}

function submitForm() {
  if (!formRef.value) return

  formRef.value.validate().then(() => {
    submitting.value = true

    const payload = {
      type: form.type,
      knowledgePointId: form.knowledgePointId,
      content: form.content,
      answer: form.answer,
      score: form.score,
      difficulty: form.difficulty,
      options: form.type === 'choice'
        ? form.optionsText.split('\n').map((item) => item.trim()).filter(Boolean)
        : []
    }

    if (form.type === 'choice' && payload.options.length < 2) {
      ElMessage.warning('选择题至少需要填写两个选项')
      submitting.value = false
      return
    }

    let request
    if (isEdit.value) {
      request = api.put('/admin/questions/' + form.id, payload)
    } else {
      request = api.post('/admin/questions', payload)
    }

    request.then((res) => {
      if (res.success) {
        ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
        dialogVisible.value = false
        loadQuestions()
      } else {
        ElMessage.error(res.message || '操作失败')
      }
    }).catch(() => {
      ElMessage.error('操作失败')
    }).finally(() => {
      submitting.value = false
    })
  }).catch(() => {})
}

function getTypeText(type) {
  if (type === 'choice') return '选择题'
  if (type === 'fill') return '填空题'
  if (type === 'shortAnswer') return '解答题'
  return '未知'
}

function getDifficultyType(level) {
  if (level >= 4) return 'danger'
  if (level >= 2) return 'warning'
  return 'success'
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}
</script>

<style scoped>
.question-management {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 页面头部 */
.page-header {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  padding: 28px 32px;
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--brand-gradient);
}

.header-text h2 {
  font-family: 'Noto Serif SC', serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-text p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.header-stats {
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 8px 16px;
  border-radius: var(--radius-full);
}

/* 筛选卡片 */
.filter-card {
  border-radius: var(--radius-lg);
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-row .el-button {
  margin-left: auto;
}

/* 面板卡片 */
.panel-card {
  border-radius: var(--radius-lg);
}

/* 分页 */
.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
