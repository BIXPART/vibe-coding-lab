/**
 * Modelos Sequelize.
 *
 * Onde as regras de negócio NÃO moram: os modelos cuidam de estrutura,
 * tipos e integridade referencial. A lógica de recorrência fica em
 * `services/` e o cálculo de período em `utils/period.ts`.
 *
 * Observação sobre segurança: `passwordHash` fica fora do `defaultScope` e é
 * removido no `toJSON`, então um descuido de serialização não vaza hash de
 * senha em resposta de API. (AI_NOTES.md §9)
 */
import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';

import { sequelize } from '../config/database.js';
import { FREQUENCIES, type Frequency } from '../utils/period.js';

export const OCCURRENCE_STATUSES = ['PENDING', 'COMPLETED', 'MISSED'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export type { Frequency } from '../utils/period.js';

/* -------------------------------------------------------------------------- */
/* User                                                                       */
/* -------------------------------------------------------------------------- */

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare name: string | null;
  /** Fuso IANA do usuário. Regra 7 depende deste valor. */
  declare timezone: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /** Relação declarada apenas para tipagem. */
  declare goals?: NonAttribute<Goal[]>;

  override toJSON(): Record<string, unknown> {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values['passwordHash'];
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'UTC',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    // Nunca selectable por padrão: previne vazamento acidental do hash.
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
    scopes: {
      // Uso explícito e restrito ao fluxo de login.
      withPassword: { attributes: { include: ['passwordHash'] } },
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Goal                                                                       */
/* -------------------------------------------------------------------------- */

export class Goal extends Model<InferAttributes<Goal>, InferCreationAttributes<Goal>> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  declare name: string;
  declare description: string | null;
  declare frequency: Frequency;
  declare isActive: CreationOptional<boolean>;
  /** Soft delete. Regra 8: excluir meta NÃO apaga o histórico. */
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare occurrences?: NonAttribute<GoalOccurrence[]>;

  override toJSON(): Record<string, unknown> {
    return { ...this.get() };
  }
}

Goal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 120],
      },
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    frequency: {
      type: DataTypes.ENUM(...FREQUENCIES),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    deletedAt: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Goal',
    tableName: 'goals',
    underscored: true,
    // Soft delete: `deletedAt` preenchido => invisível nas queries padrão.
    paranoid: true,
    indexes: [{ fields: ['user_id', 'deleted_at'] }],
  },
);

/* -------------------------------------------------------------------------- */
/* GoalOccurrence                                                             */
/* -------------------------------------------------------------------------- */

export class GoalOccurrence extends Model<
  InferAttributes<GoalOccurrence>,
  InferCreationAttributes<GoalOccurrence>
> {
  declare id: CreationOptional<number>;
  declare goalId: ForeignKey<Goal['id']>;
  /** Primeiro dia do período. Coluna DATEONLY: é data civil, não instante. */
  declare periodStart: string;
  /** Último dia do período (inclusivo). */
  declare periodEnd: string;
  declare status: CreationOptional<OccurrenceStatus>;
  /** Preenchido só quando status = COMPLETED. */
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare goal?: NonAttribute<Goal>;

  override toJSON(): Record<string, unknown> {
    return { ...this.get() };
  }
}

GoalOccurrence.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    goalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'goals', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    periodStart: {
      // civil date -> 'YYYY-MM-DD'. Evita ambiguidade de fuso no banco.
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...OCCURRENCE_STATUSES),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'GoalOccurrence',
    tableName: 'goal_occurrences',
    underscored: true,
    indexes: [
      // INTEGRIDADE NO BANCO: uma ocorrência por meta por período.
      // Esta constraint é a garantia real da regra 1 (sem conclusão duplicada),
      // independentemente de concorrência ou de bug na aplicação.
      {
        name: 'goal_occurrences_goal_period_unique',
        unique: true,
        fields: ['goal_id', 'period_start'],
      },
      { name: 'goal_occurrences_goal_period_idx', fields: ['goal_id', 'period_start'] },
      { fields: ['status'] },
    ],
    validate: {
      // completedAt só existe se o status for COMPLETED.
      completedAtConsistent(this: GoalOccurrence) {
        if (this.status === 'COMPLETED' && !this.completedAt) {
          throw new Error('Ocorrência concluída precisa de completedAt.');
        }
        if (this.status !== 'COMPLETED' && this.completedAt) {
          throw new Error('completedAt só é permitido em ocorrências concluídas.');
        }
      },
    },
  },
);