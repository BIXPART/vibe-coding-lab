const express = require('express');
const router = express.Router();

const lotController = require('../controllers/lotController');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(authenticate);

router.get('/:id', lotController.getById);
router.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  lotController.update
);
router.delete(
  '/:id',
  authorize('ADMIN'),
  lotController.remove
);

module.exports = router;
