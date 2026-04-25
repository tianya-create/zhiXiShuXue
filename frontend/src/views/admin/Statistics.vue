<template>
  <div class="admin-statistics">
    <div class="page-header">
      <h2>数据统计</h2>
      <p>系统数据统计和导出</p>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>数据概览</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户总数">{{ stats.userCount }}</el-descriptions-item>
            <el-descriptions-item label="教师数量">{{ stats.teacherCount }}</el-descriptions-item>
            <el-descriptions-item label="学生数量">{{ stats.studentCount }}</el-descriptions-item>
            <el-descriptions-item label="班级数量">{{ stats.classCount }}</el-descriptions-item>
            <el-descriptions-item label="试卷数量">{{ stats.paperCount }}</el-descriptions-item>
            <el-descriptions-item label="题目数量">{{ stats.questionCount }}</el-descriptions-item>
            <el-descriptions-item label="答题记录">{{ stats.answerCount }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="gradient-card">
          <template #header>数据导出</template>
          <div class="export-buttons">
            <el-button type="primary" @click="exportData('users')">导出用户数据</el-button>
            <el-button type="success" @click="exportData('students')">导出学生数据</el-button>
            <el-button type="warning" @click="exportData('teachers')">导出教师数据</el-button>
            <el-button type="info" @click="exportData('classes')">导出班级数据</el-button>
            <el-button @click="exportData('papers')">导出试卷数据</el-button>
            <el-button @click="exportData('answers')">导出答题数据</el-button>
          </div>
        </el-card>
        
        <el-card class="gradient-card" style="margin-top: 20px;">
          <template #header>数据备份</template>
          <div class="backup-actions">
            <el-button type="primary" @click="backupData">备份数据</el-button>
            <el-upload
              :show-file-list="false"
              accept=".json"
              :before-upload="restoreData"
            >
              <el-button type="warning">恢复数据</el-button>
            </el-upload>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import * as XLSX from 'xlsx'

var stats = reactive({
  userCount: 0,
  teacherCount: 0,
  studentCount: 0,
  classCount: 0,
  paperCount: 0,
  questionCount: 0,
  answerCount: 0
})

onMounted(function() {
  loadStats()
})

function loadStats() {
  api.get('/admin/statistics/overview')
    .then(function(res) {
      if (res.success) {
        stats.userCount = res.data.userCount || 0
        stats.teacherCount = res.data.teacherCount || 0
        stats.studentCount = res.data.studentCount || 0
        stats.classCount = res.data.classCount || 0
        stats.paperCount = res.data.paperCount || 0
        stats.questionCount = res.data.questionCount || 0
        stats.answerCount = res.data.answerCount || 0
      }
    })
    .catch(function(error) {
      console.error('加载统计失败:', error)
    })
}

function exportData(type) {
  api.get('/admin/export/' + type)
    .then(function(res) {
      if (res.success) {
        var data = res.data
        var worksheet
        var headers
        var rows
        
        // 根据不同类型处理数据
        switch (type) {
          case 'users':
            headers = ['ID', '用户名', '角色', '姓名', '邮箱', '电话', '创建时间']
            rows = data.map(user => [
              user.id,
              user.username,
              user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '教师' : '学生',
              user.name || '',
              user.email || '',
              user.phone || '',
              user.createdAt || ''
            ])
            break
          case 'students':
            headers = ['ID', '姓名', '学号', '性别', '班级', '创建时间']
            rows = data.map(student => [
              student.id,
              student.name,
              student.studentNo,
              student.gender === 'male' ? '男' : '女',
              student.classId || '',
              student.createdAt || ''
            ])
            break
          case 'teachers':
            headers = ['ID', '姓名', '工号', '邮箱', '电话', '创建时间']
            rows = data.map(teacher => [
              teacher.id,
              teacher.name,
              teacher.teacherNo || '',
              teacher.email || '',
              teacher.phone || '',
              teacher.createdAt || ''
            ])
            break
          case 'classes':
            headers = ['ID', '班级名称', '年级', '教师ID', '学生数量', '创建时间']
            rows = data.map(cls => [
              cls.id,
              cls.name,
              cls.grade,
              cls.teacherId,
              cls.students ? cls.students.length : 0,
              cls.createdAt || ''
            ])
            break
          case 'papers':
            headers = ['ID', '试卷名称', '教师ID', '班级ID', '题目数量', '创建时间']
            rows = data.map(paper => [
              paper.id,
              paper.title,
              paper.teacherId,
              paper.classId || '',
              paper.questions ? paper.questions.length : 0,
              paper.createdAt || ''
            ])
            break
          case 'answers':
            headers = ['ID', '作业ID', '试卷ID', '班级ID', '学生ID', '得分', '状态', '提交时间']
            rows = data.map(answer => [
              answer.id,
              answer.assignmentId,
              answer.paperId,
              answer.classId,
              answer.studentId,
              answer.totalScore || 0,
              answer.status === 'submitted' ? '已提交' : answer.status === 'graded' ? '已批改' : answer.status,
              answer.submittedAt || ''
            ])
            break
          default:
            ElMessage.error('不支持的导出类型')
            return
        }
        
        // 创建工作簿和工作表
        var workbook = XLSX.utils.book_new()
        var ws_data = [headers, ...rows]
        worksheet = XLSX.utils.aoa_to_sheet(ws_data)
        XLSX.utils.book_append_sheet(workbook, worksheet, type)
        
        // 导出Excel文件
        var date = new Date().toISOString().slice(0, 10)
        XLSX.writeFile(workbook, type + '_' + date + '.xlsx')
        
        ElMessage.success('导出成功')
      }
    })
    .catch(function(error) {
      ElMessage.error('导出失败')
    })
}

function backupData() {
  api.get('/admin/backup')
    .then(function(res) {
      if (res.success) {
        var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        var url = URL.createObjectURL(blob)
        var link = document.createElement('a')
        link.href = url
        var date = new Date().toISOString().slice(0, 10)
        link.download = 'backup_' + date + '.json'
        link.click()
        URL.revokeObjectURL(url)
        ElMessage.success('备份成功')
      }
    })
    .catch(function(error) {
      ElMessage.error('备份失败')
    })
}

function restoreData(file) {
  var reader = new FileReader()
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result)
      api.post('/admin/restore', { data: data.data })
        .then(function(res) {
          if (res.success) {
            ElMessage.success('恢复成功')
            loadStats()
          }
        })
        .catch(function(error) {
          ElMessage.error('恢复失败')
        })
    } catch (error) {
      ElMessage.error('恢复失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  return false
}
</script>

<style scoped>
.export-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.backup-actions {
  display: flex;
  gap: 12px;
}
</style>
