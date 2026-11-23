const { requireAuth } = require('./auth');

exports.requireRole = (...roles) => (req, res, next) => {
  requireAuth(req, res, () => {
    if (roles.includes(req.session.user.role)) return next();
    res.status(403).send('Akses ditolak.');
  });
};