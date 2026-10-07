/**
 * Middleware global de tratamento de erros.
 * Padroniza as respostas de erro e evita expor detalhes internos em produção.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERRO] ${err.message}`);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Erros de validação do Sequelize
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: err.errors.map((e) => e.message).join(', '),
    });
  }

  // Violação de unique (código de barras duplicado, etc)
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'campo';
    return res.status(409).json({
      success: false,
      message: `Já existe um registro com este valor em ${field}`,
    });
  }

  // Erro de conexão com o banco
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      success: false,
      message: 'Serviço de banco de dados indisponível. Tente novamente.',
    });
  }

  // Erro customizado com status (AppError)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Erro genérico
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message:
      status === 500 && process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message || 'Erro interno do servidor',
  });
};

module.exports = errorHandler;
