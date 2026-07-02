import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import app from "./api/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Serve static files
  const isProduction = process.env.NODE_ENV === "production" || process.env.K_SERVICE !== undefined;
  const distPath = path.resolve(__dirname, "dist");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  if (isProduction && hasDist) {
    console.log(`[MediScan] Production Mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("[MediScan] Development Mode: Using Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediScan Server is LIVE on port ${PORT}`);
  });
}

startServer();
