<template>
  <div class="class-management">
    <div class="page-header">
      <h2>班级管理</h2>
      <p>建班、改班级信息，看每个班有多少学生。</p>
    </div>
    
    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>班级列表</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            添加班级
          </el-button>
        </div>
      </template>
      
      <el-table :data="classes" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="班级名称" />
        <el-table-column prop="grade" label="年级" width="120" />
        <el-table-column prop="studentCount" label="学生人数" width="120" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="290">
          <template #default="scope">
            <el-button type="primary" link @click="curriculum.open(scope.row)">已学范围</el-button>
            <el-button type="primary" link @click="viewStudents(scope.row)">查看学生</el-button>
            <el-button type="primary" link @click="editClass(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteClass(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <ClassCurriculum ref="curriculum" />
    <!-- 添加/编辑班级对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑班级' : '添加班级'"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="classForm"
        :rules="rules"
        label-width="104px"
      >
        <el-form-item label="班级名称" prop="name">
          <el-input v-model="classForm.name" placeholder="请输入班级名称" />
        </el-form-item>
        <el-form-item label="年级" prop="grade">
          <el-select v-model="classForm.grade" placeholder="请选择年级">
            <el-option label="七年级" value="七年级" />
            <el-option label="八年级" value="八年级" />
            <el-option label="九年级" value="九年级" />
          </el-select>
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'
import ClassCurriculum from '@/components/ClassCurriculum.vue'
const curriculum = ref(null)

var router = useRouter()
var loading = ref(false)
var dialogVisible = ref(false)
var isEdit = ref(false)
var formRef = ref(null)

var classes = ref([])
var classForm = reactive({
  id: '',
  name: '',
  grade: ''
})

var rules = {
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
  grade: [{ required: true, message: '请选择年级', trigger: 'change' }]
}

onMounted(function() {
  loadClasses()
})

function loadClasses() {
  loading.value = true
  api.get('/teacher/classes')
    .then(function(res) {
      if (res.success) {
        classes.value = res.data
      }
    })
    .catch(function(error) {
      ElMessage.error('加载班级列表失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function showAddDialog() {
  isEdit.value = false
  classForm.id = ''
  classForm.name = ''
  classForm.grade = ''
  dialogVisible.value = true
}

function editClass(row) {
  isEdit.value = true
  classForm.id = row.id
  classForm.name = row.name
  classForm.grade = row.grade
  dialogVisible.value = true
}

function deleteClass(row) {
  ElMessageBox.confirm('确定要删除该班级吗？删除后无法恢复。', '提示', {
    type: 'warning'
  }).then(function() {
    api.delete('/teacher/classes/' + row.id)
      .then(function(res) {
        if (res.success) {
          ElMessage.success('删除成功')
          loadClasses()
        }
      })
      .catch(function(error) {
        ElMessage.error('删除失败')
      })
  }).catch(function() {})
}

function submitForm() {
  formRef.value.validate()
    .then(function() {
      var url = '/teacher/classes'
      var method = 'post'
      
      if (isEdit.value) {
        url = '/teacher/classes/' + classForm.id
        method = 'put'
      }
      
      var request = method === 'put' ? api.put(url, classForm) : api.post(url, classForm)
      
      request.then(function(res) {
        if (res.success) {
          ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
          dialogVisible.value = false
          loadClasses()
        }
      }).catch(function(error) {
        ElMessage.error('操作失败')
      })
    })
    .catch(function() {})
}

function viewStudents(row) {
  router.push('/teacher/students?classId=' + row.id)
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
