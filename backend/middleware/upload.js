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
const COMPLAINT_ATTACHMENTS_DIR = path.join(UPLOAD_ROOT, 'complaint-attachments');
fs.mkdirSync(LEASE_DOCS_DIR, { recursive: true });
fs.mkdirSync(COMPLAINT_ATTACHMENTS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_COMPLAINT_FILES = 3;

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

// Up to MAX_COMPLAINT_FILES (3) supporting documents/photos for a farmer
// complaint. Same allowed types/size limit as the lease-document upload.
// Runs after requireAuth on the route, so req.user is already set.
const complaintAttachmentsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, COMPLAINT_ATTACHMENTS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '';
    const who = req.user?.id || 'anon';
    cb(null, `${who}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const uploadComplaintAttachments = multer({
  storage: complaintAttachmentsStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_COMPLAINT_FILES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG or PNG files are accepted'));
    }
    return cb(null, true);
  },
}).array('attachments', MAX_COMPLAINT_FILES);

function handleComplaintAttachmentsUpload(req, res, next) {
  uploadComplaintAttachments(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_COUNT'
        ? `You can attach at most ${MAX_COMPLAINT_FILES} files`
        : err.message || 'Could not process the uploaded file(s)';
      return res.status(400).json({ message });
    }
    next();
  });
}

module.exports = {
  handleLeaseDocumentUpload,
  handleComplaintAttachmentsUpload,
  MAX_COMPLAINT_FILES,
  UPLOAD_ROOT,
};
