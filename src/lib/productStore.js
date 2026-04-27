const STORAGE_KEY = "importedProducts";

export function loadProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function addProducts(products = []) {
  const existing = loadProducts();

  const mapped = products.map((product, index) => ({
    id: product.id || product.sku || `product-${Date.now()}-${index}`,
    source: product.source || "Business Central Import",
    ...product,
  }));

  const updated = [...mapped, ...existing];
  saveProducts(updated);
  return mapped;
}

export function clearProducts() {
  localStorage.removeItem(STORAGE_KEY);
}