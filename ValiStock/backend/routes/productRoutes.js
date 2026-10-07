const express = require('express');
const router = express.Router();
const multer = require('multer');

const productController = require('../controllers/productController');
const importController = require('../controllers/importController');
const lotController = require('../controllers/lotController');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Upload de CSV em memória (sem salvar em disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv',
      'text/plain',
      'application/octet-stream',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'));
    }
  },
});

// Todas as rotas exigem autenticação
router.use(authenticate);

router.get('/', productController.list);
router.get('/barcode/:barcode', productController.getByBarcode);
router.get('/:id', productController.getById);

// Importação CSV (antes de /:id para evitar conflito de rota)
router.post(
  '/import',
  authorize('ADMIN', 'MANAGER'),
  upload.single('file'),
  importController.importProducts
);

// Rotas aninhadas de lotes: /api/products/:id/lots
router.get('/:id/lots', lotController.listByProduct);
router.post(
  '/:id/lots',
  authorize('ADMIN', 'MANAGER', 'EMPLOYEE'),
  lotController.create
);

router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  productController.create
);

router.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  productController.update
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  productController.remove
);

module.exports = router;
