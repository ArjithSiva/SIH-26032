const jwt = require('jsonwebtoken');

function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ message: 'Not authorised for this action' });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

// Shared ownership guard for any controller action that operates on a
// booking by id: requireAuth(['officer', 'admin']) only proves the caller
// IS an officer or admin, not that an officer is acting on their OWN
// centre's booking - without this, any officer could check-in/call-next/
// mark-absent/advance-stage/record-quantity/update-payment on a booking
// belonging to a completely different centre, just by knowing its id.
// Admins are intentionally centre-unrestricted. Throws so callers can just
// let it propagate to their existing catch block and forward err.status.
function assertOfficerOwnsCentre(req, centreId) {
  if (req.user.role === 'officer' && String(req.user.centre) !== String(centreId)) {
    throw Object.assign(new Error('Not authorised for this centre'), { status: 403 });
  }
}

module.exports = { requireAuth, assertOfficerOwnsCentre };
