const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Middleware de autenticação.
 * Espera header: Authorization: Bearer <token>
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await User.findByPk(decoded.id);

    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo',
      });
    }

    // Disponibiliza o usuário para os próximos middlewares/controllers
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'AppError') {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = authenticate;
