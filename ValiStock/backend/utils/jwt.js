const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

const JWT_SECRET = process.env.JWT_SECRET || 'valor-padrao-inseguro';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'valor-padrao-inseguro') {
  throw new Error('JWT_SECRET deve ser definido em produção');
}

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new AppError('Token inválido ou expirado', 401);
  }
};

module.exports = { generateToken, verifyToken };
