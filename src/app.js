import "./config/env.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import googleSheetsRoutes from "./routes/googleSheetsRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import landingRoutes from "./routes/landingRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import assetRoutes from "./routes/assetRoutes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      // In development, allow any localhost / 127.0.0.1 origin
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocal || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        fontSrc: ["'self'", "https:", "data:"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ status: "OK", service: "gofix-api", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "repair-services-backend" });
});

// Serve uploaded files as static assets
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

app.use("/api", landingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/integrations/google-sheets", googleSheetsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
