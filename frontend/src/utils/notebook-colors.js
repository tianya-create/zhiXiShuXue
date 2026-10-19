// “方格本”主题在图表（ECharts）里用到的颜色，与 styles/notebook.css 保持一致。
// 鲜艳色用于填色和线条，*Ink 色用于文字。
export const NB = {
  ink: '#1a2140',
  ink2: '#434e75',
  ink3: '#6b7699',
  line: '#d8e1f2',
  lineStrong: '#bfcce6',
  blue: '#2a55f5',
  blueSoft: '#e7edff',
  red: '#f0443e',
  redInk: '#d92d2b',
  redSoft: '#ffe9e8',
  orange: '#ff9500',
  orangeInk: '#c25e00',
  orangeSoft: '#fff0da',
  green: '#13b57e',
  greenInk: '#0a8a5c',
  greenSoft: '#ddf6ec',
  yellow: '#ffd43b',
  purple: '#7c4dff',
  pink: '#f2449b',
  teal: '#00a7b5',
  palette: ['#2a55f5', '#ff9500', '#13b57e', '#f2449b', '#7c4dff', '#00a7b5', '#f0443e']
}

export const NB_MASTERY = {
  已掌握: NB.green,
  待巩固: NB.orange,
  薄弱: NB.red
}

export const NB_MASTERY_INK = {
  已掌握: NB.greenInk,
  待巩固: NB.orangeInk,
  薄弱: NB.redInk
}

// 五大知识模块各有一个颜色，便于一眼区分
export const NB_CATEGORY = {
  数与式: NB.blue,
  方程与不等式: NB.purple,
  函数: NB.pink,
  几何: NB.teal,
  统计概率: NB.orange
}

export const NB_FONT = "'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"

// 与 utils/chart-theme.js 中 CHART_COLORS 同名的键，方便教师端页面直接替换
export const NB_CHART = {
  brand: NB.blue,
  brandAlt: NB.pink,
  mastered: NB.green,
  learning: NB.orange,
  weak: NB.red,
  neutral: '#9aa5c4',
  axis: NB.ink2,
  splitLine: 'rgba(42, 85, 245, 0.12)',
  palette: NB.palette
}

export const NB_CHART_MASTERY = NB_MASTERY

export function nbBrandGradient(echarts, horizontal) {
  return new echarts.graphic.LinearGradient(0, 0, horizontal ? 1 : 0, horizontal ? 0 : 1, [
    { offset: 0, color: NB.blue },
    { offset: 1, color: NB.purple }
  ])
}

export function nbAreaGradient(echarts, color) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: color + '55' },
    { offset: 1, color: color + '08' }
  ])
}

// ECharts 主题：字号不小于 13px，颜色与“方格本”一致。用法：echarts.init(dom, NB_ECHARTS_THEME)
export const NB_ECHARTS_THEME = 'notebook'

let chartThemeRegistered = false

export function registerNotebookChartTheme(echarts) {
  if (chartThemeRegistered) return
  const axis = {
    axisLine: { lineStyle: { color: NB.lineStrong } },
    axisTick: { lineStyle: { color: NB.lineStrong } },
    axisLabel: { color: NB.ink2, fontSize: 14 },
    splitLine: { lineStyle: { color: 'rgba(42, 85, 245, 0.10)' } },
    nameTextStyle: { color: NB.ink2, fontSize: 14 }
  }
  echarts.registerTheme(NB_ECHARTS_THEME, {
    color: NB.palette,
    textStyle: { fontFamily: NB_FONT, fontSize: 14, color: NB.ink2 },
    title: { textStyle: { color: NB.ink, fontSize: 16 } },
    legend: { textStyle: { color: NB.ink2, fontSize: 14 }, itemWidth: 16, itemHeight: 10 },
    tooltip: {
      textStyle: { fontSize: 14, color: NB.ink },
      backgroundColor: '#ffffff',
      borderColor: NB.line,
      extraCssText: 'border-radius:10px;box-shadow:0 10px 24px -12px rgba(26,33,64,.35);'
    },
    categoryAxis: axis,
    valueAxis: axis,
    radar: { axisName: { color: NB.ink2, fontSize: 14 } },
    line: { symbolSize: 8, lineStyle: { width: 3 } },
    bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } }
  })
  chartThemeRegistered = true
}
