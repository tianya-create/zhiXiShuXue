const path = require('node:path');
function resolveUpload(filePath) {
  if (!/^\/uploads\/(answers|questions|papers)\/[\w.-]+\.(png|jpe?g|pdf)$/i.test(filePath || '')) throw new Error('上传文件路径无效');
  const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
  const resolved = path.resolve(root, filePath.slice('/uploads/'.length));
  if (!resolved.startsWith(root + path.sep)) throw new Error('上传文件路径超出存储目录');
  return resolved;
}
module.exports = { resolveUpload };
