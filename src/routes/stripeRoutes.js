import express from "express";
import Stripe from "stripe";
import { requireAuth } from "../middlewares/auth.js";
import { SYSTEM_PACK } from "../config/booksCatalog.js";
import { Purchase, User } from "../models/sqlModels.js";
import { captureLead, markAsPurchaser, findLeadByEmailOrPhone } from "../services/leadService.js";

export const checkoutRouter = express.Router();
export const webhookRouter = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

const PORTAL_URL = process.env.PORTAL_URL || "https://gofixlibros.com/portal";

/* ------------------------------------------------------------------
 * POST /api/checkout/create-session
 * Crea una Stripe Checkout Session para el pack Sistema Completo ($100).
 * El usuario debe estar autenticado — la userId viaja en metadata
 * para que el webhook pueda crear la Purchase correcta.
 * ------------------------------------------------------------------ */
checkoutRouter.post("/create-session", requireAuth, async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ message: "Stripe no configurado. Falta STRIPE_SECRET_KEY." });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const existing = await Purchase.findOne({
      where: { userId: user.id, bookSlug: SYSTEM_PACK.slug, isActive: true },
    });
    if (existing) {
      return res.status(409).json({ message: "Ya tienes acceso al Sistema Completo.", purchase: existing });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: SYSTEM_PACK.currency.toLowerCase(),
            unit_amount: SYSTEM_PACK.priceCents,
            product_data: {
              name: SYSTEM_PACK.title,
              description: SYSTEM_PACK.subtitle,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        bookSlug: SYSTEM_PACK.slug,
        system: "gofixlibros",
      },
      success_url: `${PORTAL_URL}?checkout=success&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PORTAL_URL}?checkout=cancelled`,
      // Permite tips voluntarios si el cliente quiere apoyar más
      // (por eso no bloqueamos adjustable_quantity en la línea principal;
      //  un "apoyo extra" adicional lo añadimos como línea opcional vía UI).
      allow_promotion_codes: true,
    });

    await captureLead({
      source: "checkout-started",
      channel: "biblioteca",
      email: user.email,
      firstName: (user.name || "").split(/\s+/)[0] || null,
      metadata: { sessionId: session.id, userId: user.id, amountCents: SYSTEM_PACK.priceCents },
    }, "captured").catch(() => null);

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------
 * POST /api/webhooks/stripe
 * Recibe eventos de Stripe. IMPORTANTE: esta ruta usa express.raw
 * (configurado en app.js ANTES de express.json) porque la firma
 * se valida sobre el body crudo.
 *
 * Eventos procesados:
 *   - checkout.session.completed  → crea Purchase activa
 *   - charge.refunded             → desactiva Purchase
 * ------------------------------------------------------------------ */
webhookRouter.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (secret) {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Modo dev sin secret: aceptamos el body como JSON. NUNCA usar así en prod.
      event = JSON.parse(req.body.toString("utf8"));
    }
  } catch (err) {
    console.error("[stripe webhook] firma inválida:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId   = session.metadata?.userId || session.client_reference_id;
      const bookSlug = session.metadata?.bookSlug || SYSTEM_PACK.slug;
      const email    = session.customer_details?.email || session.customer_email;
      const amountCents = session.amount_total || SYSTEM_PACK.priceCents;

      if (!userId) {
        console.warn("[stripe webhook] session sin userId, intentamos por email:", email);
      }

      let user = userId ? await User.findByPk(userId) : null;
      if (!user && email) {
        user = await User.findOne({ where: { email } });
      }

      if (!user) {
        console.error("[stripe webhook] no se encontró usuario para session:", session.id);
        return res.status(200).send("ok"); // devolver 200 para que Stripe no reintente en loop
      }

      const [purchase, created] = await Purchase.findOrCreate({
        where: { userId: user.id, bookSlug },
        defaults: {
          source: "stripe",
          externalId: session.id,
          amountCents,
          currency: (session.currency || "usd").toUpperCase(),
          isActive: true,
        },
      });
      if (!created) {
        await purchase.update({
          isActive: true,
          source: "stripe",
          externalId: session.id,
          amountCents,
        });
      }

      // Espejo en Lead (CRM unificado)
      try {
        const [firstName, ...rest] = (user.name || "").trim().split(/\s+/);
        await captureLead({
          source: "book-purchase",
          channel: "biblioteca",
          email: user.email,
          firstName: firstName || null,
          lastName: rest.join(" ") || null,
          metadata: {
            bookSlug,
            sessionId: session.id,
            amountCents,
            userId: user.id,
          },
        }, "purchase");
        const lead = await findLeadByEmailOrPhone({ email: user.email });
        if (lead) await markAsPurchaser(lead.id, amountCents, bookSlug);
      } catch (leadErr) {
        console.error("[stripe webhook] captureLead failed:", leadErr.message);
      }

      console.log(`[stripe webhook] ✅ Purchase ${purchase.id} para user ${user.id}`);
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const sessionId = charge.payment_intent;
      if (sessionId) {
        const purchase = await Purchase.findOne({ where: { externalId: sessionId } });
        if (purchase) {
          await purchase.update({ isActive: false });
          console.log(`[stripe webhook] ⊖ Purchase ${purchase.id} desactivada por refund`);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    res.status(500).send("handler error");
  }
});

export default checkoutRouter;
