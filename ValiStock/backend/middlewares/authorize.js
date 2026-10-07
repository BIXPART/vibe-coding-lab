/**
 * Middleware de autorização baseada em role.
 * Uso: router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), handler)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para esta ação',
      });
    }

    next();
  };
};

module.exports = authorize;
