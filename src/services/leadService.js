import { Lead, LeadActivity } from "../models/sqlModels.js";
import { Op } from "sequelize";

/**
 * Crea o actualiza un Lead. Upsert por email o phone.
 * SIEMPRE registra una LeadActivity (historial completo, cero pérdida).
 *
 * @param {object} data
 * @param {string} data.source       - Obligatorio: de dónde vino (repair, newsletter-*, community-signup, etc)
 * @param {string} [data.channel]    - gofix / mindsetbuilder / politicast / biblioteca
 * @param {string} [data.email]
 * @param {string} [data.phone]
 * @param {string} [data.firstName]
 * @param {string} [data.lastName]
 * @param {string} [data.city]
 * @param {object} [data.metadata]   - cualquier dato adicional (página, libro, device, etc)
 * @param {string} [data.utmSource|utmMedium|utmCampaign|utmContent]
 * @param {string} [data.referrer]
 * @param {string} [data.landingPath]
 * @param {string} [activityType="captured"]
 */
export async function captureLead(data, activityType = "captured") {
  const { source, channel = "mindsetbuilder", email, phone, metadata = {}, ...rest } = data;
  if (!source) throw new Error("source es obligatorio");
  if (!email && !phone) {
    throw new Error("email o phone requerido");
  }

  const where = [];
  if (email) where.push({ email });
  if (phone) where.push({ phone });

  let lead = await Lead.findOne({ where: { [Op.or]: where } });

  if (!lead) {
    lead = await Lead.create({
      source,
      channel,
      email: email || null,
      phone: phone || null,
      firstName: rest.firstName || null,
      lastName:  rest.lastName  || null,
      city:      rest.city      || null,
      metadata,
      utmSource:   rest.utmSource   || null,
      utmMedium:   rest.utmMedium   || null,
      utmCampaign: rest.utmCampaign || null,
      utmContent:  rest.utmContent  || null,
      referrer:    rest.referrer    || null,
      landingPath: rest.landingPath || null,
      firstContactAt: new Date(),
      lastContactAt:  new Date(),
    });
  } else {
    // Merge: completa campos faltantes, nunca sobrescribe identidad
    const patch = { lastContactAt: new Date() };
    if (!lead.firstName && rest.firstName) patch.firstName = rest.firstName;
    if (!lead.lastName  && rest.lastName)  patch.lastName  = rest.lastName;
    if (!lead.city      && rest.city)      patch.city      = rest.city;
    if (!lead.email     && email)          patch.email     = email;
    if (!lead.phone     && phone)          patch.phone     = phone;
    // metadata acumulativo
    patch.metadata = { ...(lead.metadata || {}), ...metadata };
    await lead.update(patch);
  }

  await LeadActivity.create({
    leadId: lead.id,
    type: activityType,
    source,
    metadata,
  });

  return lead;
}

export async function markAsPurchaser(leadId, amountCents, productSlug) {
  const lead = await Lead.findByPk(leadId);
  if (!lead) return null;
  await lead.update({
    status: "customer",
    hasPurchased: true,
    totalPurchaseCents: (lead.totalPurchaseCents || 0) + (amountCents || 0),
    lastContactAt: new Date(),
  });
  await LeadActivity.create({
    leadId: lead.id,
    type: "purchase",
    source: "purchase",
    metadata: { amountCents, productSlug },
  });
  return lead;
}

export async function findLeadByEmailOrPhone({ email, phone }) {
  const where = [];
  if (email) where.push({ email });
  if (phone) where.push({ phone });
  if (!where.length) return null;
  return Lead.findOne({ where: { [Op.or]: where } });
}
