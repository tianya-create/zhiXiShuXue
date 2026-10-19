<template>
  <div class="student-profile">
    <div class="page-header">
      <h2>个人信息</h2>
      <p>改名字、性别，或者加入班级。</p>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>基本信息</template>
          <el-form ref="formRef" :model="form" label-width="104px">
            <el-form-item label="学号">
              <el-input v-model="form.studentNo" disabled />
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender">
                <el-radio label="male">男</el-radio>
                <el-radio label="female">女</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="班级">
              <el-input v-model="className" disabled />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="updateProfile">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>绑定班级</template>
          <el-form label-width="104px">
            <el-form-item label="当前班级">
              <el-input v-model="className" disabled />
            </el-form-item>
            <el-form-item label="选择班级">
              <el-select v-model="selectedClassId" placeholder="选择班级">
                <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="bindClass">绑定班级</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

var formRef = ref(null)
var classes = ref([])
var selectedClassId = ref('')
var className = ref('未绑定')

var form = reactive({
  studentNo: '',
  name: '',
  gender: 'male'
})

onMounted(function() {
  loadProfile()
  loadClasses()
})

function loadProfile() {
  api.get('/student/profile').then(function(res) {
    if (res.success) {
      form.studentNo = res.data.studentNo || ''
      form.name = res.data.name || ''
      form.gender = res.data.gender || 'male'
      if (res.data.class) {
        className.value = res.data.class.name
      }
    }
  }).catch(function(error) {
    console.error('加载失败:', error)
  })
}

function loadClasses() {
  api.get('/common/classes').then(function(res) {
    if (res.success) {
      classes.value = res.data
    }
  }).catch(function(error) {
    console.error('加载班级失败:', error)
  })
}

function updateProfile() {
  api.put('/student/profile', form).then(function(res) {
    if (res.success) {
      // 更新 localStorage 中的用户信息
      var userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          var user = JSON.parse(userStr)
          user.name = form.name
          localStorage.setItem('user', JSON.stringify(user))
        } catch (e) {}
      }
      ElMessage.success('信息更新成功')
    }
  }).catch(function(error) {
    ElMessage.error('更新失败')
  })
}

function bindClass() {
  if (!selectedClassId.value) {
    ElMessage.warning('请选择班级')
    return
  }
  
  api.post('/student/bind-class', { classId: selectedClassId.value }).then(function(res) {
    if (res.success) {
      ElMessage.success('班级绑定成功')
      loadProfile()
    }
  }).catch(function(error) {
    ElMessage.error('绑定失败')
  })
}
</script>
