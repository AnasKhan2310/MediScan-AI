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

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    const { mode, image, symptoms, patientAge } = req.body;

    try {
      const genAI = getGenAI();
      // Using gemini-3-flash-preview for maximum compatibility and stability
      const modelName = "gemini-3-flash-preview";

      const promptText = mode === 'report' 
        ? SYSTEM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}.` 
        : SYMPTOM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}. Symptoms: ${symptoms}.`;

      const response = await genAI.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: promptText },
            ...(mode === 'report' ? [{
              inlineData: {
                data: image,
                mimeType: "image/jpeg"
              }
            }] : [])
          ]
        }
      });

      const text = response.text;
      res.json({ analysis: text });
    } catch (error: any) {
      console.error("ANALYSIS_SERVER_ERROR:", error);
      // Send the clear error message to frontend
      res.status(500).json({ 
        error: error.message || "Unknown server error",
        details: error.response?.data || error.stack
      });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve static files
  const isProduction = process.env.NODE_ENV === "production" || process.env.K_SERVICE !== undefined;
  const distPath = path.resolve(process.cwd(), 'dist');

  // We check if the dist directory actually exists before assuming production serving
  const fs = await import("fs");
  const hasDist = fs.existsSync(distPath);

  if (!isProduction || !hasDist) {
    if (isProduction && !hasDist) {
      console.warn("Production mode detected but 'dist' folder is missing. Falling back to Vite middleware...");
    }
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediScan Server is LIVE on port ${PORT}`);
  });
}

startServer();
