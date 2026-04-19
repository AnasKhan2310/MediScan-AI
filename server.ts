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
    if (!key || key === "YOUR_API_KEY_HERE") {
      throw new Error("SERVER_ERROR: GEMINI_API_KEY is missing or invalid in environment variables.");
    }
    genAIInstance = new GoogleGenAI({ apiKey: key.trim() });
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
      // Use Gemini 3.1 Pro for better medical reasoning
      const modelName = "gemini-3.1-pro-preview";

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

  // Serve static files in production
  const isProduction = process.env.NODE_ENV === "production" || process.env.K_SERVICE !== undefined;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
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
