// 全站图表统一配色，与 styles/index.css 中的品牌色保持一致。
export const CHART_COLORS = {
  brand: '#2d8ee8',
  brandAlt: '#34c7c1',
  mastered: '#16a37b',
  learning: '#e8a23a',
  weak: '#e5534b',
  neutral: '#94a3b8',
  axis: '#637f8f',
  splitLine: 'rgba(126, 205, 225, 0.25)',
  palette: ['#2d8ee8', '#34c7c1', '#e8a23a', '#7b6fdc', '#e5534b', '#16a37b', '#5aa9e6', '#94a3b8']
}

export const MASTERY_COLORS = {
  已掌握: CHART_COLORS.mastered,
  待巩固: CHART_COLORS.learning,
  薄弱: CHART_COLORS.weak
}

export function brandGradient(echarts, horizontal) {
  return new echarts.graphic.LinearGradient(0, 0, horizontal ? 1 : 0, horizontal ? 0 : 1, [
    { offset: 0, color: CHART_COLORS.brand },
    { offset: 1, color: CHART_COLORS.brandAlt }
  ])
}

export function areaGradient(echarts, color) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: color + '66' },
    { offset: 1, color: color + '0d' }
  ])
}
