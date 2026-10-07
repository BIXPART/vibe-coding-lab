/**
 * Testes do serviço de autenticação.
 * Executar: npm test
 */
const test = require('node:test');
const assert = require('node:assert');

const { sequelize, User } = require('../models');
const authService = require('../services/authService');

test.before(async () => {
  await sequelize.authenticate();
});

test.after(async () => {
  await User.destroy({ where: { email: 'teste-auth@valistock.com' } });
  await sequelize.close();
});

test('criar usuário e fazer login com sucesso', async () => {
  const user = await authService.createUser({
    name: 'Usuário Teste',
    email: 'teste-auth@valistock.com',
    password: 'senha123',
    role: 'MANAGER',
  });

  assert.ok(user.id);
  assert.strictEqual(user.role, 'MANAGER');
  // Nunca retorna password_hash
  assert.strictEqual(user.password_hash, undefined);

  const result = await authService.login('teste-auth@valistock.com', 'senha123');
  assert.ok(result.token);
  assert.strictEqual(result.user.email, 'teste-auth@valistock.com');
  assert.strictEqual(result.user.password_hash, undefined);
});

test('login com senha errada é rejeitado', async () => {
  await assert.rejects(
    () => authService.login('teste-auth@valistock.com', 'senha-errada'),
    /Credenciais inválidas/i
  );
});

test('login com e-mail inexistente é rejeitado', async () => {
  await assert.rejects(
    () => authService.login('nao-existe@valistock.com', 'qualquer'),
    /Credenciais inválidas/i
  );
});

test('criar usuário com e-mail duplicado é rejeitado', async () => {
  await assert.rejects(
    () =>
      authService.createUser({
        name: 'Duplicado',
        email: 'teste-auth@valistock.com',
        password: 'senha123',
      }),
    /já existe um usuário/i
  );
});

test('criar usuário com senha curta é rejeitado', async () => {
  await assert.rejects(
    () =>
      authService.createUser({
        name: 'Senha Curta',
        email: 'senha-curta@valistock.com',
        password: '123',
      }),
    /mínimo 6 caracteres/i
  );
});

test('senha nunca é armazenada em texto puro', async () => {
  const user = await User.scope('withPassword').findOne({
    where: { email: 'teste-auth@valistock.com' },
  });

  assert.notStrictEqual(user.password_hash, 'senha123');
  assert.ok(user.password_hash.length > 20);
  assert.ok(user.password_hash.startsWith('$2'), 'hash bcrypt esperado');
});
