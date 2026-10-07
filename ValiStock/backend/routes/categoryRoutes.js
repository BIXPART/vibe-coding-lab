const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Todas as rotas exigem autenticação
router.use(authenticate);

router.get('/', categoryController.list);

router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  categoryController.create
);

router.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  categoryController.update
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  categoryController.remove
);

module.exports = router;
