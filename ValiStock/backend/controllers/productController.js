const productService = require('../services/productService');

const list = async (req, res, next) => {
  try {
    const { search, filter } = req.query;
    const products = await productService.list({ search, filter });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

const getByBarcode = async (req, res, next) => {
  try {
    const product = await productService.getByBarcode(req.params.barcode);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não cadastrado',
        data: { barcode: req.params.barcode, found: false },
      });
    }

    res.status(200).json({ success: true, data: { ...product, found: true } });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const product = await productService.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const product = await productService.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await productService.remove(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Produto removido com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, getByBarcode, getById, create, update, remove };
