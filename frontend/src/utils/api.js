import axios from 'axios'
import { captureException } from './sentry'

var api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(function (config) {
  var token = localStorage.getItem('token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  var userStr = localStorage.getItem('user')
  var user = {}
  if (userStr) {
    try { user = JSON.parse(userStr) } catch (e) { user = {} }
  }
  if (user.id) config.headers['X-User-Id'] = user.id
  return config
})

api.interceptors.response.use(function (response) {
  return response.data
}, async function (error) {
  var config = error.config || {}
  var url = config.url || ''
  if (typeof url === 'string' && (url.includes('/api/log') || url.includes('daxuesoutijiang.com'))) {
    return Promise.reject(error)
  }
  config.__retryCount = config.__retryCount || 0
  if ((error.code === 'ECONNABORTED' || !error.response) && config.__retryCount < 1) {
    config.__retryCount += 1
    return api(config)
  }
  captureException(error, { url: config.url, method: config.method })
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') window.location.href = '/login'
  }
  return Promise.reject(error)
})

var request = {
  get: function (url, params) { return api.get(url, { params: params }) },
  post: function (url, data) { return api.post(url, data) },
  put: function (url, data) { return api.put(url, data) },
  delete: function (url) { return api.delete(url) }
}

request.student = {
  getWrongQuestions: function () { return request.get('/student/wrong-questions') },
  getWeakPoints: function () { return request.get('/student/weak-points') },
  getRecommendations: function (params) { return request.get('/student/recommendations', params) },
  submitAnswer: function (data) { return request.post('/student/answer/submit', data) },
  getMasteryTrend: function (params) { return request.get('/student/mastery/trend', params) },
  getKnowledgeDetail: function (kpId) { return request.get('/student/knowledge-point/' + kpId + '/detail') },
  getPracticeQuestions: function (kpId) { return request.get('/student/practice/' + kpId) },
  submitPractice: function (kpId, data) { return request.post('/student/practice/' + kpId + '/submit', data) },
  getQuestionsByKp: function (kpId) { return request.get('/student/questions', { knowledgePointId: kpId }) },
  getAiTutorStatus: function () { return request.get('/student/ai-tutor/status') },
  askAiTutor: function (data) { return request.post('/student/ai-tutor/chat', data) }
}

request.admin = {
  getAiTutorSettings: function () { return request.get('/admin/ai-tutor/settings') },
  validateAiTutorSettings: function (data) { return request.post('/admin/ai-tutor/validate', data) },
  saveAiTutorSettings: function (data) { return request.put('/admin/ai-tutor/settings', data) }
}

request.common = {
  getKnowledgeGraph: function (params) { return request.get('/common/knowledge-graph', params) },
  getWrongByKnowledge: function (knowledgeId) { return request.get('/common/wrong-q/' + knowledgeId) },
  getRecommendByKnowledge: function (knowledgeId) { return request.get('/common/recommend-q/' + knowledgeId) }
}

export default request
