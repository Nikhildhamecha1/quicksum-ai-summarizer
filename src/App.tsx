import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, FileText, Copy, Check, RotateCcw, Loader2 } from 'lucide-react';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);
    setSummary('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: inputText,
        config: {
          systemInstruction: "You are an AI text summarizer. Your job is to read the text given by the user and create a short and clear summary. Rules: Keep the summary simple and easy to understand. Convert long text into short bullet points. Highlight the most important information. Do not add extra information. Maximum summary length: 5 bullet points.",
        },
      });

      const text = response.text;
      if (text) {
        setSummary(text);
      } else {
        setError("Could not generate a summary. Please try again.");
      }
    } catch (err) {
      console.error("Summarization error:", err);
      setError("An error occurred while summarizing. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInputText('');
    setSummary('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-medium uppercase tracking-wider mb-4"
          >
            <Sparkles size={14} />
            AI Powered
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-serif font-light tracking-tight mb-4"
          >
            QuickSum
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-[#1A1A1A]/60 max-w-md mx-auto"
          >
            Transform complex text into clear, actionable bullet points in seconds.
          </motion.p>
        </header>

        <main className="grid gap-8">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5"
          >
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="input-text" className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]/70 uppercase tracking-wide">
                <FileText size={16} />
                Source Text
              </label>
              {inputText && (
                <button 
                  onClick={handleReset}
                  className="text-xs text-[#1A1A1A]/40 hover:text-[#5A5A40] transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="input-text"
              className="w-full h-48 md:h-64 bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed placeholder:text-[#1A1A1A]/20"
              placeholder="Paste your long article, essay, or notes here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSummarize}
                disabled={isLoading || !inputText.trim()}
                className={`
                  relative overflow-hidden group px-8 py-4 rounded-full font-medium transition-all duration-300
                  ${isLoading || !inputText.trim() 
                    ? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/30 cursor-not-allowed' 
                    : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] shadow-lg shadow-[#5A5A40]/20 active:scale-95'}
                `}
              >
                <span className="flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      Summarize
                      <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </motion.div>

          {/* Output Section */}
          <AnimatePresence mode="wait">
            {(summary || error || isLoading) && (
              <motion.div 
                key="output"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-medium text-[#1A1A1A]/70 uppercase tracking-wide">
                    Summary
                  </h2>
                  {summary && (
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F5F5F0] transition-colors text-sm text-[#5A5A40]"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                {error ? (
                  <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">
                    {error}
                  </div>
                ) : isLoading ? (
                  <div className="space-y-4">
                    <div className="h-4 bg-[#F5F5F0] rounded-full w-3/4 animate-pulse" />
                    <div className="h-4 bg-[#F5F5F0] rounded-full w-full animate-pulse" />
                    <div className="h-4 bg-[#F5F5F0] rounded-full w-2/3 animate-pulse" />
                    <div className="h-4 bg-[#F5F5F0] rounded-full w-5/6 animate-pulse" />
                  </div>
                ) : (
                  <div className="markdown-body prose prose-stone max-w-none">
                    <Markdown>{summary}</Markdown>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 text-center text-[#1A1A1A]/30 text-xs uppercase tracking-[0.2em]">
          Built with Gemini AI &bull; Simple &bull; Fast &bull; Clear
        </footer>
      </div>
    </div>
  );
}
