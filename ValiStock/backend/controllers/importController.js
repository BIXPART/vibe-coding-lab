const importService = require('../services/importService');

/**
 * POST /api/products/import
 * Aceita:
 * - multipart/form-data com campo "file" (CSV)
 * - ou JSON com { "content": "codigo_barras,nome,..." }
 */
const importProducts = async (req, res, next) => {
  try {
    let content;

    if (req.file) {
      content = req.file.buffer ? req.file.buffer.toString('utf8') : null;
    } else if (req.body && req.body.content) {
      content = req.body.content;
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Envie um arquivo CSV (campo "file") ou o conteúdo no campo "content"',
      });
    }

    const result = await importService.importFromCSV(content);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { importProducts };
