import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Upload, 
  Search, 
  Stethoscope, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  HeartPulse,
  Info,
  ChevronRight,
  ShieldCheck,
  X,
  Activity,
  History,
  Download,
  Share2,
  Printer,
  ChevronLeft,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [mode, setMode] = useState<'report' | 'symptom'>('report');
  const [symptoms, setSymptoms] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('mediscan_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveToHistory = (type: string, data: string) => {
    const newItem = { id: Date.now(), type, data, date: new Date().toISOString(), mode };
    const newHistory = [newItem, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('mediscan_history', JSON.stringify(newHistory));
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setAnalysis(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please upload an image file (PNG or JPEG).');
        return;
      }
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      processFile(droppedFile);
    } else {
      setError('Please drop an image file.');
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    setError(null);
    setSymptoms('');
    setPatientAge('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyze = async () => {
    if (mode === 'report' && !preview) return;
    if (mode === 'symptom' && !symptoms.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Access the key from window.ENV (injected by server) or process.env (for dev)
      const apiKey = (window as any).ENV?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "GEMINI_API_KEY") {
        throw new Error("MediScan AI: API Key is missing. Please set GEMINI_API_KEY in your Cloud Run revision environment variables.");
      }

      const { GoogleGenAI } = await import("@google/genai");
      const cleanKey = apiKey.replace(/['"\s\n\r\t]/g, "").trim();
      const ai = new GoogleGenAI({ apiKey: cleanKey });

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

      const promptText = mode === 'report' 
        ? SYSTEM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}.` 
        : SYMPTOM_PROMPT + ` Patient Age: ${patientAge || 'unspecified'}. Symptoms: ${symptoms}.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: promptText },
            ...(mode === 'report' ? [{
              inlineData: {
                data: preview!.split(',')[1],
                mimeType: file?.type || "image/jpeg"
              }
            }] : [])
          ]
        }
      });

      const text = response.text;
      if (text) {
        setAnalysis(text);
        saveToHistory(mode === 'report' ? 'Report Analysis' : 'Symptom Screening', text);
      } else {
        throw new Error("No analysis generated. Please try a different image or description.");
      }
    } catch (err: any) {
      console.error("ANALYSIS_ERROR:", err);
      // Clean up common technical error messages for the user
      let userMessage = err.message || 'Analysis failed. Please try again.';
      if (userMessage.includes("API key not valid")) {
        userMessage = "API Key Error: Your API key is being rejected by Google. Please check your Cloud Run variables and ensure the key has no spaces or quotes.";
      }
      setError(userMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen py-4 sm:py-8 px-2 sm:px-6 lg:px-8 flex justify-center items-start bg-slate-50">
      <div className="w-full max-w-[1100px] flex flex-col lg:flex-row gap-6">
        {/* Main Card */}
        <div className="flex-grow bg-white shadow-xl rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden flex flex-col min-h-[calc(100vh-2rem)] sm:min-h-[800px]">
          {/* Header */}
          <header className="bg-teal-600 px-6 sm:px-10 py-5 sm:py-7 text-white flex justify-between items-center shrink-0 shadow-lg">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight m-0 uppercase italic leading-none">MediScan <span className="text-teal-200">AI</span></h1>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-teal-100 opacity-80 mt-1">Grounded Clinical Scan</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-6">
              <button 
                onClick={() => setShowHistory(!showHistory)} 
                className="p-2 hover:bg-white/10 rounded-lg text-teal-50 transition-colors"
                title="View History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </header>

          <main className="flex-grow p-6 sm:p-10 flex flex-col gap-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-grow flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-teal-600">AI</div>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em]">Processing Logic</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-[0.1em] mt-1">Grounded in Clinical Data</p>
                  </div>
                </motion.div>
              ) : analysis ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-grow flex flex-col gap-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
                    <button onClick={reset} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-teal-500 transition-colors uppercase tracking-widest"><ChevronLeft className="w-4 h-4" /> Back</button>
                    <div className="flex gap-2">
                       <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"><Printer className="w-3.5 h-3.5" /> PRINT</button>
                       <button onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: 'MediScan Pro Analysis',
                              text: analysis || '',
                              url: window.location.href
                            });
                          }
                        }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-colors uppercase tracking-widest"><Share2 className="w-3.5 h-3.5" /> SHARE</button>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto pr-2 text-left print:overflow-visible">
                    <div className="prose prose-slate max-w-none prose-sm print:prose-lg">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        h1: ({children}) => <h1 className="text-[12px] font-bold text-teal-600 uppercase tracking-[0.2em] border-b border-slate-100 pb-2 mb-6 mt-8 first:mt-0">{children}</h1>,
                        table: ({children}) => <div className="my-6 border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto"><table className="w-full border-collapse text-left">{children}</table></div>,
                        th: ({children}) => <th className="p-4 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">{children}</th>,
                        td: ({children}) => <td className="p-4 text-[13px] text-slate-700 border-b border-slate-100">{children}</td>,
                        strong: ({children}) => {
                          const t = String(children).toUpperCase();
                          if (t.includes('NORMAL') || t.includes('ROUTINE')) return <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-teal-100">Normal</span>;
                          if (t.includes('HIGH') || t.includes('URGENT') || t.includes('RED') || t.includes('CRITICAL')) return <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-red-100">Urgent</span>;
                          return <strong className="font-bold">{children}</strong>;
                        }
                      }}>{analysis}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-grow flex flex-col gap-10">
                  <div className="flex bg-slate-50/50 p-1 rounded-xl border border-slate-100">
                    <button onClick={() => setMode('report')} className={`flex-1 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all rounded-lg ${mode === 'report' ? 'bg-white text-teal-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}>Scan</button>
                    <button onClick={() => setMode('symptom')} className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-all rounded-lg ${mode === 'symptom' ? 'bg-white text-teal-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}>Symptom Checker</button>
                  </div>
                  
                  <div className="flex-grow flex flex-col justify-center">
                    {mode === 'report' ? (
                      <div onClick={() => !preview && fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={handleDrop} className={`border-2 border-dashed rounded-3xl p-8 sm:p-20 flex flex-col items-center justify-center transition-all cursor-pointer ${preview ? 'border-teal-500 bg-teal-50/10' : 'border-slate-200 hover:border-teal-400 hover:bg-slate-50/50'}`}>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        {preview ? (
                          <div className="space-y-6 sm:space-y-8 text-center w-full">
                            <div className="relative inline-block max-w-full">
                              <img src={preview} className="max-h-[250px] sm:max-h-[300px] w-auto rounded-2xl shadow-2xl mx-auto border-4 border-white object-contain" />
                              <button onClick={(e) => { e.stopPropagation(); reset(); }} className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-xl z-20"><X className="w-4 h-4" /></button>
                            </div>
                            <button onClick={analyze} className="w-full sm:w-auto px-8 sm:px-12 py-4 bg-teal-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5 transition-all uppercase tracking-[0.2em] text-[11px]">Start Scan</button>
                          </div>
                        ) : (
                          <div className="text-center group">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Upload className="w-6 h-6 sm:w-7 sm:h-7" /></div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-widest">Scan Report</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-3">High Resolution Imaging Recommended</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Symptomatic Description</label>
                          <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Describe symptoms in detail..." className="w-full h-48 p-6 bg-slate-50 border border-slate-200 rounded-3xl focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none text-[15px] transition-all" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Patient Metrix (Age/Gender)</label>
                          <input type="text" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="e.g. 35, Female" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none text-[15px] transition-all" />
                        </div>
                        <button onClick={analyze} disabled={!symptoms.trim()} className="mt-4 py-5 bg-teal-500 text-white font-bold rounded-3xl shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5 disabled:opacity-50 transition-all uppercase tracking-[0.2em] text-[11px]">Run Differential Algorithm</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {error && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-5 bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold uppercase tracking-widest rounded-2xl flex items-center gap-3"><AlertCircle className="w-5 h-5" /> {error}</motion.div>}
          </main>
        </div>

        {/* History Area */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside 
              initial={{ x: 50, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              exit={{ x: 50, opacity: 0 }} 
              className="fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-auto w-full lg:w-[320px] h-full shrink-0 flex flex-col gap-4 p-4 lg:p-0 bg-black/50 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-0"
              onClick={() => setShowHistory(false)}
            >
              <div 
                className="bg-white p-7 rounded-3xl border border-slate-200 shadow-2xl flex flex-col h-full sm:h-[800px] w-full max-w-[400px] ml-auto lg:ml-0"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-teal-500" />
                    <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em]">Patient Records</h2>
                  </div>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-4 pr-1">
                  {history.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                      <Stethoscope className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No Intelligence Saved</p>
                    </div>
                  ) : history.map(item => (
                    <button key={item.id} onClick={() => { setAnalysis(item.data); setMode(item.mode); }} className="w-full text-left p-5 rounded-2xl border border-slate-100 hover:border-teal-500 hover:bg-teal-50/30 transition-all group relative overflow-hidden">
                      <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 mb-3 tracking-widest">
                        <span className="text-teal-500">{item.type}</span>
                        <span>{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[12px] font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-teal-700 transition-colors uppercase tracking-tight">{item.data.split('\n')[2]?.replace(/[#*]/g, '') || "Clinical Record"}</p>
                      <div className="absolute bottom-0 left-0 w-1 h-0 bg-teal-500 group-hover:h-full transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
