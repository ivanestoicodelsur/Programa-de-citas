const inventoryCatalog = [
  {
    brand: "Samsung",
    model: "Galaxy S24 Ultra",
    series: "Galaxy S",
    deviceType: "smartphone",
    releaseYear: 2024,
    parts: [
      { name: "Pantalla Dynamic AMOLED 2X", type: "AMOLED", quality: "Aftermarket", cost: 210, sale: 349.99, stock: 6 },
      { name: "Batería", type: "Li-Ion", quality: "OEM", cost: 22, sale: 89.99, stock: 18 },
      { name: "Charging Port", type: "USB-C", quality: "Genérica", cost: 12, sale: 79.99, stock: 20 },
    ],
  },
  {
    brand: "Samsung",
    model: "Galaxy A54",
    series: "Galaxy A",
    deviceType: "smartphone",
    releaseYear: 2023,
    parts: [
      { name: "Pantalla Super AMOLED", type: "AMOLED", quality: "Aftermarket", cost: 85, sale: 169.99, stock: 10 },
      { name: "Batería", type: "Li-Ion", quality: "Genérica", cost: 14, sale: 59.99, stock: 22 },
    ],
  },
  {
    brand: "Apple",
    model: "iPhone 14 Pro Max",
    series: "iPhone 14",
    deviceType: "smartphone",
    releaseYear: 2022,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 280, sale: 450, stock: 4 },
      { name: "Batería", type: "Li-Ion", quality: "OEM", cost: 25, sale: 89.99, stock: 15 },
      { name: "Flex de carga", type: "Lightning", quality: "Original", cost: 30, sale: 119.99, stock: 7 },
    ],
  },
  {
    brand: "Apple",
    model: "iPhone 13",
    series: "iPhone 13",
    deviceType: "smartphone",
    releaseYear: 2021,
    parts: [
      { name: "Pantalla OLED", type: "OLED", quality: "Aftermarket", cost: 180, sale: 299.99, stock: 6 },
      { name: "Batería", type: "Li-Ion", quality: "OEM", cost: 20, sale: 79.99, stock: 14 },
      { name: "Cámara trasera", type: "Dual Camera", quality: "Original", cost: 95, sale: 189.99, stock: 3 },
    ],
  },
  {
    brand: "Apple",
    model: "iPad Pro 12.9 M2",
    series: "iPad Pro",
    deviceType: "tablet",
    releaseYear: 2022,
    parts: [
      { name: "Pantalla Mini-LED", type: "Mini-LED", quality: "Aftermarket", cost: 380, sale: 550, stock: 2 },
      { name: "Puerto de carga", type: "USB-C", quality: "Original", cost: 35, sale: 140, stock: 4 },
    ],
  },
  {
    brand: "Apple",
    model: "MacBook Pro 14 M3",
    series: "MacBook Pro",
    deviceType: "laptop",
    releaseYear: 2023,
    parts: [
      { name: "Pantalla Liquid Retina XDR", type: "Liquid Retina", quality: "Aftermarket", cost: 750, sale: 900, stock: 1 },
      { name: "Batería", type: "Li-Polymer", quality: "OEM", cost: 120, sale: 240, stock: 3 },
    ],
  },
  {
    brand: "Motorola",
    model: "Moto G Power 2024",
    series: "Moto G",
    deviceType: "smartphone",
    releaseYear: 2024,
    parts: [
      { name: "Pantalla FHD+ IPS", type: "IPS", quality: "Aftermarket", cost: 45, sale: 120, stock: 8 },
      { name: "Batería", type: "Li-Ion", quality: "Genérica", cost: 11, sale: 49.99, stock: 16 },
    ],
  },
];

export function buildSeedInventoryItems({ adminId, scopeKey }) {
  return inventoryCatalog.flatMap((device) =>
    device.parts.map((part, index) => ({
      name: `${device.brand} ${device.model} · ${part.name}`,
      code: buildSku(device, part, index),
      description: `${device.brand} ${device.model} (${device.series}) · ${part.type || "General"} · ${part.quality}`,
      category: `${device.brand} ${device.series || device.model}`,
      repairType: part.name,
      price: part.sale,
      estimatedHours: inferEstimatedHours(part.name, device.deviceType),
      stock: part.stock ?? 10,
      status: "active",
      visibilityScope: scopeKey,
      assignedUserId: adminId,
      createdById: adminId,
      metadata: {
        seed: true,
        brand: device.brand,
        model: device.model,
        series: device.series,
        deviceType: device.deviceType,
        releaseYear: device.releaseYear,
        partType: part.type || null,
        quality: part.quality,
        costPrice: part.cost,
        salePrice: part.sale,
        supplier: "Importación",
      },
    }))
  );
}

function buildSku(device, part, index) {
  const raw = `${device.brand}-${device.model}-${part.name}-${index + 1}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return raw.slice(0, 80);
}

function inferEstimatedHours(partName, deviceType) {
  const lower = partName.toLowerCase();
  if (lower.includes("pantalla")) {
    return deviceType === "laptop" ? 4 : 2;
  }
  if (lower.includes("bater")) {
    return deviceType === "laptop" ? 3 : 1;
  }
  if (lower.includes("camara") || lower.includes("cámara")) {
    return 2;
  }
  return 1;
}
