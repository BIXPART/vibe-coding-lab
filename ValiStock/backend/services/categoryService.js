const { Category, Product } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Lista todas as categorias.
 */
const list = async () => {
  return Category.findAll({
    order: [['name', 'ASC']],
    include: [
      {
        model: Product,
        as: 'products',
        attributes: ['id'],
      },
    ],
  });
};

/**
 * Cria uma categoria.
 */
const create = async (name) => {
  if (!name || !name.trim()) {
    throw new AppError('O nome da categoria é obrigatório', 400);
  }

  const existing = await Category.findOne({
    where: { name: name.trim() },
  });

  if (existing) {
    throw new AppError('Já existe uma categoria com este nome', 409);
  }

  return Category.create({ name: name.trim() });
};

/**
 * Atualiza uma categoria.
 */
const update = async (id, name) => {
  const category = await Category.findByPk(id);
  if (!category) {
    throw new AppError('Categoria não encontrada', 404);
  }

  if (!name || !name.trim()) {
    throw new AppError('O nome da categoria é obrigatório', 400);
  }

  const existing = await Category.findOne({
    where: { name: name.trim() },
  });

  if (existing && existing.id !== Number(id)) {
    throw new AppError('Já existe uma categoria com este nome', 409);
  }

  category.name = name.trim();
  await category.save();
  return category;
};

/**
 * Remove uma categoria.
 * Impede remoção se houver produtos vinculados.
 */
const remove = async (id) => {
  const category = await Category.findByPk(id);
  if (!category) {
    throw new AppError('Categoria não encontrada', 404);
  }

  const productCount = await Product.count({
    where: { category_id: id },
  });

  if (productCount > 0) {
    throw new AppError(
      `Não é possível excluir: existem ${productCount} produto(s) nesta categoria`,
      409
    );
  }

  await category.destroy();
};

module.exports = { list, create, update, remove };
