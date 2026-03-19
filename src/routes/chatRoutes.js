import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente virtual de GO FIX MIAMI, un servicio profesional de reparación de dispositivos electrónicos ubicado en Miami, Florida.

Tu rol es ayudar a los clientes a:
- Conocer los servicios de reparación disponibles (pantallas, baterías, puertos de carga, cámaras, altavoces, botones, etc.)
- Obtener información sobre precios aproximados
- Saber los tiempos de reparación
- Conocer qué marcas y modelos reparamos (iPhone, Samsung, Motorola, iPad, tabletas Android, laptops)
- Agendar o solicitar un presupuesto
- Cualquier duda sobre garantías, tiempo de entrega, formas de pago

Información clave de GO FIX MIAMI:
- Ubicación: Miami, Florida (servicio a domicilio y en local)
- WhatsApp de contacto: +1 (786) 806-2197
- Reparamos: iPhones, Samsung Galaxy, Motorola, iPads, tablets Android, laptops
- Servicios más comunes: pantalla rota, batería, puerto de carga, cámara, daño por agua
- Garantía en todas las reparaciones
- Precios competitivos y transparentes
- Diagnóstico gratuito

Responde siempre en español de forma amigable, concisa y profesional. Si el cliente quiere un precio exacto o agendar, anímalo a contactarnos por WhatsApp al +1 (786) 806-2197 o usar el cotizador en la página.`;

router.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages requerido" });
  }

  // Sanitize messages: only keep role and content
  const safeMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: safeMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    console.error("Chat error:", err.message);
    const isLowCredit = err.message?.includes("credit balance");
    const msg = isLowCredit
      ? "El chat con IA no está disponible en este momento. Contáctanos directamente por WhatsApp al **+1 (786) 806-2197** y te atendemos de inmediato. 😊"
      : "Lo siento, hubo un problema al procesar tu mensaje. Por favor escríbenos por WhatsApp al **+1 (786) 806-2197**.";
    res.write(`data: ${JSON.stringify({ text: msg })}\n\n`);
    res.write("data: [DONE]\n\n");
  } finally {
    res.end();
  }
});

export default router;
