/**
 * Script: migrateEbooksToDB
 *
 * Lee todos los PDFs del catálogo (private/books/*.pdf) y los inserta
 * en la tabla `ebooks` como BLOB. Idempotente: si ya existe el slug,
 * actualiza el contenido en vez de duplicar.
 *
 * Uso:
 *   node src/scripts/migrateEbooksToDB.js
 *   node src/scripts/migrateEbooksToDB.js --force   (sobreescribe aunque exista)
 *
 * Beneficio: después de correrlo, los PDFs viven dentro de repair.sqlite
 * y ya no se necesita el volumen gofix-books en EasyPanel.
 */

import "../config/env.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectSql } from "../config/sql.js";
import { Ebook } from "../models/sqlModels.js";
import { BOOKS } from "../config/booksCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = path.resolve(__dirname, "../../private/books");

const force = process.argv.includes("--force");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  console.log("📚 Migrando ebooks del filesystem a la DB…");
  console.log(`   Carpeta fuente: ${BOOKS_DIR}`);
  console.log(`   Modo: ${force ? "FORCE (sobreescribe)" : "solo si falta"}\n`);

  await connectSql();

  let created = 0, updated = 0, skipped = 0, missing = 0;

  for (const book of BOOKS) {
    const filePath = path.join(BOOKS_DIR, book.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  ${book.slug} — archivo no encontrado: ${book.file}`);
      missing++;
      continue;
    }

    const buf = fs.readFileSync(filePath);
    const hash = sha256Hex(buf);

    const existing = await Ebook.scope("withFile").findOne({ where: { slug: book.slug } });

    if (existing && !force && existing.sha256 === hash) {
      console.log(`= ${book.slug} — ya está en DB con el mismo hash, skip`);
      skipped++;
      continue;
    }

    if (existing) {
      await existing.update({
        title: book.title,
        fileName: book.file,
        fileSize: buf.length,
        fileData: buf,
        sha256: hash,
        mimeType: "application/pdf",
      });
      console.log(`✎ ${book.slug} — actualizado (${(buf.length / 1024).toFixed(0)} KB)`);
      updated++;
    } else {
      await Ebook.create({
        slug: book.slug,
        title: book.title,
        fileName: book.file,
        fileSize: buf.length,
        fileData: buf,
        sha256: hash,
        mimeType: "application/pdf",
        isPublished: true,
        metadata: {
          cover: book.cover,
          pricePdfCents: book.pricePdfCents,
          pricePlatformCents: book.pricePlatformCents,
          migratedAt: new Date().toISOString(),
        },
      });
      console.log(`+ ${book.slug} — creado (${(buf.length / 1024).toFixed(0)} KB)`);
      created++;
    }
  }

  console.log("\n────────────────────────────────────");
  console.log(`✅ Creados:      ${created}`);
  console.log(`✎  Actualizados: ${updated}`);
  console.log(`=  Sin cambios:  ${skipped}`);
  console.log(`⚠️  Faltantes:    ${missing}`);
  console.log("────────────────────────────────────");
  console.log("Los PDFs ya viven en la DB. Puedes borrar private/books/ en el servidor si quieres.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migración falló:", err);
  process.exit(1);
});
