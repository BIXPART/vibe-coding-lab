'use strict';

/**
 * Dados de demonstração para desenvolvimento local.
 * Executar: npm run db:seed (apenas após as migrations)
 *
 * ATENÇÃO: em produção, apenas o seeder do admin inicial é necessário.
 */

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Categorias
    await queryInterface.bulkInsert('categories', [
      { name: 'Bebidas', created_at: now, updated_at: now },
      { name: 'Laticínios', created_at: now, updated_at: now },
      { name: 'Frios', created_at: now, updated_at: now },
      { name: 'Padaria', created_at: now, updated_at: now },
    ]);

    // Produtos (sem lotes — os lotes serão cadastrados conforme a mercadoria chega)
    const [[bebas], [latic], [frios]] = await Promise.all([
      queryInterface.sequelize.query("SELECT id FROM categories WHERE name = 'Bebidas' LIMIT 1"),
      queryInterface.sequelize.query("SELECT id FROM categories WHERE name = 'Laticínios' LIMIT 1"),
      queryInterface.sequelize.query("SELECT id FROM categories WHERE name = 'Frios' LIMIT 1"),
    ]);

    await queryInterface.bulkInsert('products', [
      {
        barcode: '7894900011517',
        name: 'Coca-Cola Original 2L',
        brand: 'Coca-Cola',
        category_id: bebas[0].id,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        barcode: '7891000100103',
        name: 'Leite Integral 1L',
        brand: 'Marca X',
        category_id: latic[0].id,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        barcode: '7898800022222',
        name: 'Presunto Fatias 500g',
        brand: 'Marca Z',
        category_id: frios[0].id,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('products', {
      barcode: ['7894900011517', '7891000100103', '7898800022222'],
    });
    await queryInterface.bulkDelete('categories', {
      name: ['Bebidas', 'Laticínios', 'Frios', 'Padaria'],
    });
  },
};
