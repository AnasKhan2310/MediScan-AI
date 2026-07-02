import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();

// Middleware for large payloads (Base64 images)
app.use(express.json({ limit: "10mb" }));

// Lazy initialize Gemini (to avoid issues if env var loads late)
let genAIInstance: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAIInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "YOUR_API_KEY_HERE" || key === "GEMINI_API_KEY") {
      throw new Error("SERVER_ERROR: GEMINI_API_KEY is not set correctly. Please check your Vercel or Cloud Run environment variables.");
    }
    
    // Remove all possible garbage characters
    const cleanKey = key.replace(/['"\s\n\r\t]/g, "").trim();
    
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Secure Server-side API Proxy for Gemini Analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { mode, patientAge, symptoms, fileData, mimeType } = req.body;
    
    const promptText = mode === "report" 
      ? SYSTEM_PROMPT + ` Patient Age: ${patientAge || "unspecified"}.` 
      : SYMPTOM_PROMPT + ` Patient Age: ${patientAge || "unspecified"}. Symptoms: ${symptoms || "unspecified"}.`;

    const ai = getGenAI();

    // RETRY LOGIC for 503 Highly Demanded errors
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview", 
          contents: {
            parts: [
              { text: promptText },
              ...(mode === "report" && fileData ? [{
                inlineData: {
                  data: fileData,
                  mimeType: mimeType || "image/jpeg"
                }
              }] : [])
            ]
          }
        });

        const text = response.text;
        if (text) {
          return res.json({ text });
        }
      } catch (err: any) {
        lastError = err;
        const isServiceUnavailable = err.message?.includes("503") || err.message?.includes("service is currently unavailable") || err.message?.includes("high demand");
        
        if (isServiceUnavailable && attempts < maxAttempts - 1) {
          attempts++;
          const delay = Math.pow(2, attempts) * 1000; // Exponential backoff: 2s, 4s
          console.warn(`[MediScan API] Server busy. Retry attempt ${attempts} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        break; // Not a retryable error or max attempts reached
      }
    }

    throw lastError || new Error("Failed to generate content from Gemini API.");
  } catch (err: any) {
    console.error("[MediScan API] Analysis error:", err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

export default app;
