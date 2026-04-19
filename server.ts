import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI (Backend Only)
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  const PORT = 3000;

  // Middleware for large payloads (Base64 images)
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    const { mode, image, symptoms, patientAge } = req.body;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
      }

      let contents: any = {};
      const response = await genAI.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          mode === 'report' ? SYSTEM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}.` : SYMPTOM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}. Symptoms: ${symptoms}.`,
          ...(mode === 'report' ? [{
            inlineData: {
              data: image,
              mimeType: "image/jpeg"
            }
          }] : [])
        ],
      });

      const text = response.text;

      res.json({ analysis: text });
    } catch (error: any) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: error.message || "Internal server error during analysis." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediScan Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer();
