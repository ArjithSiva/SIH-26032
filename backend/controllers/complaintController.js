const path = require('path');
const Complaint = require('../models/Complaint');
const { UPLOAD_ROOT } = require('../middleware/upload');

// POST /api/complaints  { farmerId, centreId, bookingId?, category, message } + attachments[] (multipart)
async function fileComplaint(req, res) {
  try {
    const { farmerId, centreId, bookingId, category, message } = req.body;
    if (req.user.role === 'farmer' && req.user.id !== farmerId) {
      return res.status(403).json({ message: 'Not authorised' });
    }
    if (!farmerId || !centreId || !message) {
      return res.status(400).json({ message: 'farmerId, centreId and message are required' });
    }

    // Stored as forward-slash relative paths (not OS-specific) so they
    // resolve the same way whether the server runs on Windows or Linux -
    // the frontend/admin view just prefixes these with /uploads/.
    const attachments = (req.files || []).map((f) =>
      path.relative(UPLOAD_ROOT, f.path).split(path.sep).join('/')
    );
    if (attachments.length === 0) {
      return res.status(400).json({ message: 'Attach at least one supporting document or photo' });
    }

    const complaint = await Complaint.create({
      farmer: farmerId,
      centre: centreId,
      booking: bookingId || null,
      category: category || 'other',
      message,
      attachments,
    });
    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ message: 'Could not file complaint', error: err.message });
  }
}

// GET /api/complaints/farmer/:farmerId
async function getComplaintsForFarmer(req, res) {
  try {
    if (req.user.role === 'farmer' && req.user.id !== req.params.farmerId) {
      return res.status(403).json({ message: 'Not authorised' });
    }
    const complaints = await Complaint.find({ farmer: req.params.farmerId })
      .populate('centre', 'name district codePrefix')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch complaints', error: err.message });
  }
}

// GET /api/complaints  ?status=&centreId=  (admin only)
async function listComplaints(req, res) {
  try {
    const { status, centreId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (centreId) filter.centre = centreId;

    const complaints = await Complaint.find(filter)
      .populate('farmer', 'name mobileNumber')
      .populate('centre', 'name district codePrefix')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch complaints', error: err.message });
  }
}

// PUT /api/complaints/:id  { status, adminNote }  (admin only)
async function updateComplaint(req, res) {
  try {
    const { status, adminNote } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      if (status === 'resolved') update.resolvedAt = new Date();
    }
    if (adminNote !== undefined) update.adminNote = adminNote;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: 'Could not update complaint', error: err.message });
  }
}

module.exports = { fileComplaint, getComplaintsForFarmer, listComplaints, updateComplaint };
