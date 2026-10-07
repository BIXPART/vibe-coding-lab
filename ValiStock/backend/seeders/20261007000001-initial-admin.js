'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@valistock.com' LIMIT 1"
    );

    if (rows.length > 0) {
      console.log('Seeder: admin já existe, ignorando.');
      return;
    }

    // Usuário administrador inicial (trocar a senha em produção)
    const passwordHash = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert('users', [
      {
        name: 'Administrador',
        email: 'admin@valistock.com',
        password_hash: passwordHash,
        role: 'ADMIN',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: 'admin@valistock.com',
    });
  },
};
