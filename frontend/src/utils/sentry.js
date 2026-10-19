export function captureException(error, context) {
  // Axios errors carry Authorization headers and submitted answers. Keep only
  // diagnostic metadata in the browser console; never log the raw request.
  console.error('请求失败', {
    code: error && error.code,
    status: error && error.response && error.response.status,
    method: context && context.method
  })
}
