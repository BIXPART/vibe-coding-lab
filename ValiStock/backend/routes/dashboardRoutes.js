const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middlewares/auth');

router.use(authenticate);

router.get('/', dashboardController.getDashboard);

module.exports = router;
