const bcrypt = require('bcryptjs');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const { generateToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

/**
 * Realiza o login e retorna token + dados do usuário.
 */
const login = async (email, password) => {
  if (!email || !password) {
    throw new AppError('E-mail e senha são obrigatórios', 400);
  }

  // Busca com o escopo que inclui password_hash (nunca retornado ao cliente)
  const user = await User.scope('withPassword').findOne({
    where: { email },
  });

  if (!user) {
    throw new AppError('Credenciais inválidas', 401);
  }

  if (!user.active) {
    throw new AppError('Usuário inativo. Contate o administrador', 403);
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    throw new AppError('Credenciais inválidas', 401);
  }

  const token = generateToken(user);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

/**
 * Cria um usuário (usado pelo seed e pelo gerenciamento ADMIN).
 */
const createUser = async ({ name, email, password, role = 'EMPLOYEE' }) => {
  if (!name || !email || !password) {
    throw new AppError('Nome, e-mail e senha são obrigatórios', 400);
  }

  if (password.length < 6) {
    throw new AppError('A senha deve ter no mínimo 6 caracteres', 400);
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError('Já existe um usuário com este e-mail', 409);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({ name, email, password_hash, role });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

module.exports = { login, createUser };
