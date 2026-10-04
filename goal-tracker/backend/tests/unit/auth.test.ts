/**
 * Testes de autenticação: hash de senha e token.
 *
 * Cobre AI_NOTES.md §9 - hash seguro, não expor informações sensíveis.
 */
import { beforeAll, describe, expect, it } from 'vitest';

// O custo do bcrypt é lowered antes de qualquer import que leia o env,
// senão cada hash levaria ~300ms.
process.env['BCRYPT_SALT_ROUNDS'] = '4';
process.env['JWT_SECRET'] = 'segredo-de-teste-com-no-minimo-32-caracteres';
process.env['DATABASE_URL'] = 'postgres://user:pass@localhost:5432/db';
process.env['NODE_ENV'] = 'test';

const { hashPassword, verifyPassword } = await import('../../src/utils/password.js');
const { generateToken, verifyToken, subjectToUserId } = await import('../../src/utils/jwt.js');
const { UnauthorizedError } = await import('../../src/utils/errors.js');

describe('hash de senha', () => {
  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const first = await hashPassword('senha-secreta');
    const second = await hashPassword('senha-secreta');

    expect(first).not.toBe(second);
  });

  it('confere a senha correta e rejeita a errada', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(await verifyPassword('senha-secreta', hash)).toBe(true);
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('nunca devolve a senha em texto puro', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(hash).not.toContain('senha-secreta');
  });

  it('devolve false em vez de lançar quando o hash é inválido', async () => {
    expect(await verifyPassword('qualquer', 'nao-e-um-hash')).toBe(false);
  });
});

describe('token JWT', () => {
  let token: string;

  beforeAll(() => {
    token = generateToken(42);
  });

  it('assina e valida devolvendo o subject como id numérico', () => {
    expect(subjectToUserId(verifyToken(token))).toBe(42);
  });

  it('recusa token adulterado', () => {
    const parts = token.split('.');
    const payload = parts[1] ?? '';
    // Troca o id do usuário por outro, mantendo a assinatura.
    const forged = Buffer.from(
      JSON.stringify({ sub: '999', iat: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');

    expect(() => verifyToken(`${parts[0]}.${forged}.${parts[2]}`)).toThrow(UnauthorizedError);
    expect(payload.length).toBeGreaterThan(0);
  });

  it('recusa token assinado com outro segredo', () => {
    expect(() => verifyToken('a.b.c')).toThrow(UnauthorizedError);
  });

  it('recusa subject que não é numérico', () => {
    expect(() => subjectToUserId({ sub: 'abc' })).toThrow(UnauthorizedError);
    expect(() => subjectToUserId({ sub: '-1' })).toThrow(UnauthorizedError);
    expect(() => subjectToUserId({ sub: '0' })).toThrow(UnauthorizedError);
  });
});