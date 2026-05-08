/**
 * Servicios de acompañamiento 1 a 1.
 * Separados de los infoproductos (libros/pack digital).
 */
export const SERVICES = [
  {
    id: "coaching-1a1",
    slug: "sesiones-1-a-1",
    title: "Sesiones 1 a 1 · Transformación Personal",
    subtitle: "3 llamadas de acompañamiento personalizado",
    description:
      "Un proceso de 3 sesiones secuenciales diseñado para identificar qué puedes cambiar, mejorar y fortalecer a través de tus emociones, cognición y psicología.",
    areas: ["Emociones", "Cognición", "Psicología"],
    availability: "Cupos limitados — escribe para disponibilidad",
    sessions: [
      {
        number: 1,
        label: "Primera llamada",
        name: "Observación",
        description:
          "Sesión inicial de observación profunda. Escucho tu historia, tus patrones de pensamiento y tus puntos de quiebre. Sin juicios, sin diagnóstico aún. El objetivo es que te sientas comprendido y que yo pueda leer el contexto completo.",
      },
      {
        number: 2,
        label: "Segunda llamada",
        name: "Diagnóstico",
        description:
          "Con la información de la primera sesión, realizamos un diagnóstico preciso: qué emociones te frenan, qué creencias limitan tu avance y cómo responde tu cognición ante el cambio. Esta sesión es el corazón del proceso.",
      },
      {
        number: 3,
        label: "Tercera llamada",
        name: "Recomendación",
        description:
          "Después de observar tu respuesta al diagnóstico, entrego mi recomendación personalizada. El orden importa: la tercera llamada depende de lo que emergió en la segunda, porque tu reacción al diagnóstico es la retroalimentación que necesito para definir exactamente qué puedes cambiar y cómo.",
      },
    ],
    process:
      "El proceso es estrictamente secuencial. La recomendación final solo es posible después del diagnóstico, porque es tu respuesta a ese diagnóstico —no el diagnóstico en sí— la que revela el camino de cambio real.",
  },
];

export function findService(slug) {
  return SERVICES.find((s) => s.slug === slug) || null;
}
