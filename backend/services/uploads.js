const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("../database/memory-db");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
function uploadImage(kind) {
  return [
    upload.single("file"),
    (req, res) => {
      const file = req.file;
      if (!file)
        return res.status(400).json({ success: false, message: "请选择图片" });
      const png = file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg =
        file.buffer[0] === 255 &&
        file.buffer[1] === 216 &&
        file.buffer[2] === 255;
      if (!png && !jpeg)
        return res
          .status(400)
          .json({
            success: false,
            message: "只支持有效的 PNG 或 JPEG 图片，最大 5 MB",
          });
      const directory = path.join(
        process.env.UPLOAD_DIR || path.join(__dirname, "../uploads"),
        kind,
      );
      fs.mkdirSync(directory, { recursive: true });
      const filename = crypto.randomUUID() + (png ? ".png" : ".jpg");
      fs.writeFileSync(path.join(directory, filename), file.buffer);
      const filePath = "/uploads/" + kind + "/" + filename;
      db.create("uploadedFiles", {
        ownerId: req.user.id,
        filePath,
        size: file.size,
        kind,
      });
      res.json({ success: true, data: { filePath, size: file.size } });
    },
  ];
}
module.exports = { uploadImage };
