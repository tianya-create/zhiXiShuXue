import { createRouter, createWebHistory } from 'vue-router'

// 路由配置
const routes = [
  // 登录页面
  {
    path: '/login',
    name: 'Login',
    component: function() { return import('@/views/Login.vue') },
    meta: { title: '登录' }
  },
  
  // 教师端路由
  {
    path: '/teacher',
    component: function() { return import('@/layouts/TeacherLayout.vue') },
    meta: { requiresAuth: true, role: 'teacher' },
    children: [
      {
        path: '',
        redirect: '/teacher/dashboard'
      },
      {
        path: 'dashboard',
        name: 'TeacherDashboard',
        component: function() { return import('@/views/teacher/Dashboard.vue') },
        meta: { title: '教师首页' }
      },
      {
        path: 'classes',
        name: 'TeacherClasses',
        component: function() { return import('@/views/teacher/Classes.vue') },
        meta: { title: '班级管理' }
      },
      {
        path: 'students',
        name: 'TeacherStudents',
        component: function() { return import('@/views/teacher/Students.vue') },
        meta: { title: '学生管理' }
      },
      {
        path: 'papers',
        name: 'TeacherPapers',
        component: function() { return import('@/views/teacher/Papers.vue') },
        meta: { title: '试卷管理' }
      },
      {
        path: 'questions',
        name: 'TeacherQuestions',
        component: function() { return import('@/views/teacher/Questions.vue') },
        meta: { title: '题目管理' }
      },
      {
        path: 'assignments',
        name: 'TeacherAssignments',
        component: function() { return import('@/views/teacher/Assignments.vue') },
        meta: { title: '作业管理' }
      },
      {
        path: 'grading',
        name: 'TeacherGrading',
        component: function() { return import('@/views/teacher/Grading.vue') },
        meta: { title: '批改中心' }
      },
      {
        path: 'analytics/class',
        name: 'TeacherClassAnalytics',
        component: function() { return import('@/views/teacher/ClassAnalytics.vue') },
        meta: { title: '班级学情' }
      },
      {
        path: 'analytics/student/:id?',
        name: 'TeacherStudentAnalytics',
        component: function() { return import('@/views/teacher/StudentAnalytics.vue') },
        meta: { title: '学生学情' }
      },
      {
        path: 'profile',
        name: 'TeacherProfile',
        component: function() { return import('@/views/teacher/Profile.vue') },
        meta: { title: '个人设置' }
      }
    ]
  },
  
  // 学生端路由
  {
    path: '/student',
    component: function() { return import('@/layouts/StudentLayout.vue') },
    meta: { requiresAuth: true, role: 'student' },
    children: [
      {
        path: '',
        redirect: '/student/dashboard'
      },
      {
        path: 'dashboard',
        name: 'StudentDashboard',
        component: function() { return import('@/views/student/Dashboard.vue') },
        meta: { title: '学生首页' }
      },
      {
        path: 'assignments',
        name: 'StudentAssignments',
        component: function() { return import('@/views/student/Assignments.vue') },
        meta: { title: '我的作业' }
      },
      {
        path: 'assignment/:id',
        name: 'StudentAssignmentDetail',
        component: function() { return import('@/views/student/AssignmentDetail.vue') },
        meta: { title: '答题详情' }
      },
      {
        path: 'knowledge',
        name: 'StudentKnowledge',
        component: function() { return import('@/views/student/Knowledge.vue') },
        meta: { title: '知识图谱' }
      },
      {
        path: 'weak-points',
        name: 'StudentWeakPoints',
        component: function() { return import('@/views/student/WeakPoints.vue') },
        meta: { title: '薄弱知识点' }
      },
      {
        path: 'practice',
        name: 'StudentPractice',
        component: function() { return import('@/views/student/Practice.vue') },
        meta: { title: '薄弱补练' }
      },
      {
        path: 'wrong-questions',
        name: 'StudentWrongQuestions',
        component: function() { return import('@/views/student/WrongQuestions.vue') },
        meta: { title: '错题本' }
      },
      {
        path: 'learning-track',
        name: 'StudentLearningTrack',
        component: function() { return import('@/views/student/LearningTrack.vue') },
        meta: { title: '学习轨迹' }
      },
      {
        path: 'profile',
        name: 'StudentProfile',
        component: function() { return import('@/views/student/Profile.vue') },
        meta: { title: '个人信息' }
      }
    ]
  },
  
  // 管理端路由
  {
    path: '/admin',
    component: function() { return import('@/layouts/AdminLayout.vue') },
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      {
        path: '',
        redirect: '/admin/dashboard'
      },
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: function() { return import('@/views/admin/Dashboard.vue') },
        meta: { title: '管理首页' }
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: function() { return import('@/views/admin/Users.vue') },
        meta: { title: '用户管理' }
      },
      {
        path: 'classes',
        name: 'AdminClasses',
        component: function() { return import('@/views/admin/Classes.vue') },
        meta: { title: '班级列表管理' }
      },
      {
        path: 'knowledge-points',
        name: 'AdminKnowledgePoints',
        component: function() { return import('@/views/admin/KnowledgePoints.vue') },
        meta: { title: '知识点管理' }
      },
      {
        path: 'questions',
        name: 'AdminQuestions',
        component: function() { return import('@/views/admin/Questions.vue') },
        meta: { title: '题库管理' }
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: function() { return import('@/views/admin/Settings.vue') },
        meta: { title: '系统设置' }
      },
      {
        path: 'logs',
        name: 'AdminLogs',
        component: function() { return import('@/views/admin/Logs.vue') },
        meta: { title: '操作日志' }
      },
      {
        path: 'statistics',
        name: 'AdminStatistics',
        component: function() { return import('@/views/admin/Statistics.vue') },
        meta: { title: '数据统计' }
      }
    ]
  },
  
  // 根路径重定向
  {
    path: '/',
    redirect: '/login'
  },
  
  // 404 页面
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: function() { return import('@/views/NotFound.vue') }
  }
]

var router = createRouter({
  history: createWebHistory(),
  routes: routes
})

// 路由守卫
router.beforeEach(function(to, from, next) {
  // 设置页面标题
  var title = to.meta.title
  if (title) {
    document.title = String(title) + ' - 智慧教育平台'
  } else {
    document.title = '智慧教育平台'
  }
  
  // 检查是否需要登录
  if (to.meta.requiresAuth) {
    // 从 localStorage 获取登录信息
    var token = localStorage.getItem('token')
    var userStr = localStorage.getItem('user')
    
    if (!token) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
    
    // 检查角色权限
    if (to.meta.role) {
      var user = null
      try {
        user = JSON.parse(userStr)
      } catch (e) {
        user = null
      }
      
      var requiredRole = String(to.meta.role)
      var userRole = ''
      if (user && user.role) {
        userRole = String(user.role)
      }
      
      if (userRole !== requiredRole) {
        // 重定向到对应角色的首页
        var targetPath = '/login'
        if (userRole === 'teacher') {
          targetPath = '/teacher/dashboard'
        } else if (userRole === 'student') {
          targetPath = '/student/dashboard'
        } else if (userRole === 'admin') {
          targetPath = '/admin/dashboard'
        }
        next(targetPath)
        return
      }
    }
  }
  
  next()
})

export default router
