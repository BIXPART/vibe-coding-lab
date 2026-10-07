const authService = require('../services/authService');

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Requer middleware authenticate (req.user já carregado, sem password_hash).
 */
const me = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

module.exports = { login, me };
