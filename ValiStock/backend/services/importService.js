const { parse } = require('csv-parse');
const { sequelize, Product, Category } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Importa produtos a partir de CSV.
 *
 * Formato esperado (com cabeçalho):
 * codigo_barras,nome,categoria,marca
 *
 * Reglas:
 * - valida campos obrigatórios
 * - identifica duplicados (no arquivo e no banco)
 * - informa erros por linha
 * - utiliza transação (tudo ou nada para as linhas válidas)
 * - NÃO importa lotes
 */
const importFromCSV = async (fileContent) => {
  if (!fileContent || !fileContent.trim()) {
    throw new AppError('Arquivo CSV vazio', 400);
  }

  // Parse do CSV (async, com cabeçalho)
  const rows = await new Promise((resolve, reject) => {
    parse(
      fileContent,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: ',',
      },
      (err, records) => {
        if (err) {
          reject(new AppError(`Erro ao ler CSV: ${err.message}`, 400));
        } else {
          resolve(records);
        }
      }
    );
  });

  if (rows.length === 0) {
    throw new AppError('O CSV não contém linhas de dados', 400);
  }

  // Valida cabeçalho
  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());
  const requiredHeaders = ['codigo_barras', 'nome'];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

  if (missingHeaders.length > 0) {
    throw new AppError(
      `Colunas obrigatórias ausentes: ${missingHeaders.join(', ')}`,
      400
    );
  }

  const errors = [];
  const validRows = [];
  const seenBarcodes = new Set();

  rows.forEach((row, index) => {
    const lineNum = index + 2; // +2: cabeçalho é a linha 1

    // Normaliza chaves (pode variar em caixa)
    const get = (key) => {
      const found = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === key
      );
      return found ? String(row[found]).trim() : '';
    };

    const barcode = get('codigo_barras');
    const name = get('nome');
    const categoryName = get('categoria');
    const brand = get('marca');

    if (!barcode) {
      errors.push({ line: lineNum, error: 'Código de barras obrigatório' });
      return;
    }

    if (!name) {
      errors.push({ line: lineNum, error: 'Nome obrigatório' });
      return;
    }

    if (seenBarcodes.has(barcode)) {
      errors.push({
        line: lineNum,
        error: `Código de barras duplicado no arquivo: ${barcode}`,
      });
      return;
    }

    seenBarcodes.add(barcode);

    validRows.push({
      line: lineNum,
      barcode,
      name,
      categoryName: categoryName || null,
      brand: brand || null,
    });
  });

  // Verifica duplicados já existentes no banco
  const barcodes = validRows.map((r) => r.barcode);
  const existingProducts = await Product.findAll({
    where: { barcode: barcodes },
    attributes: ['barcode'],
  });
  const existingSet = new Set(existingProducts.map((p) => p.barcode));

  const rowsToImport = [];
  validRows.forEach((row) => {
    if (existingSet.has(row.barcode)) {
      errors.push({
        line: row.line,
        error: `Produto já cadastrado no banco: ${row.barcode}`,
      });
    } else {
      rowsToImport.push(row);
    }
  });

  // Importação em transação
  let imported = 0;

  if (rowsToImport.length > 0) {
    await sequelize.transaction(async (t) => {
      // Cache de categorias existentes
      const categories = await Category.findAll({ transaction: t });
      const categoryMap = new Map(
        categories.map((c) => [c.name.toLowerCase(), c])
      );

      for (const row of rowsToImport) {
        let categoryId = null;

        if (row.categoryName) {
          const key = row.categoryName.toLowerCase();
          if (categoryMap.has(key)) {
            categoryId = categoryMap.get(key).id;
          } else {
            const newCategory = await Category.create(
              { name: row.categoryName },
              { transaction: t }
            );
            categoryMap.set(key, newCategory);
            categoryId = newCategory.id;
          }
        }

        await Product.create(
          {
            barcode: row.barcode,
            name: row.name,
            brand: row.brand,
            category_id: categoryId,
          },
          { transaction: t }
        );

        imported += 1;
      }
    });
  }

  return {
    total_lines: rows.length,
    imported,
    errors,
    success: errors.length === 0,
  };
};

module.exports = { importFromCSV };
