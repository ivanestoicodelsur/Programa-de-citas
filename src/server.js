import "./config/env.js";
import { app } from "./app.js";
import { connectMongo } from "./config/mongo.js";
import { setMongoMode, setSqlMode } from "./config/runtime.js";
import { connectSql } from "./config/sql.js";
import { seedAdminUser } from "./utils/seedAdmin.js";

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  try {
    await connectMongo();
    setMongoMode("mongo");
  } catch (error) {
    setMongoMode("memory");
    console.warn("MongoDB unavailable, using in-memory audit mode");
  }

  try {
    await connectSql();
    setSqlMode("sql");
  } catch (error) {
    setSqlMode("memory");
    console.warn("SQL unavailable, using in-memory demo mode.", error.message);
  }

  await seedAdminUser();

  await new Promise((resolve, reject) => {
    const server = app.listen(port, resolve);
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Free it and retry.`));
      } else {
        reject(err);
      }
    });
  });

  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
