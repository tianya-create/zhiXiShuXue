const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zhixi-test-'));
process.env.JWT_SECRET = 'isolated-test-session-signing-key';

process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, 'uploads');
