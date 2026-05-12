import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";
import { health } from "./controllers/health.controller.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { v1Router } from "./routes/v1.routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOpenApiSpec(): Record<string, unknown> {
  const path = join(__dirname, "..", "openapi", "openapi.yaml");
  const raw = readFileSync(path, "utf8");
  const doc = yaml.load(raw);
  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid OpenAPI document");
  }
  return doc as Record<string, unknown>;
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "256kb" }));

  const openApiDoc = loadOpenApiSpec();

  app.get("/health", health);
  app.use("/api/v1", v1Router);

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDoc);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
