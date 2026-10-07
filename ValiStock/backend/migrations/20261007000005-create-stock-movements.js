'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_movements', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      lot_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'lots',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('stock_movements', ['product_id'], {
      name: 'stock_movements_product_id_index',
    });
    await queryInterface.addIndex('stock_movements', ['lot_id'], {
      name: 'stock_movements_lot_id_index',
    });
    await queryInterface.addIndex('stock_movements', ['user_id'], {
      name: 'stock_movements_user_id_index',
    });
    await queryInterface.addIndex('stock_movements', ['type'], {
      name: 'stock_movements_type_index',
    });
    await queryInterface.addIndex('stock_movements', ['created_at'], {
      name: 'stock_movements_created_at_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_movements');
  },
};
