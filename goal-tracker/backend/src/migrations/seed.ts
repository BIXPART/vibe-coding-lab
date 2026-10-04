/**
 * Script de seed para desenvolvimento.
 *
 * Cria um usuário de exemplo com uma meta diária, uma semanal e uma mensal,
 * incluindo histórico na meta diária para que o dashboard tenha o que exibir.
 *
 * Uso: npm run db:seed
 * NÃO use em produção.
 */
import { syncDatabase } from './sync.js';
import { sequelize } from '../config/database.js';
import { Goal, GoalOccurrence, User } from '../models/index.js';
import { addDays, formatCivilDate, toCivilDate } from '../utils/civil-date.js';
import { enumeratePeriods, periodKey } from '../utils/period.js';
import { hashPassword } from '../utils/password.js';

const TIME_ZONE = 'America/Sao_Paulo';
const EMAIL = 'demo@goaltracker.dev';
const PASSWORD = 'demo1234';

/** Últimos 6 dias + o dia atual. O dia atual sempre nasce PENDING. */
const PAST_PATTERN: Array<'COMPLETED' | 'MISSED'> = [
  'COMPLETED',
  'COMPLETED',
  'MISSED',
  'COMPLETED',
  'COMPLETED',
  'COMPLETED',
];

async function seed(): Promise<void> {
  await syncDatabase();

  const existing = await User.findOne({ where: { email: EMAIL } });

  if (existing) {
    console.log(`Usuário ${EMAIL} já existe. Nada a fazer.`);
    await sequelize.close();
    return;
  }

  const user = await User.create({
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    name: 'Usuário Demo',
    timezone: TIME_ZONE,
  });

  const now = new Date();
  const today = toCivilDate(now, TIME_ZONE);

  // `createdAt` da meta diária é retrocedido para 6 dias atrás.
  //
  // Isso não é cosmético: o histórico só é gerado a partir do período em que a
  // meta nasceu (ancoragem em `createdAt`). Sem recuar essa data, uma meta
  // criada hoje mostraria "1 período, PENDING" e o histórico de exemplo
  // ficaria invisível. A data precisa ser coerente com a história que
  // estamos contando.
  const dailyCreatedAt = new Date(now.getTime() - (PAST_PATTERN.length - 1) * 86_400_000);

  const [dailyGoal, weeklyGoal, monthlyGoal] = await Goal.bulkCreate(
    [
      {
        userId: user.id,
        name: 'Estudar programação',
        description: 'Praticar por pelo menos 30 minutos.',
        frequency: 'DAILY',
      },
      {
        userId: user.id,
        name: 'Revisar anotações da semana',
        description: null,
        frequency: 'WEEKLY',
      },
      {
        userId: user.id,
        name: 'Fechar relatório mensal',
        description: null,
        frequency: 'MONTHLY',
      },
    ],
    { validate: true },
  );

  await Goal.update(
    { createdAt: dailyCreatedAt, updatedAt: dailyCreatedAt },
    { where: { id: dailyGoal!.id } },
  );

  // Histórico diário: dos 6 dias atrás até hoje (inclusive).
  const dailyPeriods = enumeratePeriods('DAILY', addDays(today, -(PAST_PATTERN.length - 1)), today);

  for (const [index, period] of dailyPeriods.entries()) {
    const isToday = index === dailyPeriods.length - 1;
    const status = isToday ? 'PENDING' : (PAST_PATTERN[index] ?? 'MISSED');

    // completedAt no passado: quanto mais antigo o período, mais antigo o registro.
    const daysAgo = dailyPeriods.length - 1 - index;

    await GoalOccurrence.create({
      goalId: dailyGoal!.id,
      periodStart: periodKey(period),
      periodEnd: formatCivilDate(period.end),
      status,
      completedAt: status === 'COMPLETED' ? new Date(now.getTime() - daysAgo * 86_400_000) : null,
    });
  }

  // Semana e mês correntes já concluídos, para o dashboard mostrar os 3 estados.
  const currentWeek = enumeratePeriods('WEEKLY', today, today)[0];
  const currentMonth = enumeratePeriods('MONTHLY', today, today)[0];

  if (!currentWeek || !currentMonth) {
    throw new Error('Não foi possível resolver a semana/mês corrente no seed.');
  }

  for (const [goal, period] of [
    [weeklyGoal!, currentWeek],
    [monthlyGoal!, currentMonth],
  ] as const) {
    await GoalOccurrence.create({
      goalId: goal.id,
      periodStart: periodKey(period),
      periodEnd: formatCivilDate(period.end),
      status: 'COMPLETED',
      completedAt: now,
    });
  }

  console.log('Seed concluído.');
  console.log(`  e-mail:  ${EMAIL}`);
  console.log(`  senha:   ${PASSWORD}`);
  console.log(`  fuso:    ${TIME_ZONE}`);
  console.log(`  hoje:    ${formatCivilDate(today)}`);
  console.log(`  histórico diário criado: ${dailyPeriods.length} períodos`);

  await sequelize.close();
}

seed().catch((error: unknown) => {
  console.error('Falha no seed:');
  console.error(error);
  process.exit(1);
});