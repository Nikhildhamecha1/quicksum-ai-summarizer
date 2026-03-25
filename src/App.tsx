import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

import { 
  Sparkles, FileText, Copy, Check, RotateCcw, Loader2, 
  Twitter, Linkedin, Share2, Image as ImageIcon, Video, 
  Mic, MicOff, Volume2, Play, Square, X, Upload, MapPin, ExternalLink,
  Sun, Moon, History, Trash2, Link, Facebook, Instagram, MessageCircle,
  Send, Pin, MessageSquare, ArrowBigUp, Ghost, Music
} from 'lucide-react';

type Tab = 'text' | 'image' | 'video' | 'audio' | 'places' | 'generate' | 'generate-video';

interface PlaceHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

const ShareButton = ({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) => (
  <motion.button
    whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.05)' }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    role="menuitem"
    aria-label={`Share on ${label}`}
    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
  >
    <div className={`${color} transition-transform group-hover:scale-110`}>
      {icon}
    </div>
    <span className="text-[10px] font-medium text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 truncate w-full text-center">
      {label}
    </span>
  </motion.button>
);

interface VideoTemplate {
  name: string;
  prompt: string;
  quality: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  duration: number;
  icon: any;
}

const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    name: 'Social Media',
    prompt: 'A high-energy, cinematic travel vlog snippet of a sunset over a tropical beach, vibrant colors, smooth camera movement.',
    quality: '1080p',
    aspectRatio: '9:16',
    duration: 5,
    icon: Instagram
  },
  {
    name: 'Presentation',
    prompt: 'A clean, professional 3D animation of a data chart growing, minimalistic style, soft lighting, corporate blue tones.',
    quality: '1080p',
    aspectRatio: '16:9',
    duration: 5,
    icon: FileText
  },
  {
    name: 'Abstract',
    prompt: 'Slow-moving, ethereal liquid gold waves, abstract patterns, high contrast, luxury feel, 4k resolution style.',
    quality: '720p',
    aspectRatio: '16:9',
    duration: 10,
    icon: Ghost
  },
  {
    name: 'Product',
    prompt: 'A sleek, close-up shot of a luxury watch rotating slowly, dramatic lighting, dark background, highlight reflections.',
    quality: '1080p',
    aspectRatio: '16:9',
    duration: 5,
    icon: Sparkles
  }
];

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quicksum_theme');
      if (saved) return saved as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('quicksum_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [inputText, setInputText] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quicksum_input_text') || '';
    }
    return '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (inputText) {
      setIsSaving(true);
      const timer = setTimeout(() => {
        localStorage.setItem('quicksum_input_text', inputText);
        setIsSaving(false);
        setLastSaved(new Date());
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      localStorage.removeItem('quicksum_input_text');
      setLastSaved(null);
    }
  }, [inputText]);

  const [summary, setSummary] = useState('');
  const [transcription, setTranscription] = useState('');
  const [groundingChunks, setGroundingChunks] = useState<any[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Places History
  const [placeHistory, setPlaceHistory] = useState<PlaceHistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quicksum_place_history');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('quicksum_place_history', JSON.stringify(placeHistory));
  }, [placeHistory]);

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    const newItem: PlaceHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      query: query.trim(),
      timestamp: Date.now(),
    };
    setPlaceHistory(prev => {
      const filtered = prev.filter(item => item.query.toLowerCase() !== query.trim().toLowerCase());
      return [newItem, ...filtered].slice(0, 5);
    });
  };

  const clearHistory = () => {
    setPlaceHistory([]);
  };

  // Multimodal states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recordingIntervalRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputText(prev => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + finalTranscript;
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (err) {
          console.error('Failed to start recognition:', err);
        }
      } else {
        alert('Speech recognition is not supported in this browser.');
      }
    }
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileToBase64 = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      if (onProgress) {
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        };
      }

      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (activeTab === 'audio') {
        setAudioBlob(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (activeTab === 'audio') {
        setAudioBlob(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setError(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSummarize = async () => {
    if (activeTab === 'text' && !inputText.trim()) return;
    if ((activeTab === 'image' || activeTab === 'video') && !selectedFile) return;
    if (activeTab === 'audio' && !audioBlob) return;

    setIsLoading(true);
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessingStatus(
      activeTab === 'text' ? 'Analyzing text...' : 
      activeTab === 'generate' ? 'Generating image...' : 
      activeTab === 'generate-video' ? 'Starting video generation...' :
      'Preparing content...'
    );
    setError(null);
    setSummary('');
    setGroundingChunks([]);
    setGeneratedImageUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      let contents: any;
      let modelName = "gemini-3-flash-preview";
      let systemInstruction = "You are an AI summarizer. Your job is to analyze the provided content and create a short, clear summary in bullet points (max 5).";
      let config: any = { systemInstruction };

      if (activeTab === 'text') {
        setUploadProgress(100);
        setProcessingProgress(30);
        contents = inputText;
        systemInstruction = "You are an AI text summarizer. Your job is to read the text given by the user and create a short and clear summary. Rules: Keep the summary simple and easy to understand. Convert long text into short bullet points. Highlight the most important information. Do not add extra information. Maximum summary length: 5 bullet points.";
        config = { systemInstruction };
        setProcessingProgress(60);
        setProcessingStatus('Generating summary...');
      } else if (activeTab === 'generate') {
        modelName = "gemini-2.5-flash-image";
        setProcessingStatus('Generating image...');
        setUploadProgress(100);
        setProcessingProgress(40);
        contents = {
          parts: [{ text: inputText }]
        };
        config = {
          imageConfig: {
            aspectRatio: "1:1"
          }
        };
      } else if (activeTab === 'image') {
        modelName = "gemini-3.1-pro-preview";
        setProcessingStatus('Reading image...');
        const base64 = await fileToBase64(selectedFile!, (p) => setUploadProgress(p));
        setProcessingStatus('Analyzing image with AI...');
        setProcessingProgress(50);
        contents = {
          parts: [
            { inlineData: { data: base64, mimeType: selectedFile!.type } },
            { text: "Analyze this image and provide a concise summary of what it shows in bullet points." }
          ]
        };
      } else if (activeTab === 'video') {
        modelName = "gemini-3.1-pro-preview";
        config = {
          ...config,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING, description: "Full transcription of the video audio" },
              summary: { type: Type.STRING, description: "Concise summary in bullet points" }
            },
            required: ["transcription", "summary"]
          }
        };

        if (videoUrl) {
          setProcessingStatus('Analyzing video from URL...');
          setUploadProgress(100);
          setProcessingProgress(50);
          contents = `Please transcribe and summarize the video content at this URL: ${videoUrl}.`;
          config = { 
            ...config,
            tools: [{ urlContext: {} }] 
          };
        } else {
          setProcessingStatus('Reading video...');
          const base64 = await fileToBase64(selectedFile!, (p) => setUploadProgress(p));
          setProcessingStatus('Analyzing video with AI...');
          setProcessingProgress(50);
          contents = {
            parts: [
              { inlineData: { data: base64, mimeType: selectedFile!.type } },
              { text: "Please transcribe and summarize this video." }
            ]
          };
        }
      } else if (activeTab === 'audio') {
        modelName = "gemini-3-flash-preview";
        config = {
          ...config,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING, description: "Full transcription of the audio" },
              summary: { type: Type.STRING, description: "Concise summary in bullet points" }
            },
            required: ["transcription", "summary"]
          }
        };

        setProcessingStatus('Processing audio...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob!);
        });
        const base64 = await base64Promise;
        setProcessingStatus('Transcribing and summarizing...');
        setProcessingProgress(50);
        contents = {
          parts: [
            { inlineData: { data: base64, mimeType: audioBlob!.type || 'audio/webm' } },
            { text: "Please transcribe and summarize this audio." }
          ]
        };
      } else if (activeTab === 'generate-video') {
        modelName = "veo-3.1-fast-generate-preview";
        setProcessingStatus('Starting video generation...');
        setUploadProgress(100);
        setProcessingProgress(10);
        
        if (!hasApiKey) {
          setError("Please select an API key to use video generation.");
          setIsLoading(false);
          return;
        }

        try {
          let operation = await ai.models.generateVideos({
            model: modelName,
            prompt: inputText,
            config: {
              numberOfVideos: 1,
              resolution: videoQuality,
              aspectRatio: videoAspectRatio
            }
          });

          setProcessingStatus('Generating video (this may take a few minutes)...');
          setProcessingProgress(30);

          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            setProcessingProgress(prev => Math.min(prev + 5, 95));
          }

          const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (downloadLink) {
            const videoResponse = await fetch(downloadLink, {
              method: 'GET',
              headers: {
                'x-goog-api-key': process.env.API_KEY || '',
              },
            });
            const blob = await videoResponse.blob();
            const url = URL.createObjectURL(blob);
            setGeneratedVideoUrl(url);
            setSummary('Video generated successfully! You can review it below.');
            setIsLoading(false);
            return;
          } else {
            setError("Video generation failed. No download link was received from the server.");
            setIsLoading(false);
            return;
          }
        } catch (err: any) {
          console.error("Video generation error:", err);
          let errorMessage = "Video generation failed.";
          
          if (err.message?.includes("Requested entity was not found")) {
             setHasApiKey(false);
             errorMessage = "API key session expired or invalid. Please select your API key again.";
          } else if (err.message?.toLowerCase().includes("quota")) {
             errorMessage = "Quota exceeded for video generation. Please check your Google Cloud billing or try again later.";
          } else if (err.message?.toLowerCase().includes("safety")) {
             errorMessage = "The prompt was flagged by safety filters. Please try a more neutral description.";
          } else if (err.message?.toLowerCase().includes("invalid")) {
             errorMessage = "Invalid parameters provided. Please check your settings and try again.";
          } else {
             errorMessage = `An error occurred during video generation: ${err.message || "Please try again later."}`;
          }
          
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      } else if (activeTab === 'places') {
        setUploadProgress(100);
        addToHistory(inputText);
        modelName = "gemini-2.5-flash";
        setProcessingStatus('Getting location...');
        setProcessingProgress(20);
        contents = inputText;
        
        const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        let latLng = undefined;
        try {
          const pos = await getPosition();
          latLng = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setProcessingProgress(40);
        } catch (e) {
          console.warn("Geolocation failed, proceeding without location context", e);
        }

        setProcessingStatus('Searching places...');
        setProcessingProgress(60);
        config = {
          tools: [{ googleMaps: {} }],
          toolConfig: latLng ? {
            retrievalConfig: { latLng }
          } : undefined
        };
      }

      setProcessingProgress(80);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config,
      });

      setProcessingProgress(100);

      if (activeTab === 'generate') {
        const parts = response.candidates?.[0]?.content?.parts;
        let imageFound = false;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData) {
              const base64EncodeString = part.inlineData.data;
              setGeneratedImageUrl(`data:image/png;base64,${base64EncodeString}`);
              setSummary('Image generated successfully!');
              imageFound = true;
              break;
            }
          }
        }
        if (!imageFound) {
          setError("Could not generate an image. Please try a different prompt.");
        }
      } else {
        const text = response.text;
        if (text) {
          if (activeTab === 'audio' || activeTab === 'video') {
            try {
              const data = JSON.parse(text);
              setSummary(data.summary);
              setTranscription(data.transcription);
            } catch (e) {
              setSummary(text);
            }
          } else {
            setSummary(text);
          }
          if (activeTab === 'places') {
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
              setGroundingChunks(chunks);
            }
          }
        } else {
          setError("Could not generate a response. Please try again.");
        }
      }
    } catch (err) {
      console.error("Summarization error:", err);
      setError("An error occurred while processing. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async () => {
    if (!summary || isSpeaking) return;

    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Summarized content: ${summary}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          audioRef.current.onended = () => setIsSpeaking(false);
        } else {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play();
          audio.onended = () => setIsSpeaking(false);
        }
      }
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = (keepInput = false) => {
    if (!keepInput) {
      setInputText('');
      localStorage.removeItem('quicksum_input_text');
    }
    setSummary('');
    setTranscription('');
    setGroundingChunks([]);
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAudioBlob(null);
    setVideoUrl('');
    setGeneratedImageUrl(null);
    setGeneratedVideoUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(`Check out this AI summary:\n\n${summary.slice(0, 200)}...`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent('AI Generated Summary');
    const summaryText = encodeURIComponent(summary.slice(0, 200));
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}&summary=${summaryText}`, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`Check out this AI summary:\n\n${summary}\n\nRead more at: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareOnReddit = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent('AI Generated Summary');
    window.open(`https://www.reddit.com/submit?url=${url}&title=${title}`, '_blank');
  };

  const shareOnTelegram = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this AI summary:\n\n${summary}`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  };

  const shareOnPinterest = () => {
    const url = encodeURIComponent(window.location.href);
    const description = encodeURIComponent(summary.slice(0, 200));
    window.open(`https://pinterest.com/pin/create/button/?url=${url}&description=${description}`, '_blank');
  };

  const shareOnSnapchat = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.snapchat.com/scan?attachmentUrl=${url}`, '_blank');
  };

  const shareOnQuora = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.quora.com/share?url=${url}`, '_blank');
  };

  const shareOnInstagram = () => {
    handleCopy();
    window.open('https://www.instagram.com/', '_blank');
  };

  const shareOnTikTok = () => {
    handleCopy();
    window.open('https://www.tiktok.com/', '_blank');
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickSum AI Summary',
          text: summary,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] dark:bg-[#0A0A0A] text-[#1A1A1A] dark:text-[#F5F5F0] font-sans selection:bg-[#5A5A40] selection:text-white transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-12 text-center relative">
          <div className="absolute right-0 top-0 z-50">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="p-3 rounded-2xl bg-white dark:bg-[#1A1A1A] text-[#1A1A1A] dark:text-[#F5F5F0] shadow-md border border-black/5 dark:border-white/10 transition-all hover:shadow-lg active:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </motion.button>
          </div>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 text-[#5A5A40] dark:text-[#A0A080] text-xs font-medium uppercase tracking-wider mb-4"
          >
            <Sparkles size={14} />
            Multimodal Intelligence
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
            className="text-lg text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 max-w-md mx-auto"
          >
            Summarize text, images, videos, and audio with state-of-the-art Gemini AI.
          </motion.p>
        </header>

        <main className="grid gap-8">
          {/* Tab Navigation */}
          <div 
            className="flex flex-wrap justify-center gap-2 mb-4"
            role="tablist"
            aria-label="Summarization modes"
          >
            {[
              { id: 'text', icon: FileText, label: 'Text' },
              { id: 'image', icon: ImageIcon, label: 'Image' },
              { id: 'video', icon: Video, label: 'Video' },
              { id: 'audio', icon: Mic, label: 'Audio' },
              { id: 'places', icon: MapPin, label: 'Places' },
              { id: 'generate', icon: Sparkles, label: 'Image' },
              { id: 'generate-video', icon: Video, label: 'Generate Video' },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setActiveTab(tab.id as Tab);
                  handleReset(true);
                }}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all
                  focus:outline-none focus:ring-2 focus:ring-[#5A5A40]
                  ${activeTab === tab.id 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'bg-white dark:bg-[#1A1A1A] text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2A] border border-black/5 dark:border-white/5'}
                `}
              >
                <tab.icon size={16} aria-hidden="true" />
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/5"
          >
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]/70 dark:text-[#F5F5F0]/70 uppercase tracking-wide">
                {activeTab === 'text' && <FileText size={16} />}
                {activeTab === 'image' && <ImageIcon size={16} />}
                {activeTab === 'video' && <Video size={16} />}
                {activeTab === 'audio' && <Mic size={16} />}
                {activeTab === 'places' && <MapPin size={16} />}
                {activeTab === 'generate' && <Sparkles size={16} />}
                {activeTab === 'generate-video' && <Video size={16} />}
                Source {(activeTab === 'generate' || activeTab === 'generate-video') ? 'Prompt' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </label>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {(activeTab === 'text' || activeTab === 'places' || activeTab === 'generate' || activeTab === 'generate-video') && (
                  <div className="space-y-4 relative">
                    {activeTab === 'generate-video' && !hasApiKey && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl p-6 text-center">
                        <Video size={48} className="text-[#5A5A40] mb-4 opacity-20" />
                        <h3 className="text-lg font-serif mb-2">Video Generation Required</h3>
                        <p className="text-sm text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 mb-6 max-w-xs">
                          To generate videos, you need to select a paid API key from your Google Cloud project.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleOpenKeyDialog}
                          className="px-6 py-3 bg-[#5A5A40] text-white rounded-full text-sm font-medium shadow-lg shadow-[#5A5A40]/20"
                        >
                          Select API Key
                        </motion.button>
                        <a 
                          href="https://ai.google.dev/gemini-api/docs/billing" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-4 text-xs text-[#5A5A40] hover:underline"
                        >
                          Learn about billing
                        </a>
                      </div>
                    )}
                    {activeTab === 'generate-video' && hasApiKey && (
                      <div className="space-y-2 mb-4">
                        <label className="text-[10px] font-bold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-widest">Quick Templates</label>
                        <div className="flex flex-wrap gap-2">
                          {VIDEO_TEMPLATES.map((template) => (
                            <motion.button
                              key={template.name}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setInputText(template.prompt);
                                setVideoQuality(template.quality);
                                setVideoAspectRatio(template.aspectRatio);
                                setVideoDuration(template.duration);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#1A1A1A] border border-black/5 dark:border-white/5 text-xs font-medium text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 hover:bg-[#F5F5F0] dark:hover:bg-[#2A2A2A] transition-all"
                            >
                              <template.icon size={12} />
                              {template.name}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea
                      id="input-text"
                      aria-label={
                        activeTab === 'places' ? "Places search query" : 
                        activeTab === 'generate' ? "Image prompt" : 
                        activeTab === 'generate-video' ? "Video prompt" :
                        "Text to summarize"
                      }
                      className="w-full h-48 md:h-64 bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed placeholder:text-[#1A1A1A]/20 dark:placeholder:text-[#F5F5F0]/20 text-[#1A1A1A] dark:text-[#F5F5F0] focus:outline-none"
                      placeholder={
                        activeTab === 'places' ? "Ask about restaurants, landmarks, or places nearby..." : 
                        activeTab === 'generate' ? "Describe the image you want to create (e.g., 'A futuristic city at sunset')..." :
                        activeTab === 'generate-video' ? "Describe the video you want to create (e.g., 'A neon hologram of a cat driving at top speed')..." :
                        "Paste your long article, essay, or notes here..."
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={activeTab === 'generate-video' && !hasApiKey}
                    />

                    <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-none">
                      <AnimatePresence mode="wait">
                        {isSaving ? (
                          <motion.div
                            key="saving"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 text-[10px] font-medium text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40"
                          >
                            <Loader2 size={10} className="animate-spin" />
                            Saving...
                          </motion.div>
                        ) : lastSaved ? (
                          <motion.div
                            key="saved"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 text-[10px] font-medium text-[#5A5A40] dark:text-[#A0A080]"
                          >
                            <Check size={10} />
                            Saved
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {activeTab === 'generate-video' && hasApiKey && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 rounded-2xl bg-[#F5F5F0] dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-4"
                      >
                        <div className="flex flex-wrap gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-widest">Quality</label>
                            <div className="flex gap-2">
                              {(['720p', '1080p'] as const).map((q) => (
                                <button
                                  key={q}
                                  onClick={() => setVideoQuality(q)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${videoQuality === q ? 'bg-[#5A5A40] text-white shadow-sm' : 'bg-white dark:bg-[#1A1A1A] text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 border border-black/5 dark:border-white/5 hover:bg-white/80'}`}
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-widest">Aspect Ratio</label>
                            <div className="flex gap-2">
                              {(['16:9', '9:16'] as const).map((ar) => (
                                <button
                                  key={ar}
                                  onClick={() => setVideoAspectRatio(ar)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${videoAspectRatio === ar ? 'bg-[#5A5A40] text-white shadow-sm' : 'bg-white dark:bg-[#1A1A1A] text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 border border-black/5 dark:border-white/5 hover:bg-white/80'}`}
                                >
                                  {ar === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-widest">Duration</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={videoDuration} 
                                onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                                className="w-24 accent-[#5A5A40] cursor-pointer"
                              />
                              <span className="text-xs font-medium text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 min-w-[20px]">{videoDuration}s</span>
                              <span className="text-[9px] text-[#1A1A1A]/30 dark:text-[#F5F5F0]/30 italic">(Approximate)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="absolute bottom-2 right-2 flex items-center gap-3">
                      {isListening && (
                        <motion.div 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 bg-red-500/10 dark:bg-red-500/20 px-3 py-1.5 rounded-full"
                        >
                          <div className="flex gap-0.5 items-center h-3">
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                animate={{ height: [4, 12, 4] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                                className="w-1 bg-red-500 rounded-full"
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Listening</span>
                        </motion.div>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        className={`p-3 rounded-full shadow-lg transition-all ${
                          isListening 
                            ? 'bg-red-500 text-white' 
                            : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30]'
                        }`}
                        title={isListening ? "Stop Listening" : "Start Voice-to-Text"}
                      >
                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                      </motion.button>
                    </div>
                    
                    {activeTab === 'places' && placeHistory.length > 0 && (
                      <div className="pt-4 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-semibold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-wider flex items-center gap-2">
                            <History size={14} />
                            Recent Searches
                          </h3>
                          <button 
                            onClick={clearHistory}
                            className="text-xs text-red-500/60 hover:text-red-500 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {placeHistory.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setInputText(item.query)}
                              className="px-3 py-1.5 rounded-full bg-[#F5F5F0] dark:bg-white/5 text-xs text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60 hover:bg-[#5A5A40]/10 dark:hover:bg-white/10 transition-colors border border-black/5 dark:border-white/5"
                            >
                              {item.query}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'video' && (
                  <div className="space-y-6">
                    {!previewUrl && !videoUrl ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label 
                          className="flex flex-col items-center justify-center h-72 border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 rounded-3xl cursor-pointer hover:bg-[#5A5A40]/5 dark:hover:bg-[#5A5A40]/10 hover:border-[#5A5A40]/30 transition-all group focus-within:ring-2 focus-within:ring-[#5A5A40]"
                          aria-label="Upload video file"
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                        >
                          <div className="flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-16 h-16 mb-4 rounded-2xl bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080] group-hover:scale-110 transition-transform">
                              <Upload className="w-8 h-8" aria-hidden="true" />
                            </div>
                            <p className="mb-2 text-base font-medium text-[#1A1A1A] dark:text-[#F5F5F0]">
                              Upload Video
                            </p>
                            <p className="text-sm text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 mb-4">
                              Drag and drop or click to browse
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {['MP4', 'WebM', 'OGG'].map(ext => (
                                <span key={ext} className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40">
                                  {ext}
                                </span>
                              ))}
                            </div>
                          </div>
                          <input 
                            type="file" 
                            className="sr-only" 
                            accept="video/*"
                            onChange={handleFileChange}
                          />
                        </label>

                        <div className="flex flex-col items-center justify-center h-72 border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 rounded-3xl bg-[#F5F5F0]/30 dark:bg-white/5 p-8 transition-all hover:border-[#5A5A40]/30">
                          <div className="w-16 h-16 mb-4 rounded-2xl bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080]">
                            <Link size={28} />
                          </div>
                          <p className="mb-2 text-base font-medium text-[#1A1A1A] dark:text-[#F5F5F0]">Video URL</p>
                          <p className="text-sm text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 mb-6 text-center">Paste a direct link or YouTube URL</p>
                          <div className="w-full relative">
                            <input 
                              type="url"
                              aria-label="Video URL"
                              placeholder="https://example.com/video.mp4"
                              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#2A2A2A] border border-black/5 dark:border-white/10 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all shadow-sm"
                              value={videoUrl}
                              onChange={(e) => setVideoUrl(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden bg-[#F5F5F0] dark:bg-[#2A2A2A] h-64 flex items-center justify-center">
                        {videoUrl ? (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080]">
                              <Video size={32} />
                            </div>
                            <div className="text-center px-6">
                              <p className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F5F0] truncate max-w-xs">
                                {videoUrl}
                              </p>
                              <p className="text-xs text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 mt-1">
                                Video URL selected
                              </p>
                            </div>
                          </div>
                        ) : (
                          <video src={previewUrl!} controls className="max-h-full" />
                        )}
                        <button 
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); setVideoUrl(''); }}
                          className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'image' && (
                  <div className="relative group">
                    {!previewUrl ? (
                      <label 
                        className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 rounded-3xl cursor-pointer hover:bg-[#5A5A40]/5 dark:hover:bg-[#5A5A40]/10 hover:border-[#5A5A40]/30 transition-all group focus-within:ring-2 focus-within:ring-[#5A5A40]"
                        aria-label="Upload image file"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                      >
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <div className="w-20 h-20 mb-6 rounded-3xl bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080] group-hover:scale-110 transition-transform shadow-sm">
                            <Upload className="w-10 h-10" aria-hidden="true" />
                          </div>
                          <p className="mb-2 text-lg font-medium text-[#1A1A1A] dark:text-[#F5F5F0]">
                            Drop your image here
                          </p>
                          <p className="text-sm text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 mb-6">
                            or click to browse from your device
                          </p>
                          <div className="flex flex-wrap justify-center gap-3">
                            {['PNG', 'JPG', 'WEBP', 'GIF'].map(ext => (
                              <span key={ext} className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 border border-black/5 dark:border-white/5">
                                {ext}
                              </span>
                            ))}
                          </div>
                        </div>
                        <input 
                          type="file" 
                          className="sr-only" 
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden bg-[#F5F5F0] dark:bg-[#2A2A2A] h-64 flex items-center justify-center">
                        <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
                        <button 
                          onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                          className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'audio' && (
                  <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-[#1A1A1A]/10 dark:border-white/10 rounded-3xl bg-[#F5F5F0]/30 dark:bg-white/5 transition-all hover:border-[#5A5A40]/30">
                    {!audioBlob && !isRecording ? (
                      <div className="flex flex-col md:flex-row items-center gap-12 p-8">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={startRecording}
                          className="flex flex-col items-center gap-4 group focus:outline-none focus:ring-2 focus:ring-[#5A5A40] rounded-3xl p-6 hover:bg-[#5A5A40]/5 dark:hover:bg-[#5A5A40]/10 transition-colors"
                          aria-label="Start audio recording"
                        >
                          <div className="w-24 h-24 rounded-full bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080] group-hover:scale-110 transition-transform shadow-sm">
                            <Mic size={40} aria-hidden="true" />
                          </div>
                          <div className="text-center">
                            <p className="text-base font-medium text-[#1A1A1A] dark:text-[#F5F5F0]">Record Audio</p>
                            <p className="text-xs text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 mt-1">Capture from microphone</p>
                          </div>
                        </motion.button>

                        <div className="hidden md:block w-px h-32 bg-black/5 dark:bg-white/5" aria-hidden="true" />

                        <label 
                          className="flex flex-col items-center gap-4 group cursor-pointer focus-within:ring-2 focus-within:ring-[#5A5A40] rounded-3xl p-6 hover:bg-[#5A5A40]/5 dark:hover:bg-[#5A5A40]/10 transition-colors"
                          aria-label="Upload audio file"
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                        >
                          <div className="w-24 h-24 rounded-full bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 flex items-center justify-center text-[#5A5A40] dark:text-[#A0A080] group-hover:scale-110 transition-transform shadow-sm">
                            <Upload size={40} aria-hidden="true" />
                          </div>
                          <div className="text-center">
                            <p className="text-base font-medium text-[#1A1A1A] dark:text-[#F5F5F0]">Upload File</p>
                            <div className="flex justify-center gap-1.5 mt-2">
                              {['MP3', 'WAV', 'M4A'].map(ext => (
                                <span key={ext} className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[9px] font-bold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40">
                                  {ext}
                                </span>
                              ))}
                            </div>
                          </div>
                          <input 
                            type="file" 
                            className="sr-only" 
                            accept="audio/*"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                    ) : isRecording ? (
                      <div className="flex flex-col items-center gap-6">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2 text-red-500 font-medium animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            Recording...
                          </div>
                          <div className="text-2xl font-mono text-[#1A1A1A] dark:text-[#F5F5F0]">
                            {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className="flex gap-1 items-end h-12">
                          {[...Array(12)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ 
                                height: [12, Math.random() * 40 + 12, 12],
                                opacity: [0.5, 1, 0.5]
                              }}
                              transition={{ 
                                repeat: Infinity, 
                                duration: 0.4 + Math.random() * 0.4, 
                                delay: i * 0.05 
                              }}
                              className="w-1.5 bg-[#5A5A40] dark:bg-[#A0A080] rounded-full"
                            />
                          ))}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={stopRecording}
                          className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                        >
                          <Square size={16} fill="currentColor" />
                          Stop Recording
                        </motion.button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        <audio src={previewUrl!} controls className="w-64" />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setAudioBlob(null); setPreviewUrl(null); }}
                          className="text-sm text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 hover:text-red-500 transition-colors"
                        >
                          Discard and try again
                        </motion.button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex justify-end gap-3">
              {(inputText || summary || selectedFile || audioBlob) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleReset()}
                  disabled={isLoading}
                  aria-label="Clear all inputs and results"
                  className="px-6 py-4 rounded-full font-medium text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 hover:text-[#5A5A40] dark:hover:text-[#A0A080] hover:bg-[#5A5A40]/5 dark:hover:bg-white/5 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
                >
                  <RotateCcw size={18} aria-hidden="true" />
                  Clear All
                </motion.button>
              )}
              <motion.button
                whileHover={!isLoading && ((activeTab === 'text' || activeTab === 'generate' || activeTab === 'places') ? inputText.trim() : true) ? { scale: 1.02 } : {}}
                whileTap={!isLoading && ((activeTab === 'text' || activeTab === 'generate' || activeTab === 'places') ? inputText.trim() : true) ? { scale: 0.98 } : {}}
                onClick={handleSummarize}
                disabled={isLoading || ((activeTab === 'text' || activeTab === 'generate' || activeTab === 'places') && !inputText.trim()) || (activeTab === 'image' && !selectedFile) || (activeTab === 'video' && !selectedFile && !videoUrl) || (activeTab === 'audio' && !audioBlob)}
                aria-label={isLoading ? "Processing" : activeTab === 'generate' ? "Generate image" : "Summarize content"}
                className={`
                  relative overflow-hidden group px-8 py-4 rounded-full font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]
                  ${isLoading || ((activeTab === 'text' || activeTab === 'generate' || activeTab === 'places' || activeTab === 'generate-video') && !inputText.trim()) || ((activeTab === 'image' || activeTab === 'video') && !selectedFile) || (activeTab === 'audio' && !audioBlob) || (activeTab === 'generate-video' && !hasApiKey)
                    ? 'bg-[#1A1A1A]/10 dark:bg-white/5 text-[#1A1A1A]/30 dark:text-white/20 cursor-not-allowed' 
                    : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] shadow-lg shadow-[#5A5A40]/20'}
                `}
              >
                <span className="flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      {(activeTab === 'generate' || activeTab === 'generate-video') ? 'Generating...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      {activeTab === 'audio' ? 'Transcribe & Summarize' : 
                       activeTab === 'places' ? 'Find & Analyze' : 
                       activeTab === 'generate' ? 'Generate Image' : 
                       activeTab === 'generate-video' ? 'Generate Video' :
                       'Summarize'}
                      <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>
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
                aria-live="polite"
                className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-medium text-[#1A1A1A]/70 dark:text-[#F5F5F0]/70 uppercase tracking-wide">
                    {activeTab === 'generate' ? 'Generated Image' : activeTab === 'generate-video' ? 'Generated Video' : 'Summary'}
                  </h2>
                  {summary && (
                    <div className="flex items-center gap-2 relative">
                      <div className="hidden md:flex items-center gap-1 mr-2 border-r border-black/5 dark:border-white/5 pr-2">
                        {activeTab !== 'generate' && (
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleTTS}
                            disabled={isSpeaking}
                            aria-label={isSpeaking ? "Stop listening" : "Listen to summary"}
                            aria-pressed={isSpeaking}
                            className={`p-1.5 rounded-lg hover:bg-[#F5F5F0] dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5A5A40] ${isSpeaking ? 'text-[#5A5A40] dark:text-[#A0A080] animate-pulse' : 'text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 hover:text-[#5A5A40] dark:hover:text-[#A0A080]'}`}
                          >
                            <Volume2 size={16} aria-hidden="true" />
                          </motion.button>
                        )}
                        
                        <div className="relative">
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            aria-label="Share Summary"
                            aria-expanded={showShareMenu}
                            aria-haspopup="true"
                            className={`p-1.5 rounded-lg hover:bg-[#F5F5F0] dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#5A5A40] ${showShareMenu ? 'text-[#5A5A40] dark:text-[#A0A080] bg-[#F5F5F0] dark:bg-white/5' : 'text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 hover:text-[#5A5A40] dark:hover:text-[#A0A080]'}`}
                          >
                            <Share2 size={16} aria-hidden="true" />
                          </motion.button>

                          <AnimatePresence>
                            {showShareMenu && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setShowShareMenu(false)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  role="menu"
                                  aria-label="Share options"
                                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#2A2A2A] rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 p-4 z-50 grid grid-cols-4 gap-2"
                                >
                                  <ShareButton icon={<Twitter size={18} />} label="Twitter" onClick={() => { shareOnTwitter(); setShowShareMenu(false); }} color="text-[#1DA1F2]" />
                                  <ShareButton icon={<Linkedin size={18} />} label="LinkedIn" onClick={() => { shareOnLinkedIn(); setShowShareMenu(false); }} color="text-[#0A66C2]" />
                                  <ShareButton icon={<Facebook size={18} />} label="Facebook" onClick={() => { shareOnFacebook(); setShowShareMenu(false); }} color="text-[#1877F2]" />
                                  <ShareButton icon={<MessageCircle size={18} />} label="WhatsApp" onClick={() => { shareOnWhatsApp(); setShowShareMenu(false); }} color="text-[#25D366]" />
                                  <ShareButton icon={<ArrowBigUp size={18} />} label="Reddit" onClick={() => { shareOnReddit(); setShowShareMenu(false); }} color="text-[#FF4500]" />
                                  <ShareButton icon={<Send size={18} />} label="Telegram" onClick={() => { shareOnTelegram(); setShowShareMenu(false); }} color="text-[#0088CC]" />
                                  <ShareButton icon={<Pin size={18} />} label="Pinterest" onClick={() => { shareOnPinterest(); setShowShareMenu(false); }} color="text-[#BD081C]" />
                                  <ShareButton icon={<Ghost size={18} />} label="Snapchat" onClick={() => { shareOnSnapchat(); setShowShareMenu(false); }} color="text-[#FFFC00]" />
                                  <ShareButton icon={<MessageSquare size={18} />} label="Quora" onClick={() => { shareOnQuora(); setShowShareMenu(false); }} color="text-[#B92B27]" />
                                  <ShareButton icon={<Instagram size={18} />} label="Instagram" onClick={() => { shareOnInstagram(); setShowShareMenu(false); }} color="text-[#E4405F]" />
                                  <ShareButton icon={<Music size={18} />} label="TikTok" onClick={() => { shareOnTikTok(); setShowShareMenu(false); }} color="text-[#000000] dark:text-white" />
                                  <ShareButton icon={<Share2 size={18} />} label="More" onClick={() => { handleWebShare(); setShowShareMenu(false); }} color="text-[#5A5A40] dark:text-[#A0A080]" />
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F5F5F0] dark:hover:bg-white/5 transition-colors text-sm text-[#5A5A40] dark:text-[#A0A080]"
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={copied ? 'check' : 'copy'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </motion.div>
                        </AnimatePresence>
                        {copied ? 'Copied' : 'Copy'}
                      </motion.button>
                    </div>
                  )}
                </div>

                {error ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    role="alert"
                    className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-900/30"
                  >
                    {error}
                  </motion.div>
                ) : isLoading ? (
                  <div 
                    className="space-y-8"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    {/* Upload Progress */}
                    {(activeTab !== 'text' && activeTab !== 'places') && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs font-medium text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-wider">
                          <span className="flex items-center gap-2">
                            {uploadProgress === 100 ? <Check size={12} className="text-green-500" aria-hidden="true" /> : <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                            File Upload
                          </span>
                          <span aria-label={`Upload progress: ${uploadProgress}%`}>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#F5F5F0] dark:bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                            className={`h-full transition-colors duration-500 ${uploadProgress === 100 ? 'bg-green-500' : 'bg-[#5A5A40] dark:bg-[#A0A080]'}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* AI Processing Progress */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-medium text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-wider">
                        <span className="flex items-center gap-2">
                          {processingProgress === 100 ? <Check size={12} className="text-green-500" aria-hidden="true" /> : <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                          {processingStatus}
                        </span>
                        <span aria-label={`Processing progress: ${processingProgress}%`}>{processingProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#F5F5F0] dark:bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={processingProgress} aria-valuemin={0} aria-valuemax={100}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${processingProgress}%` }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                          className={`h-full transition-colors duration-500 ${processingProgress === 100 ? 'bg-green-500' : 'bg-[#5A5A40] dark:bg-[#A0A080]'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
                      <div className="h-4 bg-[#F5F5F0] dark:bg-white/5 rounded-full w-3/4 animate-pulse" />
                      <div className="h-4 bg-[#F5F5F0] dark:bg-white/5 rounded-full w-full animate-pulse" />
                      <div className="h-4 bg-[#F5F5F0] dark:bg-white/5 rounded-full w-2/3 animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <div 
                    className="markdown-body prose prose-stone dark:prose-invert max-w-none text-[#1A1A1A] dark:text-[#F5F5F0]"
                    aria-live="polite"
                  >
                    {generatedImageUrl && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 shadow-lg not-prose"
                      >
                        <img 
                          src={generatedImageUrl} 
                          alt="Generated AI content" 
                          className="w-full h-auto object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="p-4 bg-[#F5F5F0] dark:bg-white/5 flex justify-between items-center">
                          <span className="text-sm text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60">AI Generated Image</span>
                          <a 
                            href={generatedImageUrl} 
                            download="generated-image.png"
                            className="text-sm font-medium text-[#5A5A40] dark:text-[#A0A080] hover:underline flex items-center gap-1"
                          >
                            <Upload size={14} className="rotate-180" />
                            Download
                          </a>
                        </div>
                      </motion.div>
                    )}

                    {generatedVideoUrl && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 shadow-lg not-prose"
                      >
                        <video 
                          src={generatedVideoUrl} 
                          controls 
                          className="w-full h-auto aspect-video object-cover"
                        />
                        <div className="p-4 bg-[#F5F5F0] dark:bg-white/5 flex justify-between items-center">
                          <span className="text-sm text-[#1A1A1A]/60 dark:text-[#F5F5F0]/60">AI Generated Video</span>
                          <div className="flex items-center gap-4">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleSummarize}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5A5A40]/10 dark:bg-[#5A5A40]/20 text-[#5A5A40] dark:text-[#A0A080] text-xs font-medium hover:bg-[#5A5A40]/20 transition-colors"
                            >
                              <RotateCcw size={14} />
                              Regenerate
                            </motion.button>
                            <a 
                              href={generatedVideoUrl} 
                              download="generated-video.mp4"
                              className="text-sm font-medium text-[#5A5A40] dark:text-[#A0A080] hover:underline flex items-center gap-1"
                            >
                              <Upload size={14} className="rotate-180" />
                              Download
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <Markdown>{summary}</Markdown>

                    {transcription && (
                      <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 not-prose">
                        <h3 className="text-xs font-semibold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <FileText size={14} />
                          Full Transcription
                        </h3>
                        <div className="p-6 rounded-2xl bg-[#F5F5F0] dark:bg-white/5 text-[#1A1A1A]/80 dark:text-[#F5F5F0]/80 text-sm leading-relaxed whitespace-pre-wrap">
                          {transcription}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {groundingChunks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5">
                    <h3 className="text-xs font-semibold text-[#1A1A1A]/40 dark:text-[#F5F5F0]/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <MapPin size={14} />
                      Sources from Google Maps
                    </h3>
                    <div className="grid gap-3">
                      {groundingChunks.map((chunk, idx) => {
                        if (chunk.maps) {
                          return (
                            <motion.a 
                              key={idx}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              href={chunk.maps.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-xl bg-[#F5F5F0] dark:bg-white/5 hover:bg-[#5A5A40]/5 dark:hover:bg-white/10 transition-colors group"
                            >
                              <span className="text-sm font-medium text-[#5A5A40] dark:text-[#A0A080]">{chunk.maps.title || 'View on Maps'}</span>
                              <ExternalLink size={14} className="text-[#1A1A1A]/20 dark:text-white/20 group-hover:text-[#5A5A40] dark:group-hover:text-[#A0A080] transition-colors" />
                            </motion.a>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 text-center text-[#1A1A1A]/30 dark:text-[#F5F5F0]/20 text-xs uppercase tracking-[0.2em]">
          Built with Gemini AI &bull; Simple &bull; Fast &bull; Clear
        </footer>
      </div>
    </div>
  );
}
