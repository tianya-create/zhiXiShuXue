<template>
  <div class="admin-classes">
    <div class="page-header">
      <h2>班级列表管理</h2>
      <p>查看管理员端导入后的班级信息与学生规模</p>
    </div>

    <el-card class="gradient-card">
      <template #header>
        <div class="card-header">
          <span>班级列表</span>
          <el-button type="primary" @click="loadClasses">刷新</el-button>
        </div>
      </template>

      <el-table :data="classes" style="width: 100%" v-loading="loading">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="name" label="班级名称" min-width="180" />
        <el-table-column prop="grade" label="年级" width="120" />
        <el-table-column label="学生人数" width="120">
          <template #default="scope">
            {{ getStudentCount(scope.row) }}
          </template>
        </el-table-column>
        <el-table-column prop="teacherId" label="关联教师ID" min-width="180">
          <template #default="scope">
            {{ scope.row.teacherId || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && classes.length === 0" description="暂无班级数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import dayjs from 'dayjs'

var loading = ref(false)
var classes = ref([])

onMounted(function() {
  loadClasses()
})

function loadClasses() {
  loading.value = true
  api.get('/admin/export/classes')
    .then(function(res) {
      if (res.success) {
        classes.value = Array.isArray(res.data) ? res.data : []
      }
    })
    .catch(function(error) {
      ElMessage.error('加载班级列表失败')
    })
    .finally(function() {
      loading.value = false
    })
}

function getStudentCount(row) {
  return row && Array.isArray(row.students) ? row.students.length : 0
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
