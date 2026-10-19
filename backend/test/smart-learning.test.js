const { jaccard, getForgettingUrgency } = require('../services/recommendation')
const { gradeAnswer } = require('../services/autoGrade')
const { updateMastery } = require('../services/masteryEngine')
const { seedDemoData } = require('../seed/demo_data')
const { getKnowledgeGraph, getWrongQuestionsByKnowledge, getRecommendQuestionsByKnowledge } = require('../services/knowledge-graph')
const db = require('../database/memory-db')
const knowledgeTree = require('../../shared/knowledge-tree.json')

describe('recommendation factors', () => {
  test('jaccard works', () => {
    expect(jaccard(['kp1', '计算'], ['kp1', '计算'])).toBe(1)
    expect(jaccard(['kp1'], ['kp2'])).toBe(0)
  })

  test('forgetting urgency returns positive score', () => {
    const question = db.find('questions')[0]
    expect(getForgettingUrgency('student-001', question)).toBeGreaterThan(0)
  })
})

describe('auto grade', () => {
  test('subjective answers require teacher review even with a matching answer', () => {
    const result = gradeAnswer({ type: 'subjective', answer_text: '^x=±2$' }, 'x=±2')
    expect(result.isCorrect).toBeNull()
    expect(result.needsReview).toBe(true)
  })

  test('matching proof text is not an automatic final grade', () => {
    const result = gradeAnswer({ type: 'subjective', answer_text: '平行线是在同一平面内永不相交的两条直线' }, '平行线是在同一平面内永不相交的两条直线')
    expect(result.needsReview).toBe(true)
  })
})

describe('mastery state machine', () => {
  test('updateMastery returns valid status', () => {
    db.create('student_answer', { userId: 'student-001', questionId: 'q1', kpCode: 'kp-001', isCorrect: true, costTime: 60 })
    const mastery = updateMastery('student-001', 'kp-001')
    expect(mastery.status).toBe('样本不足')
    expect(mastery.mastery).toBeLessThan(80)
  })
})

describe('knowledge graph demo data', () => {
  test('seed and query graph data', () => {
    seedDemoData()
    const expectedNodeIds = knowledgeTree.categories.flatMap(category => category.nodes.map(node => node.id))
    expect(expectedNodeIds.length).toBeGreaterThan(0)
    const graph = getKnowledgeGraph({ page: 1, pageSize: 500 })
    expect(graph.total).toBe(expectedNodeIds.length)
    expect(graph.data.map(node => node.id).sort()).toEqual(expectedNodeIds.slice().sort())
    expect(getWrongQuestionsByKnowledge('alg-1').length).toBeGreaterThanOrEqual(5)
    expect(getRecommendQuestionsByKnowledge('alg-1').length).toBeGreaterThanOrEqual(3)
  })
})
