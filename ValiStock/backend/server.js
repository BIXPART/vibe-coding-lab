const app = require('./app');
const { sequelize } = require('./config/database');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    // Testa a conexão com o banco antes de subir o servidor
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Falha ao iniciar o servidor:', error.message);
    process.exit(1);
  }
};

// Encerramento gracioso (importante para Render)
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recebido. Encerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

start();
