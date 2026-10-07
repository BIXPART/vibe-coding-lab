require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { sequelize } = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logs simples de requisição em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check (obrigatório para Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rotas da API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/lots', require('./routes/lotRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Rota 404 para endpoints não encontrados
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
  });
});

// Middleware global de erros (sempre por último)
app.use(errorHandler);

module.exports = app;
