/**
 * Erro de aplicação com status HTTP.
 * Permite que os services sinalizem erros de regra de negócio
 * sem depender de detalhes de HTTP.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = AppError;
