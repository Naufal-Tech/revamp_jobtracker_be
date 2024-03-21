import DataParser from "datauri/parser.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// Not Using Buffer
const setupMulter = (importMetaUrl) => {
  const __dirname = path.dirname(fileURLToPath(importMetaUrl));
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../images");
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const fileName = file.originalname;
      const formattedDate = moment()
        .tz("Asia/Jakarta")
        .format("DD-MMMM-YYYY HH:mm:ss");
      const newFileName = `${formattedDate}-${fileName}`;
      cb(null, newFileName);
    },
  });
  return multer({ storage });
};

const storage = multer.memoryStorage();
const upload = multer({ storage });
const parser = new DataParser();

export const formatImage = (file) => {
  const fileExtention = path.extname(file.originalname).toString();
  return parser.format(fileExtention, file.buffer).content;
};

export { setupMulter, upload };
