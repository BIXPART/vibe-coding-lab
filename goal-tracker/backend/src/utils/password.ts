/**
 * Hash de senha.
 *
 * bcrypt puro em JS (bcryptjs) para não depender de compilação nativa.
 * O custo é configurável por variável de ambiente: em testes usamos um custo
 * baixo para os testes não demorarem, e o default de 12 continua em produção.
 */
import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';

/** Gera o hash. Nunca logar ou devolver o resultado fora da camada de auth. */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Comparação segura. `bcryptjs.compare` já é constant-time em relação ao
 * conteúdo, então não tentamos "melhorar" com comparações manuais.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainText, hash);
  } catch {
    // Hash corrompido/inválido não deve virar erro 500.
    return false;
  }
}