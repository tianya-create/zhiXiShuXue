<template>
  <div class="student-management">
    <div class="page-header">
      <h2>学生管理</h2>
      <p>查看和管理每个班的学生名单。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-select v-model="selectedClassId" placeholder="选择班级" @change="loadStudents" style="width: 200px">
              <el-option
                v-for="cls in classes"
                :key="cls.id"
                :label="cls.name"
                :value="cls.id"
              />
            </el-select>
          </div>
          <el-button type="primary" @click="showAddDialog" :disabled="!selectedClassId">
            <el-icon><Plus /></el-icon>
            添加学生
          </el-button>
        </div>
      </template>
      
      <el-table :data="students" style="width: 100%" v-loading="loading">
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="gender" label="性别" width="80">
          <template #default="scope">
            {{ scope.row.gender === 'male' ? '男' : '女' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="入学时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button type="primary" link @click="viewAnalytics(scope.row)">学情分析</el-button>
            <el-button type="primary" link @click="editStudent(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteStudent(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 添加/编辑学生对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑学生' : '添加学生'"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="studentForm"
        :rules="rules"
        label-width="104px"
      >
        <el-form-item label="学号" prop="studentNo">
          <el-input v-model="studentForm.studentNo" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="studentForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="studentForm.gender">
            <el-radio label="male">男</el-radio>
            <el-radio label="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="studentForm.email" placeholder="请输入邮箱（选填）" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="studentForm.phone" placeholder="请输入电话（选填）" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="初始密码"><el-input v-model="studentForm.initialPassword" show-password placeholder="至少 8 位，交给本人后请修改" /></el-form-item>
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
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var router = useRouter()
var route = useRoute()
var loading = ref(false)
var dialogVisible = ref(false)
var isEdit = ref(false)
var formRef = ref(null)

var classes = ref([])
var selectedClassId = ref(route.query.classId || '')
var students = ref([])

var studentForm = reactive({
  id: '',
  studentNo: '',
  name: '',
  gender: 'male',
  email: '',
  phone: '',
  classId: ''
})

var rules = {
  studentNo: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }]
}

onMounted(function() {
  loadClasses()
})

function loadClasses() {
  api.get('/teacher/classes')
    .then(function(res) {
      if (res.success) {
        classes.value = res.data
        if (!selectedClassId.value && res.data.length > 0) {
          selectedClassId.value = res.data[0].id
          loadStudents()
        } else if (selectedClassId.value) {
          loadStudents()
        }
      }
    })
    .catch(function(error) {
      console.error('加载班级失败:', error)
    })
}

function loadStudents() {
  if (!selectedClassId.value) return
  
  loading.value = true
  api.get('/teacher/classes/' + selectedClassId.value + '/students')
    .then(function(res) {
      if (res.success) {
        students.value = res.data
      }
    })
    .catch(function(error) {
      ElMessage.error('加载学生列表失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function showAddDialog() {
  isEdit.value = false
  studentForm.id = ''
  studentForm.studentNo = ''
  studentForm.initialPassword = ''
  studentForm.name = ''
  studentForm.gender = 'male'
  studentForm.email = ''
  studentForm.phone = ''
  studentForm.classId = selectedClassId.value
  dialogVisible.value = true
}

function editStudent(row) {
  isEdit.value = true
  studentForm.id = row.id
  studentForm.studentNo = row.studentNo
  studentForm.name = row.name
  studentForm.gender = row.gender
  studentForm.email = row.email || ''
  studentForm.phone = row.phone || ''
  studentForm.classId = row.classId
  dialogVisible.value = true
}

function deleteStudent(row) {
  ElMessageBox.confirm('确定要删除该学生吗？', '提示', { type: 'warning' })
    .then(function() {
      api.delete('/teacher/students/' + row.id)
        .then(function(res) {
          if (res.success) {
            ElMessage.success('删除成功')
            loadStudents()
          }
        })
        .catch(function(error) {
          ElMessage.error('删除失败')
        })
    })
    .catch(function() {})
}

function submitForm() {
  formRef.value.validate()
    .then(function() {
      studentForm.classId = selectedClassId.value
      
      var request
      if (isEdit.value) {
        request = api.put('/teacher/students/' + studentForm.id, studentForm)
      } else {
        request = api.post('/teacher/students', studentForm)
      }
      
      request
        .then(function(res) {
          if (res.success) {
            ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
            dialogVisible.value = false
            loadStudents()
          }
        })
        .catch(function(error) {
          ElMessage.error('操作失败')
        })
    })
    .catch(function() {})
}

function viewAnalytics(row) {
  router.push('/teacher/analytics/student/' + row.id)
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
</style>
