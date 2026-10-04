/**
 * Testes de integração das regras de recorrência, com banco real.
 *
 * Por que Precisam de banco: várias regras importantes só valem de verdade
 * quando existe a constraint UNIQUE e uma transação de verdade.
 *
 * Exemplo que os testes unitários não pegariam: dois `POST /complete`
 * simultâneos. No service, os dois leem PENDING; um INSERT ganha e o outro
 * toma UniqueConstraintError. Sem o tratamento no `catch`, o usuário veria
 * "não foi possível concluir" num caso que deveria ser sucesso.
 *
 * Estes testes rodam `sync({ force: true })` e `destroy({ force: true })`:
 * por isso exigem um banco DESCARTÁVEL, via `TEST_DATABASE_URL`. Não há
 * fallback para `DATABASE_URL` de propósito — um fallback apagaria o seed de
 * desenvolvimento sem aviso, e o teste "dashboard vazio" passaria na base errada.
 *
 *   docker compose up -d                       # cria goal_tracker_test
 *   TEST_DATABASE_URL=postgres://goals:goals@localhost:5432/goal_tracker_test npm test
 */
import { config as loadDotenv } from 'dotenv';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// O Vitest não injeta `.env` no `process.env`, e `config/env.ts` (que usa
// dotenv) só é importado mais abaixo, via `await import(...)`. Carregamos aqui
// para que `TEST_DATABASE_URL` esteja visível neste ponto.
loadDotenv();

const databaseUrl = process.env['TEST_DATABASE_URL'];

if (!databaseUrl) {
  throw new Error(
    [
      'TEST_DATABASE_URL é obrigatória para os testes de integração.',
      '',
      'Os testes de integração destroem e recriam as tabelas. Apontá-los para o',
      'banco de desenvolvimento apagaria o seed e os dados locais.',
      '',
      '  docker compose up -d',
      '  echo "TEST_DATABASE_URL=postgres://goals:goals@localhost:5432/goal_tracker_test" >> .env',
      '  npm test',
      '',
      'PostgreSQL local (sem Docker): CREATE DATABASE goal_tracker_test OWNER goals;',
      '',
      'Só os testes unitários rodam sem banco: npx vitest run tests/unit',
    ].join('\n'),
  );
}

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = databaseUrl;
process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] ?? 'segredo-de-teste-com-no-minimo-32-caracteres';
process.env['BCRYPT_SALT_ROUNDS'] = '4';

const { createApp } = await import('../../src/app.js');
const { sequelize } = await import('../../src/config/database.js');
const { Goal, GoalOccurrence, User } = await import('../../src/models/index.js');
const { syncDatabase } = await import('../../src/migrations/sync.js');
const { buildDashboard } = await import('../../src/services/stats.service.js');
const { hashPassword } = await import('../../src/utils/password.js');
const { formatCivilDate, toCivilDate } = await import('../../src/utils/civil-date.js');
const { enumeratePeriods, periodKey, resolvePeriodForInstant } = await import(
  '../../src/utils/period.js'
);

const app = createApp();
const TIME_ZONE = 'America/Sao_Paulo';

/** Instante controlado: os testes não dependem do relógio real. */
const NOW = new Date('2026-10-04T15:00:00-03:00');

async function resetDatabase(): Promise<void> {
  await GoalOccurrence.destroy({ where: {}, force: true });
  await Goal.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
}

/**
 * Cria um usuário e um token para os testes.
 *
 * `createdAt` é fixado em `NOW`: sem isso, `new Date()` usaria o relógio real
 * (2026-10-04 é uma data plausível só por acaso) e o histórico gerado
 * variaria entre execuções.
 */
async function createUser(email: string): Promise<{ id: number; token: string }> {
  const user = await User.create(
    {
      email,
      passwordHash: await hashPassword('senha-de-teste'),
      name: 'Teste',
      timezone: TIME_ZONE,
    },
    { silent: true },
  );

  // createdAt é gerado pelo Sequelize; sobrescrevemos para determinismo.
  await User.update({ createdAt: NOW, updatedAt: NOW }, { where: { id: user.id } });

  const { generateToken } = await import('../../src/utils/jwt.js');
  return { id: user.id, token: generateToken(user.id) };
}

/** Cria uma meta com `createdAt` controlado. */
async function createGoal(
  token: string,
  name: string,
  frequency: string,
  createdAt: Date = NOW,
): Promise<{ id: number }> {
  const response = await request(app)
    .post('/api/goals')
    .set(...auth(token))
    .send({ name, frequency });

  const goalId = response.body.goal.id as number;

  await Goal.update({ createdAt, updatedAt: createdAt }, { where: { id: goalId } });

  return { id: goalId };
}

function auth(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

beforeAll(async () => {
  await sequelize.authenticate();
  // `force: true` recria as tabelas: estado previsível entre execuções.
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

beforeEach(async () => {
  await resetDatabase();
});

/* -------------------------------------------------------------------------- */

describe('ciclo de vida das metas', () => {
  it('cria uma meta e a devolve sem expor o userId de outro usuário', async () => {
    const { token } = await createUser('a@test.dev');

    const created = await request(app)
      .post('/api/goals')
      .set(...auth(token))
      .send({ name: 'Estudar', frequency: 'DAILY' });

    expect(created.status).toBe(201);
    expect(created.body.goal).toMatchObject({
      name: 'Estudar',
      frequency: 'DAILY',
      isActive: true,
      description: null,
    });
    // `userId` existe no modelo, mas não faz parte do contrato público.
    expect(created.body.goal.userId).toBeUndefined();
  });

  it('rejeita meta sem nome ou com frequência inválida', async () => {
    const { token } = await createUser('b@test.dev');

    const semNome = await request(app)
      .post('/api/goals')
      .set(...auth(token))
      .send({ frequency: 'DAILY' });

    expect(semNome.status).toBe(400);
    expect(semNome.body.error.code).toBe('VALIDATION_ERROR');

    const freqRuim = await request(app)
      .post('/api/goals')
      .set(...auth(token))
      .send({ name: 'X', frequency: 'HORARIA' });

    expect(freqRuim.status).toBe(400);
  });

  it('edita e exclui a própria meta', async () => {
    const { token } = await createUser('c@test.dev');

    const created = await request(app)
      .post('/api/goals')
      .set(...auth(token))
      .send({ name: 'Ler', frequency: 'WEEKLY' });

    const goalId = created.body.goal.id as number;

    const updated = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set(...auth(token))
      .send({ name: 'Ler 20 páginas' });

    expect(updated.status).toBe(200);
    expect(updated.body.goal.name).toBe('Ler 20 páginas');

    const removed = await request(app).delete(`/api/goals/${goalId}`).set(...auth(token));
    expect(removed.status).toBe(204);

    const afterDelete = await request(app).get(`/api/goals/${goalId}`).set(...auth(token));
    expect(afterDelete.status).toBe(404);
  });
});

describe('permissões entre usuários (regras 11 e 12)', () => {
  it('usuário A não consegue ler, editar nem excluir a meta do usuário B', async () => {
    const dono = await createUser('dono@test.dev');
    const intruso = await createUser('intruso@test.dev');

    const created = await request(app)
      .post('/api/goals')
      .set(...auth(dono.token))
      .send({ name: 'Privada', frequency: 'DAILY' });

    const goalId = created.body.goal.id as number;

    // 404 (não 403): confirmar "acesso negado" revelaria que a meta existe.
    expect((await request(app).get(`/api/goals/${goalId}`).set(...auth(intruso.token))).status).toBe(404);
    expect(
      (await request(app).patch(`/api/goals/${goalId}`).set(...auth(intruso.token)).send({ name: 'Hack' }))
        .status,
    ).toBe(404);
    expect((await request(app).delete(`/api/goals/${goalId}`).set(...auth(intruso.token))).status).toBe(404);
    expect(
      (await request(app).get(`/api/goals/${goalId}/stats`).set(...auth(intruso.token))).status,
    ).toBe(404);
  });

  it('não aceita concluir meta de outro usuário mesmo enviando o id dele', async () => {
    const dono = await createUser('dono2@test.dev');
    const intruso = await createUser('intruso2@test.dev');

    const created = await request(app)
      .post('/api/goals')
      .set(...auth(dono.token))
      .send({ name: 'Privada', frequency: 'DAILY' });

    const resposta = await request(app)
      .post(`/api/goals/${created.body.goal.id}/occurrences/complete`)
      .set(...auth(intruso.token));

    expect(resposta.status).toBe(404);
  });

  it('exige autenticação em todas as rotas de metas', async () => {
    const semToken = await request(app).get('/api/goals');
    expect(semToken.status).toBe(401);

    const tokenInvalido = await request(app)
      .get('/api/goals')
      .set('Authorization', 'Bearer token.invalido.aqui');
    expect(tokenInvalido.status).toBe(401);
  });

  it('ignora body com userId falso: o token manda', async () => {
    const vitima = await createUser('vitima@test.dev');
    const atacante = await createUser('atacante@test.dev');

    const criada = await request(app)
      .post('/api/goals')
      .set(...auth(vitima.token))
      .send({ name: 'Da vítima', frequency: 'DAILY' });

    const response = await request(app)
      .post('/api/goals')
      .set(...auth(atacante.token))
      .send({ name: 'Do atacante', frequency: 'DAILY', userId: vitima.id });

    expect(response.status).toBe(201);

    // A meta foi criada em nome do ATACANTE, não da vítima.
    const listaDaVitima = await request(app).get('/api/goals').set(...auth(vitima.token));
    expect(listaDaVitima.body.goals).toHaveLength(1);
    expect(listaDaVitima.body.goals[0].id).toBe(criada.body.goal.id);
  });
});

describe('recorrência: uma ocorrência por período', () => {
  it('concluir o período atual cria a ocorrência do período atual', async () => {
    const { token } = await createUser('rec@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    const response = await request(app)
      .post(`/api/goals/${goal.id}/occurrences/complete`)
      .set(...auth(token));

    expect(response.status).toBe(200);
    expect(response.body.occurrence.status).toBe('COMPLETED');
    expect(response.body.occurrence.periodStart).toBe('2026-10-04');
    expect(response.body.occurrence.periodEnd).toBe('2026-10-04');
    expect(response.body.occurrence.completedAt).not.toBeNull();
  });

  it('regra 1: a segunda conclusão no mesmo período é rejeitada com 409', async () => {
    const { token } = await createUser('dup@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    await request(app).post(`/api/goals/${goal.id}/occurrences/complete`).set(...auth(token));

    const segunda = await request(app)
      .post(`/api/goals/${goal.id}/occurrences/complete`)
      .set(...auth(token));

    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('OCCURRENCE_ALREADY_COMPLETED');

    // Continua existindo exatamente UMA ocorrência daquele período.
    const rows = await GoalOccurrence.findAll({
      where: { goalId: goal.id, periodStart: '2026-10-04' },
    });
    expect(rows).toHaveLength(1);
  });

  it('regra 3: concluir hoje não altera o histórico de ontem', async () => {
    const { token } = await createUser('hist@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    // Ontem concluída, anteontem não concluída.
    await GoalOccurrence.bulkCreate([
      {
        goalId: goal.id,
        periodStart: '2026-10-02',
        periodEnd: '2026-10-02',
        status: 'COMPLETED',
        completedAt: new Date('2026-10-02T20:00:00Z'),
      },
      {
        goalId: goal.id,
        periodStart: '2026-10-03',
        periodEnd: '2026-10-03',
        status: 'MISSED',
      },
    ]);

    await request(app).post(`/api/goals/${goal.id}/occurrences/complete`).set(...auth(token));

    const ontem = await GoalOccurrence.findOne({
      where: { goalId: goal.id, periodStart: '2026-10-02' },
    });
    const anteontem = await GoalOccurrence.findOne({
      where: { goalId: goal.id, periodStart: '2026-10-03' },
    });

    expect(ontem?.status).toBe('COMPLETED');
    expect(ontem?.completedAt).toBeInstanceOf(Date);
    expect(anteontem?.status).toBe('MISSED');
    expect(anteontem?.completedAt).toBeNull();
  });

  it('regra 4: uma meta diária tem no máximo uma ocorrência por dia', async () => {
    const { token } = await createUser('daily@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    await request(app).post(`/api/goals/${goal.id}/occurrences/complete`).set(...auth(token));

    const rows = await GoalOccurrence.findAll({ where: { goalId: goal.id } });
    const chaves = rows.map((row) => row.periodStart);

    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toEqual(['2026-10-04']);
  });

  it('regra 5: meta semanal usa a semana ISO como período', async () => {
    const { token } = await createUser('weekly@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Semanal', frequency: 'WEEKLY' })
    ).body.goal;

    const response = await request(app)
      .post(`/api/goals/${goal.id}/occurrences/complete`)
      .set(...auth(token));

    // 04/10/2026 é domingo; a semana começou em 28/09.
    expect(response.body.occurrence.periodStart).toBe('2026-09-28');
    expect(response.body.occurrence.periodEnd).toBe('2026-10-04');
  });

  it('regra 6: meta mensal cobre o mês inteiro', async () => {
    const { token } = await createUser('monthly@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Mensal', frequency: 'MONTHLY' })
    ).body.goal;

    const response = await request(app)
      .post(`/api/goals/${goal.id}/occurrences/complete`)
      .set(...auth(token));

    expect(response.body.occurrence.periodStart).toBe('2026-10-01');
    expect(response.body.occurrence.periodEnd).toBe('2026-10-31');
  });

  it('regra 7: o período usa o fuso do usuário, não o do servidor', async () => {
    const toquio = await createUser('toquio@test.dev');
    await User.update({ timezone: 'Asia/Tokyo' }, { where: { id: toquio.id } });

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(toquio.token))
        .send({ name: 'Horária', frequency: 'DAILY' })
    ).body.goal;

    await request(app).post(`/api/goals/${goal.id}/occurrences/complete`).set(...auth(toquio.token));

    const row = await GoalOccurrence.findOne({ where: { goalId: goal.id } });
    const hojeEmToquio = formatCivilDate(toCivilDate(NOW, 'Asia/Tokyo'));
    const hojeEmSaoPaulo = formatCivilDate(toCivilDate(NOW, TIME_ZONE));

    expect(row?.periodStart).toBe(hojeEmToquio);
    // Este é justamente o caso em que os dois fusos discordam.
    expect(hojeEmToquio).not.toBe(hojeEmSaoPaulo);
  });

  it('recusa concluir meta inativa', async () => {
    const { token } = await createUser('inativa@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Pausada', frequency: 'DAILY' })
    ).body.goal;

    await request(app).patch(`/api/goals/${goal.id}`).set(...auth(token)).send({ isActive: false });

    const response = await request(app)
      .post(`/api/goals/${goal.id}/occurrences/complete`)
      .set(...auth(token));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('GOAL_INACTIVE');
  });
});

describe('integridade no banco', () => {
  it('a constraint unique impede duas ocorrências do mesmo período', async () => {
    const { token } = await createUser('uniq@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-04',
      periodEnd: '2026-10-04',
      status: 'PENDING',
    });

    // A constraint do banco é a garantia final, independente da aplicação.
    await expect(
      GoalOccurrence.create({
        goalId: goal.id,
        periodStart: '2026-10-04',
        periodEnd: '2026-10-04',
        status: 'PENDING',
      }),
    ).rejects.toThrow();
  });

  it('a modelagem impede completedAt sem status COMPLETED', async () => {
    const { token } = await createUser('valid@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    await expect(
      GoalOccurrence.create({
        goalId: goal.id,
        periodStart: '2026-10-04',
        periodEnd: '2026-10-04',
        status: 'PENDING',
        completedAt: new Date(),
      }),
    ).rejects.toThrow(/completedAt/);
  });

  it('regra 12: um :id inválido responde 400, nunca 500 (o id do cliente não é confiável)', async () => {
    const { token } = await createUser('id@test.dev');

    // Sem `validateParams`, `Number('abc')` virava NaN, o Sequelize gerava
    // `WHERE id = NaN` e o Postgres respondia `column "nan" does not exist` —
    // um 500 opaco que mascarava um erro do cliente.
    for (const invalido of ['abc', '0', '-1', '1.5']) {
      const response = await request(app).get(`/api/goals/${invalido}`).set(...auth(token));

      expect(response.status, `GET /api/goals/${invalido}`).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    // O mesmo vale para as demais rotas com :id.
    for (const [method, caminho] of [
      ['patch', `/api/goals/abc`],
      ['delete', `/api/goals/abc`],
      ['get', `/api/goals/abc/stats`],
      ['get', `/api/goals/abc/occurrences`],
      ['post', `/api/goals/abc/occurrences/complete`],
    ] as const) {
      const response = await request(app)[method](caminho)
        .set(...auth(token))
        .send({});

      expect(response.status, `${method.toUpperCase()} ${caminho}`).toBe(400);
    }
  });

  it('regra 7: excluir meta finaliza pendências usando o dia do usuário, não o do servidor', async () => {
    // 2026-10-05T01:30Z é 2026-10-04 às 22:30 em São Paulo. Um dia UTC "errado"
    // marcaria como MISSED o período de 04/10, que ainda está em aberto para o
    // usuário. Uma versão anterior usava `toISOString().slice(0, 10)` e errava.
    const { token, id: userId } = await createUser('tz-delete@test.dev');

    await User.update({ timezone: 'America/Sao_Paulo' }, { where: { id: userId } });

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    const agora = new Date('2026-10-05T01:30:00Z');

    // 03/10 ficou pendente e já passou: deve virar MISSED.
    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-03',
      periodEnd: '2026-10-03',
      status: 'PENDING',
      completedAt: null,
    });

    // 04/10 é o período ATUAL do usuário: deve continuar PENDING.
    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-04',
      periodEnd: '2026-10-04',
      status: 'PENDING',
      completedAt: null,
    });

    // O controller usa `new Date()` internamente, então para exercitar a regra
    // do fuso chamamos o service diretamente com o instante controlado.
    await sequelize.transaction(async (transaction) => {
      const { finalizePastOccurrences } = await import('../../src/services/occurrence.service.js');

      await finalizePastOccurrences(
        { goalId: goal.id, frequency: 'DAILY', timeZone: 'America/Sao_Paulo', now: agora },
        transaction,
      );
    });

    const ocorrencias = await GoalOccurrence.findAll({
      where: { goalId: goal.id },
      order: [['periodStart', 'ASC']],
    });

    expect(ocorrencias[0]?.status, '03/10 já passou: MISSED').toBe('MISSED');
    expect(ocorrencias[1]?.status, '04/10 ainda está em aberto para o usuário').toBe('PENDING');
  });

  it('regra 8: excluir meta preserva o histórico das ocorrências', async () => {
    const { token } = await createUser('soft@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-01',
      status: 'COMPLETED',
      completedAt: new Date('2026-10-01T18:00:00Z'),
    });

    await request(app).delete(`/api/goals/${goal.id}`).set(...auth(token));

    // A meta some da listagem...
    const lista = await request(app).get('/api/goals').set(...auth(token));
    expect(lista.body.goals).toHaveLength(0);

    // ...mas o registro da meta continua no banco (soft delete)...
    const metaNoBanco = await Goal.findByPk(goal.id, { paranoid: false });
    expect(metaNoBanco).not.toBeNull();
    expect(metaNoBanco?.deletedAt).toBeInstanceOf(Date);

    // ...e o histórico continua intacto.
    const ocorrencias = await GoalOccurrence.findAll({ where: { goalId: goal.id } });
    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0]?.status).toBe('COMPLETED');
  });
});

describe('histórico e estatísticas', () => {
  it('preenche lacunas: dias sem registro viram MISSED e o dia atual vira PENDING', async () => {
    const { token } = await createUser('hist2@test.dev');

    // Meta nascida em 01/10: o histórico não pode ir antes disso.
    const goal = await createGoal(token, 'Diária', 'DAILY', new Date('2026-10-01T09:00:00-03:00'));

    // Só o dia 02 foi concluído. 01 e 03 não existem no banco.
    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-02',
      periodEnd: '2026-10-02',
      status: 'COMPLETED',
      completedAt: new Date('2026-10-02T20:00:00Z'),
    });

    const response = await request(app)
      .get(`/api/goals/${goal.id}/occurrences?from=2026-10-01&to=2026-10-04`)
      .set(...auth(token));

    expect(response.status).toBe(200);

    const porDia = new Map(
      response.body.occurrences.map((o: { periodStart: string; status: string }) => [
        o.periodStart,
        o.status,
      ]),
    );

    expect(porDia.get('2026-10-01')).toBe('MISSED'); // gerado, não persistido
    expect(porDia.get('2026-10-02')).toBe('COMPLETED'); // persistido
    expect(porDia.get('2026-10-03')).toBe('MISSED'); // gerado
    expect(porDia.get('2026-10-04')).toBe('PENDING'); // período atual
  });

  it('marca período PENDING antigo como MISSED sem perder a linha', async () => {
    const { token } = await createUser('finalize@test.dev');

    const goal = await createGoal(token, 'Diária', 'DAILY', new Date('2026-10-03T09:00:00-03:00'));

    // Simula app aberto ontem, que criou a linha e não concluiu.
    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: '2026-10-03',
      periodEnd: '2026-10-03',
      status: 'PENDING',
    });

    const response = await request(app).get(`/api/goals/${goal.id}/stats`).set(...auth(token));

    expect(response.status).toBe(200);
    expect(response.body.stats.currentPeriod.status).toBe('PENDING');
    expect(response.body.stats.missedCount).toBe(1);

    const linha = await GoalOccurrence.findOne({ where: { goalId: goal.id, periodStart: '2026-10-03' } });
    // `buildHistory` devolve MISSED sem precisar escrever no banco.
    expect(linha?.status).toBe('PENDING');
  });

  it('calcula streak atual e melhor streak a partir da série contínua', async () => {
    const { token } = await createUser('streak@test.dev');

    const goal = await createGoal(token, 'Diária', 'DAILY', new Date('2026-10-01T09:00:00-03:00'));

    // 01 e 02 ok, 03 perdida, 04 ok.
    await GoalOccurrence.bulkCreate([
      {
        goalId: goal.id,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-01',
        status: 'COMPLETED',
        completedAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        goalId: goal.id,
        periodStart: '2026-10-02',
        periodEnd: '2026-10-02',
        status: 'COMPLETED',
        completedAt: new Date('2026-10-02T12:00:00Z'),
      },
      { goalId: goal.id, periodStart: '2026-10-03', periodEnd: '2026-10-03', status: 'MISSED' },
    ]);

    await request(app).post(`/api/goals/${goal.id}/occurrences/complete`).set(...auth(token));

    const response = await request(app).get(`/api/goals/${goal.id}/stats`).set(...auth(token));

    expect(response.body.stats.currentStreak).toBe(1);
    expect(response.body.stats.bestStreak).toBe(2);
    expect(response.body.stats.completedCount).toBe(3);
    expect(response.body.stats.missedCount).toBe(1);
    expect(response.body.stats.hasData).toBe(true);
  });

  it('não inventa estatísticas quando a meta é nova demais', async () => {
    const { token } = await createUser('novo@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    const response = await request(app).get(`/api/goals/${goal.id}/stats`).set(...auth(token));

    expect(response.status).toBe(200);
    expect(response.body.stats.currentPeriod.status).toBe('PENDING');
    expect(response.body.stats.hasData).toBe(false);
    expect(response.body.stats.completionRate).toBe(0);
  });

  it('rejeita intervalo invertido', async () => {
    const { token } = await createUser('invertido@test.dev');

    const goal = (
      await request(app)
        .post('/api/goals')
        .set(...auth(token))
        .send({ name: 'Diária', frequency: 'DAILY' })
    ).body.goal;

    const response = await request(app)
      .get(`/api/goals/${goal.id}/occurrences?from=2026-10-04&to=2026-10-01`)
      .set(...auth(token));

    expect(response.status).toBe(400);
  });
});

describe('dashboard', () => {
  it('resume o período atual de todas as metas ativas', async () => {
    const { token } = await createUser('dash@test.dev');

    const [diaria, semanal, pausada] = (
      await Promise.all([
        request(app).post('/api/goals').set(...auth(token)).send({ name: 'Diária', frequency: 'DAILY' }),
        request(app).post('/api/goals').set(...auth(token)).send({ name: 'Semanal', frequency: 'WEEKLY' }),
        request(app).post('/api/goals').set(...auth(token)).send({ name: 'Pausada', frequency: 'MONTHLY' }),
      ])
    ).map((r) => r.body.goal);

    await request(app)
      .patch(`/api/goals/${pausada.id}`)
      .set(...auth(token))
      .send({ isActive: false });

    await request(app).post(`/api/goals/${diaria.id}/occurrences/complete`).set(...auth(token));

    const response = await request(app).get('/api/dashboard').set(...auth(token));

    expect(response.status).toBe(200);
    // A meta inativa não entra no dashboard.
    expect(response.body.totals.activeGoals).toBe(2);
    expect(response.body.totals.completed).toBe(1);
    expect(response.body.totals.pending).toBe(1);

    // A taxa é a MESMA definição de `stats.completionRate`: concluídas /
    // (concluídas + perdidas) sobre a janela de 30 períodos.
    //
    // Aqui só existe UM período fechado em todo o dashboard — o da meta diária,
    // concluído. A semanal está PENDING, e período em aberto não conta nem como
    // sucesso nem como fracasso. Logo 1/1 = 100%.
    //
    // Não é 1/2 = 50%: essa era a fórmula antiga (`completed / activeGoals`),
    // que misturava duas medidas no mesmo rótulo "Taxa" — o usuário comparava
    // "100%" com "Concluídas 1 de 2" e não entendia o número. Este teste é a
    // trava contra a volta dessa fórmula: sob ela o valor seria 0.5.
    expect(response.body.totals.completionRate).toBe(1);
    expect(response.body.totals.hasData).toBe(true);
    expect(response.body.timeZone).toBe(TIME_ZONE);

    const diariaNoDashboard = response.body.goals.find(
      (g: { goalId: number }) => g.goalId === diaria.id,
    );
    expect(diariaNoDashboard.status).toBe('COMPLETED');
    expect(diariaNoDashboard.currentPeriodStart).toBe('2026-10-04');

    expect(response.body.goals).toHaveLength(2);
    expect(semanal).toBeDefined();
  });

  it('taxa do dashboard conta períodos perdidos, não metas ativas', async () => {
    const { id: userId, token } = await createUser('dash-taxa@test.dev');
    const goal = await createGoal(token, 'Diária', 'DAILY', new Date('2026-10-01T09:00:00-03:00'));

    // 01 e 03 concluídas; 02 fica sem linha e é gerada como MISSED. O período
    // corrente (04) fica em aberto de propósito.
    await GoalOccurrence.bulkCreate([
      {
        goalId: goal.id,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-01',
        status: 'COMPLETED',
        completedAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        goalId: goal.id,
        periodStart: '2026-10-03',
        periodEnd: '2026-10-03',
        status: 'COMPLETED',
        completedAt: new Date('2026-10-03T12:00:00Z'),
      },
    ]);

    // `now` explícito de propósito: pelo HTTP o controller usa `new Date()`, e
    // esse teste passaria a depender do dia em que roda. Aqui a janela é fixa.
    const summary = await buildDashboard(userId, TIME_ZONE, NOW);

    // Medida 1 — metas no período corrente. 04 está PENDING, então conta como
    // pendente, não como concluída.
    expect(summary.totals.activeGoals).toBe(1);
    expect(summary.totals.completed).toBe(0);
    expect(summary.totals.pending).toBe(1);

    // Medida 2 — períodos fechados na janela: 2 concluídas / (2 + 1 perdida).
    //
    // Este é o teste que trava a DEFINIÇÃO. A fórmula antiga
    // (`completed / activeGoals`) daria 0/1 = 0, e o número viraria 100% assim
    // que alguém concluísse o dia corrente. As duas medidas convivem no mesmo
    // objeto de propósito, mas respondem perguntas diferentes.
    expect(summary.totals.completionRate).toBeCloseTo(2 / 3, 4);
    expect(summary.totals.hasData).toBe(true);

    // Os contadores vêm dos `StreakResult`s que `readGoalSnapshot` já calculava
    // e o dashboard descartava. Sem eles não haveria como somar a taxa.
    expect(summary.goals[0]?.completedCount).toBe(2);
    expect(summary.goals[0]?.missedCount).toBe(1);
  });

  it('dashboard vazio não quebra e não inventa números', async () => {
    const { token } = await createUser('dashvazio@test.dev');

    const response = await request(app).get('/api/dashboard').set(...auth(token));

    expect(response.status).toBe(200);
    expect(response.body.totals.activeGoals).toBe(0);
    expect(response.body.totals.completionRate).toBe(0);
    expect(response.body.totals.hasData).toBe(false);
  });
});

describe('autenticação', () => {
  it('registra, faz login e devolve o perfil sem hash de senha', async () => {
    const registro = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'novo@test.dev',
        password: 'senha-forte-123',
        name: 'Novo Usuário',
        timezone: TIME_ZONE,
      });

    expect(registro.status).toBe(201);
    expect(registro.body.token).toEqual(expect.any(String));
    expect(registro.body.user.email).toBe('novo@test.dev');
    // Segurança: o hash jamais aparece na resposta.
    expect(JSON.stringify(registro.body)).not.toContain('passwordHash');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'novo@test.dev', password: 'senha-forte-123' });

    expect(login.status).toBe(200);

    const perfil = await request(app).get('/api/auth/me').set(...auth(login.body.token));
    expect(perfil.status).toBe(200);
    expect(perfil.body.user.email).toBe('novo@test.dev');
    expect(perfil.body.user.passwordHash).toBeUndefined();
  });

  it('recusa e-mail duplicado com 409', async () => {
    const dados = { email: 'dup@test.dev', password: 'senha-forte-123' };

    await request(app).post('/api/auth/register').send(dados);
    const segunda = await request(app).post('/api/auth/register').send(dados);

    expect(segunda.status).toBe(409);
  });

  it('dá a mesma resposta para e-mail inexistente e senha errada', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'existe@test.dev', password: 'senha-forte-123' });

    const inexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-existe@test.dev', password: 'qualquer-coisa' });

    const senhaErrada = await request(app)
      .post('/api/auth/login')
      .send({ email: 'existe@test.dev', password: 'senha-errada-999' });

    expect(inexistente.status).toBe(401);
    expect(senhaErrada.status).toBe(401);
    // Mensagem idêntica: não revela quais e-mails estão cadastrados.
    expect(inexistente.body.error.code).toBe(senhaErrada.body.error.code);
    expect(inexistente.body.error.message).toBe(senhaErrada.body.error.message);
  });

  it('recusa senha curta', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'curta@test.dev', password: '123' });

    expect(response.status).toBe(400);
  });

  it('atualiza o fuso horário do usuário', async () => {
    const { token } = await createUser('tz@test.dev');

    const response = await request(app)
      .patch('/api/auth/me')
      .set(...auth(token))
      .send({ timezone: 'Asia/Tokyo' });

    expect(response.status).toBe(200);
    expect(response.body.user.timezone).toBe('Asia/Tokyo');
  });

  it('recusa fuso horário inválido', async () => {
    const { token } = await createUser('tzruim@test.dev');

    const response = await request(app)
      .patch('/api/auth/me')
      .set(...auth(token))
      .send({ timezone: 'Mars/Phobos' });

    expect(response.status).toBe(400);
  });
});

describe('tratamento de erros', () => {
  it('rota inexistente responde 404 em JSON padronizado', async () => {
    const response = await request(app).get('/api/nao-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('JSON malformado não derruba o servidor', async () => {
    const { token } = await createUser('json@test.dev');

    const response = await request(app)
      .post('/api/goals')
      .set(...auth(token))
      .set('Content-Type', 'application/json')
      .send('{"name": quebrado}');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('não vaza detalhes de erro interno em produção', async () => {
    const { token } = await createUser('vaza@test.dev');

    // `limit` acima do máximo é barrado pelo schema, não por exception.
    const response = await request(app)
      .get('/api/goals?limit=9999')
      .set(...auth(token));

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain('Sequelize');
  });

  it('health check responde sem autenticação', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('isolamento entre usuários', () => {
  it('cada usuário vê apenas as próprias metas', async () => {
    const [a, b] = await Promise.all([createUser('iso-a@test.dev'), createUser('iso-b@test.dev')]);

    await request(app).post('/api/goals').set(...auth(a.token)).send({ name: 'A1', frequency: 'DAILY' });
    await request(app).post('/api/goals').set(...auth(a.token)).send({ name: 'A2', frequency: 'WEEKLY' });
    await request(app).post('/api/goals').set(...auth(b.token)).send({ name: 'B1', frequency: 'DAILY' });

    const listaA = await request(app).get('/api/goals').set(...auth(a.token));
    const listaB = await request(app).get('/api/goals').set(...auth(b.token));

    expect(listaA.body.goals).toHaveLength(2);
    expect(listaB.body.goals).toHaveLength(1);
    expect(listaB.body.goals[0].name).toBe('B1');
  });

  it('paginação funciona e não vaza metas de outro usuário', async () => {
    const a = await createUser('page-a@test.dev');
    await createUser('page-b@test.dev');

    for (const name of ['G1', 'G2', 'G3']) {
      await request(app).post('/api/goals').set(...auth(a.token)).send({ name, frequency: 'DAILY' });
    }

    const primeira = await request(app).get('/api/goals?page=1&limit=2').set(...auth(a.token));

    expect(primeira.body.goals).toHaveLength(2);
    expect(primeira.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const segunda = await request(app).get('/api/goals?page=2&limit=2').set(...auth(a.token));
    expect(segunda.body.goals).toHaveLength(1);
  });
});

describe('âncora no createdAt da meta', () => {
  it('não gera períodos anteriores à criação da meta', async () => {
    const { token } = await createUser('ancora@test.dev');

    // Meta criada em 02/10; a janela padrão pediria 30 dias para trás.
    const goal = await createGoal(token, 'Diária', 'DAILY', new Date('2026-10-02T14:00:00-03:00'));

    const response = await request(app)
      .get(`/api/goals/${goal.id}/occurrences?from=2026-09-01&to=2026-10-04`)
      .set(...auth(token));

    expect(response.status).toBe(200);

    const datas = response.body.occurrences.map((o: { periodStart: string }) => o.periodStart);
    expect(datas).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    // Nada antes de 02/10: a meta simplesmente não existia.
    expect(datas).not.toContain('2026-09-30');
    expect(datas).not.toContain('2026-10-01');
  });

  it('uma meta recém-criada não nasce com 29 dias perdidos', async () => {
    const { token } = await createUser('nova-r@test.dev');
    const goal = await createGoal(token, 'Diária', 'DAILY');

    const response = await request(app).get(`/api/goals/${goal.id}/stats`).set(...auth(token));

    // Só existe o período de hoje, que está em aberto.
    expect(response.body.stats.hasData).toBe(false);
    expect(response.body.stats.missedCount).toBe(0);
    expect(response.body.stats.currentStreak).toBe(0);
    expect(response.body.stats.window.periodsCounted).toBe(1);
  });

  it('semana incompleta na criação não vira semana perdida', async () => {
    const { token } = await createUser('semana@test.dev');

    // Quinta-feira: a semana ISO começou na segunda, mas a meta só nasceu quinta.
    const goal = await createGoal(
      token,
      'Semanal',
      'WEEKLY',
      new Date('2026-10-01T10:00:00-03:00'),
    );

    const response = await request(app).get(`/api/goals/${goal.id}/stats`).set(...auth(token));

    expect(response.body.stats.missedCount).toBe(0);
    expect(response.body.stats.currentPeriod.periodStart).toBe('2026-09-28');
  });
});

describe('helper de teste', () => {
  it('enumeratePeriods produz a série esperada para o NOW controlado', () => {
    const periods = enumeratePeriods(
      'DAILY',
      { year: 2026, month: 10, day: 1 },
      toCivilDate(NOW, TIME_ZONE),
    );

    expect(periods.map(periodKey)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(periodKey(resolvePeriodForInstant('MONTHLY', NOW, TIME_ZONE))).toBe('2026-10-01');
  });
});