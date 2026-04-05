<template>
  <div class="admin-users">
    <div class="page-header">
      <h2>用户管理</h2>
      <p>管理员可通过 Excel 导入班级，学生信息继续通过手动方式维护</p>
    </div>
    
    <el-card class="gradient-card import-card">
      <template #header>
        <div class="card-header">
          <div>
            <span>班级导入</span>
            <p class="import-tip">请上传 Excel 文件，表头支持：班级名称、年级。学生请在教师端或后续手动录入。</p>
          </div>
          <div class="import-actions">
            <input
              ref="fileInputRef"
              type="file"
              accept=".xlsx,.xls"
              class="file-input"
              @change="handleFileChange"
            />
            <el-button @click="downloadTemplate">下载模板说明</el-button>
            <el-button type="primary" @click="triggerSelectFile">
              <el-icon><Upload /></el-icon>
              选择Excel文件
            </el-button>
          </div>
        </div>
      </template>

      <div class="import-panel">
        <div class="import-file-info">
          <span>当前文件：</span>
          <strong>{{ selectedFile ? selectedFile.name : '未选择文件' }}</strong>
        </div>
        <div class="import-buttons">
          <el-button @click="clearSelectedFile" :disabled="!selectedFile">清空</el-button>
          <el-button type="success" :loading="importing" :disabled="!selectedFile" @click="submitImport">
            开始导入
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="importResult"
        :title="importResult.message"
        type="success"
        show-icon
        :closable="false"
        style="margin-top: 16px"
      >
        <template #default>
          本次新增班级 {{ importResult.classCount }} 个。学生信息请在学生管理中手动添加。
        </template>
      </el-alert>
    </el-card>
    
    <el-card class="gradient-card" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
          <el-select v-model="filterRole" placeholder="筛选角色" @change="loadUsers" style="width: 150px;">
            <el-option label="全部" value="" />
            <el-option label="教师" value="teacher" />
            <el-option label="学生" value="student" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </div>
      </template>
      
      <el-table :data="users" style="width: 100%" v-loading="loading">
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="scope">
            <el-tag :type="getRoleType(scope.row.role)">{{ getRoleText(scope.row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button type="primary" link @click="editUser(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteUser(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadUsers"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>
    
    <el-dialog v-model="dialogVisible" title="编辑用户" width="500px">
      <el-form ref="formRef" :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role">
            <el-option label="教师" value="teacher" />
            <el-option label="学生" value="student" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var loading = ref(false)
var importing = ref(false)
var filterRole = ref('')
var users = ref([])
var dialogVisible = ref(false)
var formRef = ref(null)
var fileInputRef = ref(null)
var selectedFile = ref(null)
var importResult = ref(null)

var pagination = reactive({ page: 1, pageSize: 20, total: 0 })
var form = reactive({ id: '', username: '', name: '', role: '', email: '', phone: '' })

onMounted(function() {
  loadUsers()
})

function loadUsers() {
  loading.value = true
  api.get('/admin/users', {
    role: filterRole.value,
    page: pagination.page,
    pageSize: pagination.pageSize
  })
  .then(function(res) {
    if (res.success) {
      users.value = res.data.data
      pagination.total = res.data.total
    }
  })
  .catch(function(error) {
    console.error('加载失败:', error)
  })
  .finally(function() {
    loading.value = false
  })
}

function triggerSelectFile() {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

function handleFileChange(event) {
  var files = event.target.files
  importResult.value = null
  if (!files || !files.length) {
    selectedFile.value = null
    return
  }

  selectedFile.value = files[0]
}

function clearSelectedFile() {
  selectedFile.value = null
  importResult.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function submitImport() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }

  importing.value = true
  importResult.value = null

  api.upload('/admin/import/classes', selectedFile.value)
    .then(function(res) {
      if (res.success) {
        var result = {
          message: res.message || '导入成功',
          classCount: res.data.classCount
        }
        ElMessage.success(res.message || '导入成功')
        clearSelectedFile()
        importResult.value = result
      }
    })
    .catch(function(error) {
      var message = error && error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : '导入失败'
      ElMessage.error(message)
    })
    .finally(function() {
      importing.value = false
    })
}

function downloadTemplate() {
  ElMessageBox.alert(
    'Excel 首行请使用这些列名：班级名称、年级。每行对应一个班级。学生信息请在学生管理页面手动添加。',
    '导入模板说明',
    { confirmButtonText: '我知道了' }
  )
}

function editUser(row) {
  form.id = row.id
  form.username = row.username
  form.name = row.name
  form.role = row.role
  form.email = row.email || ''
  form.phone = row.phone || ''
  dialogVisible.value = true
}

function deleteUser(row) {
  ElMessageBox.confirm('确定删除该用户？', '提示', { type: 'warning' })
    .then(function() {
      api.delete('/admin/users/' + row.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('删除成功')
            loadUsers()
          }
        })
        .catch(function(error) {
          ElMessage.error('删除失败')
        })
    })
    .catch(function() {})
}

function submitForm() {
  api.put('/admin/users/' + form.id, form)
    .then(function(res) {
      if (res.success) {
        ElMessage.success('更新成功')
        dialogVisible.value = false
        loadUsers()
      }
    })
    .catch(function(error) {
      ElMessage.error('更新失败')
    })
}

function getRoleType(role) {
  if (role === 'teacher') return 'primary'
  if (role === 'student') return 'success'
  if (role === 'admin') return 'warning'
  return 'info'
}

function getRoleText(role) {
  if (role === 'teacher') return '教师'
  if (role === 'student') return '学生'
  if (role === 'admin') return '管理员'
  return '未知'
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
  gap: 16px;
}

.import-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--border-color);
}

.import-tip {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.import-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.file-input {
  display: none;
}

.import-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.import-file-info {
  font-size: 14px;
  color: var(--text-primary);
}

.import-buttons {
  display: flex;
  gap: 12px;
}
</style>
