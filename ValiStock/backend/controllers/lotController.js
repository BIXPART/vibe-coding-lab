const lotService = require('../services/lotService');

const listByProduct = async (req, res, next) => {
  try {
    const lots = await lotService.listByProduct(req.params.id);
    res.status(200).json({ success: true, data: lots });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const lot = await lotService.create(
      req.params.id,
      req.body,
      req.user ? req.user.id : null
    );
    res.status(201).json({ success: true, data: lot });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const lot = await lotService.getById(req.params.id);
    res.status(200).json({ success: true, data: lot });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const lot = await lotService.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: lot });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await lotService.remove(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Lote removido com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listByProduct, create, getById, update, remove };
