const categoryService = require('../services/categoryService');

const list = async (req, res, next) => {
  try {
    const categories = await categoryService.list();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const category = await categoryService.create(req.body.name);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const category = await categoryService.update(req.params.id, req.body.name);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await categoryService.remove(req.params.id);
    res.status(200).json({ success: true, message: 'Categoria removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
