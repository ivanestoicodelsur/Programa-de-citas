/**
 * Catálogo de libros. Fuente única de verdad.
 * No se venden libros individuales — un solo pack `sistema-completo` de $100
 * entrega los 4 libros núcleo + 3 guías bonus.
 */
export const BOOKS = [
  {
    slug: "batalla-cultural",
    title: "La Batalla Cultural y la Metafísica del Progreso",
    nucleo: true,
    file: "batalla-cultural.pdf",
    cover: "/books/covers/batalla-cultural.png",
  },
  {
    slug: "autonomia",
    title: "Autonomía Integral",
    nucleo: true,
    file: "autonomia.pdf",
    cover: "/books/covers/autonomia.png",
  },
  {
    slug: "preparador-mental",
    title: "Preparador Mental: Dominio Interno",
    nucleo: true,
    file: "preparador-mental.pdf",
    cover: "/books/covers/preparador-mental.png",
  },
  {
    slug: "provida",
    title: "Pro Vida: El Manifiesto",
    nucleo: true,
    file: "provida.pdf",
    cover: "/books/covers/provida.png",
  },
  {
    slug: "objetivos",
    title: "Objetivos y Procesos Empresariales",
    nucleo: false,
    file: "objetivos.pdf",
    cover: "/books/covers/objetivos.png",
  },
  {
    slug: "tecnico",
    title: "Técnico Funcional + Marketing",
    nucleo: false,
    file: "tecnico.pdf",
    cover: "/books/covers/tecnico.png",
  },
  {
    slug: "ia-agentes",
    title: "IA, Agentes y Automatizaciones",
    nucleo: false,
    file: "ia-agentes.pdf",
    cover: "/books/covers/ia-agentes.png",
  },
];

// Un único pack. Pago único $100 USD (10 000 cents).
// Incluye TODOS los slugs — acceso total al Sistema.
export const PACKS = {
  "sistema-completo": {
    slug: "sistema-completo",
    title: "Sistema de Autonomía y Preparación ante el Ingeniero Social",
    subtitle: "4 libros núcleo + 3 guías complementarias",
    priceCents: 10000,
    currency: "USD",
    includes: BOOKS.map((b) => b.slug),
  },
};

export const SYSTEM_PACK = PACKS["sistema-completo"];

export function findBook(slug) {
  return BOOKS.find((b) => b.slug === slug) || null;
}

export function publicCatalog() {
  // Respuesta segura para el frontend: sin campo `file`.
  return {
    books: BOOKS.map(({ file, ...rest }) => rest),
    pack: {
      slug: SYSTEM_PACK.slug,
      title: SYSTEM_PACK.title,
      subtitle: SYSTEM_PACK.subtitle,
      priceCents: SYSTEM_PACK.priceCents,
      currency: SYSTEM_PACK.currency,
      includes: SYSTEM_PACK.includes,
    },
  };
}
