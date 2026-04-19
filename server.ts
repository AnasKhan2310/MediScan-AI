import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialize Gemini (to avoid issues if env var loads late)
let genAIInstance: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAIInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "YOUR_API_KEY_HERE" || key === "GEMINI_API_KEY") {
      throw new Error("SERVER_ERROR: GEMINI_API_KEY is not set correctly in Cloud Run variables.");
    }
    
    // ULTRA CLEAN: Remove all possible garbage characters
    const cleanKey = key.replace(/['"\s\n\r\t]/g, "").trim();
    
    // Safety check: Most Google API keys start with 'AIza'
    if (!cleanKey.startsWith("AIza")) {
       console.warn("[MediScan] Warning: API key does not start with typical 'AIza' prefix. Check for typos.");
    }

    const keyPreview = `${cleanKey.substring(0, 4)}...${cleanKey.substring(cleanKey.length - 4)}`;
    console.log(`[MediScan] Initializing GenAI with key: ${keyPreview} (Length: ${cleanKey.length})`);
    
    genAIInstance = new GoogleGenAI({ apiKey: cleanKey });
  }
  return genAIInstance;
}

const SYSTEM_PROMPT = `You are MediScan AI, a high-precision medical analysis system.
Your mission is to provide clinical analysis of medical documents.

### STANDARDS:
1. **Document Fidelity**: Extract all markers accurately.
2. **Clinical Standards**: Compare against international norms.
3. **Professional Triage**: Categorize results by urgency.

### RESPONSE FORMAT:
# 📊 CLINICAL SUMMARY
**TYPE:** [TYPE]
[Professional clinical overview]

# 🔍 EXTRACTED DATA
| Marker | Value | Status | Reference |
|---|---|---|---|
| [Name] | [Value] | **[STATUS]** | [Range] |

# 💡 CLINICAL INSIGHTS
- [Insight]

# 👨‍⚕️ SPECIALIST REFERRAL
[Recommended Specialist]

# ⚠️ LEGAL DISCLAIMER
Automated analysis. Not a diagnosis. Consult a physician.`;

const SYMPTOM_PROMPT = `You are MediScan AI, an advanced symptom guidance system.
Analyze symptoms with clinical rigor and provide triage guidance.

### OBJECTIVES:
1. **Conditions**: List 3 likely conditions with probabilities.
2. **Urgency**: Grade as CRITICAL, URGENT, or ROUTINE.

### FORMAT:
# 🩺 DIFFERENTIAL GUIDANCE
[Findings]

# 🚨 CRITICAL RED FLAGS
[Warnings]

# 🏥 INTERVENTION PATH
[Triage]`;

async function startServer() {
  const app = express();
  // Cloud Run sets PORT environment variable, default to 8080
  const PORT = Number(process.env.PORT) || 8080;

  // Middleware for large payloads (Base64 images)
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve static files
  const isProduction = process.env.NODE_ENV === "production" || process.env.K_SERVICE !== undefined;
  
  // Use absolute path for robustness
  const distPath = path.resolve(__dirname, 'dist');

  // We check if the dist directory actually exists before assuming production serving
  const fs = await import("fs");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  if (isProduction && hasDist) {
    console.log(`[MediScan] Production Mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        // Read index.html and inject the API key so the frontend can access it at runtime
        let html = fs.readFileSync(indexPath, 'utf-8');
        const envConfig = {
          GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
        };
        const scriptInjection = `<script>window.ENV = ${JSON.stringify(envConfig)};</script>`;
        html = html.replace('<head>', `<head>${scriptInjection}`);
        res.send(html);
      } else {
        res.status(404).send("MediScan ERROR: dist/index.html not found. Please run 'npm run build'.");
      }
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
