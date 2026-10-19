import katex from 'katex'

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plain(text) {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

/**
 * 把含 $...$（行内）或 $$...$$（独立）公式的文本渲染成安全的 HTML。
 * 公式以外的内容一律转义，所以可以放心配合 v-html 使用。
 * 题库里的 Unicode 写法（x²、√2、π）不需要处理，按原样显示。
 */
export function renderMath(text) {
  if (text === null || text === undefined || text === '') return ''
  var source = String(text)
  if (source.indexOf('$') === -1) return plain(source)

  var result = ''
  var remaining = source
  while (remaining.length > 0) {
    var displayStart = remaining.indexOf('$$')
    var inlineStart = remaining.indexOf('$')
    if (displayStart === -1 && inlineStart === -1) {
      result += plain(remaining)
      break
    }
    var useDisplay = displayStart !== -1 && displayStart <= inlineStart
    var startIdx = useDisplay ? displayStart : inlineStart
    var delim = useDisplay ? '$$' : '$'
    var endIdx = remaining.indexOf(delim, startIdx + delim.length)
    if (endIdx === -1) {
      result += plain(remaining)
      break
    }
    if (startIdx > 0) result += plain(remaining.slice(0, startIdx))
    var latex = remaining.slice(startIdx + delim.length, endIdx)
    try {
      result += katex.renderToString(latex, { displayMode: useDisplay, throwOnError: false })
    } catch (e) {
      result += plain(delim + latex + delim)
    }
    remaining = remaining.slice(endIdx + delim.length)
  }
  return result
}
