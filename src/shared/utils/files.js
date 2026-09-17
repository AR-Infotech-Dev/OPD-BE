import multer from "multer";

export const uploadImages = (name) => {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
            if (["image/png", "image/jpeg", "image/webp"].includes(String(file.mimetype || "").toLowerCase())) {
                callback(null, true);
                return;
            }
            callback(new Error(`Only PNG, JPG and WebP ${name} images are allowed`));
        },
    }).single(name);
}
export const getImageExtension = (file = {}) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime === "image/png") return ".png";
    if (mime === "image/webp") return ".webp";
    if (mime === "image/svg+xml") return ".svg";
    return ".jpg";
};