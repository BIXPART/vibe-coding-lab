'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lots', {
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
      lot_code: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      manufactured_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('lots', ['product_id'], {
      name: 'lots_product_id_index',
    });
    await queryInterface.addIndex('lots', ['expires_at'], {
      name: 'lots_expires_at_index',
    });
    await queryInterface.addIndex('lots', ['product_id', 'lot_code'], {
      name: 'lots_product_id_lot_code_index',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lots');
  },
};
