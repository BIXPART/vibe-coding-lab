const express = require('express');
const router = express.Router();

const stockController = require('../controllers/stockController');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(authenticate);

router.get('/', stockController.getStock);
router.get('/expiring', stockController.getExpiring);
router.get('/expired', stockController.getExpired);

router.post(
  '/movements',
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  stockController.createMovement
);
router.get('/movements', stockController.listMovements);

module.exports = router;
