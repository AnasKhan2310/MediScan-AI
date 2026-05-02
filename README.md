# 🧠 MediScan AI – Smart Health Assistant

MediScan AI is an AI-powered healthcare assistant built using **Python + Streamlit + Gemini AI** that helps users understand their symptoms, get possible insights, and take informed next steps.

🔗 Live App: https://mediscan-ai-29938184252.europe-west1.run.app/

---

## 🚀 Features

- 🩺 Symptom Checker (AI-powered)
- 💬 Chat-based health assistant
- 🎤 Voice + Text + Image input support
- 💊 Medicine guidance & side effects
- 📍 Nearby clinic/pharmacy suggestions
- ⚡ Real-time AI responses using Gemini

---

## 🧠 How It Works

1. User enters symptoms (text, voice, or image)
2. AI analyzes input using Gemini model
3. System provides:
   - Possible condition insights
   - Suggested actions (self-care / doctor visit)
4. User gets simplified medical guidance

👉 The app does NOT replace doctors — it only assists users.

---

## 🛠️ Tech Stack

- **Frontend:** Streamlit  
- **Backend:** Python  
- **AI Model:** Gemini API  
- **Other Tools:**  
  - Speech Recognition  
  - Image Processing  
  - APIs for location-based services  

---

## 📦 Installation

```bash
git clone https://github.com/your-username/mediscan-ai.git
cd mediscan-ai
pip install -r requirements.txt
streamlit run app.py

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
