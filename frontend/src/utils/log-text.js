// 把操作日志里的英文动作代码翻译成看得懂的中文
export const ACTION_TEXT = {
  LOGIN: '登录',
  LOGOUT: '退出登录',
  CREATE: '新建',
  UPDATE: '修改',
  DELETE: '删除',
  CHANGE_PASSWORD: '修改密码',
  IMPORT: '导入',
  EXPORT: '导出',
  SUBMIT: '提交作业',
  GRADE: '批改'
}

const ROLE_TEXT = { admin: '管理员', teacher: '教师', student: '学生' }

export function actionText(action) {
  return ACTION_TEXT[action] || action || '-'
}

// “教师 teacher 登录” 这样的一句话描述
export function describeLog(log) {
  const details = (log && log.details) || {}
  const who = [ROLE_TEXT[details.role], details.username || log.userId].filter(Boolean).join(' ')
  return (who ? who + ' ' : '') + actionText(log && log.action)
}

// 详情对象转成简短的中文
export function detailsText(details) {
  if (!details || typeof details !== 'object') return details ? String(details) : '-'
  const LABEL = { username: '账号', role: '角色', name: '名称', title: '标题', id: '编号', count: '数量' }
  return Object.keys(details)
    .filter(key => key !== 'timestamp')
    .map(key => (LABEL[key] || key) + '：' + (key === 'role' ? (ROLE_TEXT[details[key]] || details[key]) : details[key]))
    .join('，') || '-'
}

// “教师 teacher” 这样的用户描述，没有账号信息时退回用户编号
export function userText(log) {
  const details = (log && log.details) || {}
  const parts = [ROLE_TEXT[details.role], details.username].filter(Boolean)
  return parts.length ? parts.join(' ') : ((log && log.userId) || '-')
}
