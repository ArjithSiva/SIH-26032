const fs = require('fs');
const path = require('path');
const multer = require('multer');

// NOTE ON PERSISTENCE: this stores files on the local disk under
// backend/uploads/. That's fine for local development, but most hosted
// platforms (including Render's default web service plan) give a
// container an EPHEMERAL filesystem - anything written here is wiped on
// every redeploy or restart. Before relying on this for real farmer
// documents in production, either add a persistent disk (Render's paid
// disk add-on) or switch this to an object-storage service (S3,
// Cloudinary, etc.) - the rest of the app only ever deals with the
// relative path/URL this middleware produces, so swapping the storage
// backend later doesn't require touching any calling code.
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const LEASE_DOCS_DIR = path.join(UPLOAD_ROOT, 'lease-documents');
fs.mkdirSync(LEASE_DOCS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LEASE_DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '';
    cb(null, `${req.params.id}-${Date.now()}${safeExt}`);
  },
});

const uploadLeaseDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG or PNG files are accepted'));
    }
    return cb(null, true);
  },
}).single('leaseDocument');

// Wraps multer's callback-style middleware so a bad upload (wrong file
// type, too large) reaches the caller as a normal JSON 400 response
// instead of an unhandled error/HTML stack trace.
function handleLeaseDocumentUpload(req, res, next) {
  uploadLeaseDocument(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Could not process the uploaded file' });
    next();
  });
}

module.exports = { handleLeaseDocumentUpload, UPLOAD_ROOT };
