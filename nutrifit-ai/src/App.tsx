import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, Home, Target, Dumbbell, Languages, CheckCircle2, 
  Loader2, Play, Pause, X, Image as ImageIcon, 
  Bell, ArrowUpRight, LayoutGrid, User, Settings,
  ArrowDownLeft, Activity, Droplets, Zap, BookOpen, Volume2,
  Mic, MicOff, Calculator, Download, Wand2, Send, MessageCircle,
  Sparkle
} from 'lucide-react';
import { cn } from './lib/utils';
import { UserProfile, DailyGoal, FoodAnalysis, Language, BodyType, FitnessGoal } from './types';
import { analyzeFoodImage, calculateRequirements, translateContent, getWorkoutPlan, extractTextFromImage, generateSpeech, chatWithAI, generateImage } from './services/aiService';
import Markdown from 'react-markdown';
import { ScientificCalculator } from './components/ScientificCalculator';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'camera' | 'target' | 'workout' | 'reading' | 'profile' | 'chat' | 'calculator'>('home');
  const [language, setLanguage] = useState<Language>('English');
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [performance, setPerformance] = useState({
    logins: 12,
    shots: 0,
    score: 0
  });
  const [profile, setProfile] = useState<UserProfile>({
    weight: 70,
    bodyType: 'Mesomorph',
    goal: 'General Health',
    isSetupComplete: false
  });
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [translatedAnalysis, setTranslatedAnalysis] = useState<any>(null);
  
  // Reading Section State
  const [extractedText, setExtractedText] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Home Section State
  const [tempWeight, setTempWeight] = useState(profile.weight);
  const [tempBodyType, setTempBodyType] = useState<BodyType>(profile.bodyType);
  const [tempGoal, setTempGoal] = useState<FitnessGoal>(profile.goal);

  // Target Section State
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalHours, setNewGoalHours] = useState(1);

  // Timer logic
  useEffect(() => {
    const interval = setInterval(() => {
      setGoals(prev => prev.map(goal => {
        if (goal.startTime && !goal.isCompleted && goal.remainingSeconds > 0) {
          return { ...goal, remainingSeconds: goal.remainingSeconds - 1 };
        }
        return goal;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSetupComplete = async () => {
    setLoading(true);
    try {
      const requirements = await calculateRequirements(tempWeight, tempBodyType, tempGoal);
      const plan = await getWorkoutPlan(tempBodyType, tempGoal);
      setProfile({
        weight: tempWeight,
        bodyType: tempBodyType,
        goal: tempGoal,
        dailyRequirements: requirements,
        isSetupComplete: true
      });
      setWorkoutPlan(plan);
    } catch (error: any) {
      setError(error.message || "Failed to complete setup. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'food' | 'reading') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setLoading(true);
      try {
        if (mode === 'food') {
          const result = await analyzeFoodImage(base64);
          setAnalysis(result);
          setPerformance(prev => ({ ...prev, shots: prev.shots + 1 }));
          if (language !== 'English') {
            const translated = await translateContent(JSON.stringify(result), language);
            setTranslatedAnalysis(JSON.parse(translated));
          }
        } else {
          const text = await extractTextFromImage(base64);
          setExtractedText(text);
          if (text) {
            const audio = await generateSpeech(text);
            setAudioBase64(audio);
          }
        }
      } catch (error: any) {
        setError(error.message || "Failed to process image. Please try again.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const playAudio = async () => {
    if (!audioBase64) return;
    
    try {
      setIsPlaying(true);
      
      // Gemini TTS returns raw 16-bit PCM at 24kHz
      const binaryString = atob(audioBase64);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      
      for (let i = 0; i < len; i += 2) {
        // PCM is little-endian
        bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, bytes.length, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < bytes.length; i++) {
        // Convert 16-bit PCM to float [-1, 1]
        channelData[i] = bytes[i] / 32768;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (error) {
      console.error("Audio playback failed:", error);
      setIsPlaying(false);
    }
  };

  const addGoal = () => {
    if (!newGoalTitle) return;
    const goal: DailyGoal = {
      id: Math.random().toString(36).substr(2, 9),
      title: newGoalTitle,
      durationHours: newGoalHours,
      startTime: null,
      remainingSeconds: newGoalHours * 3600,
      isCompleted: false
    };
    setGoals([...goals, goal]);
    setNewGoalTitle('');
  };

  const toggleGoalTimer = (id: string) => {
    setGoals(prev => prev.map(g => {
      if (g.id === id) {
        return { ...g, startTime: g.startTime ? null : Date.now() };
      }
      return g;
    }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderHeader = (title: string) => (
    <div className="flex items-center justify-between p-6 pt-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-brand-green border border-white/10">
          AS
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 relative">
          <Bell size={20} className="text-white/70" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-brand-dark" />
        </button>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('Account')}
      
      <div className="px-6">
        <div className="green-gradient-card p-8 h-56 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="flex justify-between items-start">
            <div className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {profile.goal}
            </div>
            <div className="w-10 h-6 bg-black/20 rounded-md border border-white/20 flex items-center justify-center">
              <div className="w-4 h-3 border border-white/30 rounded-sm" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium opacity-70 mb-1">Daily Calories Goal</p>
            <h2 className="text-4xl font-bold tracking-tighter">
              {profile.dailyRequirements?.calories || '2,500'}
            </h2>
            <p className="text-[10px] font-bold opacity-50 mt-1 uppercase tracking-widest">Kcal / Day</p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Requirements</h3>
          <button className="text-brand-green text-xs font-bold">See all</button>
        </div>

        <div className="space-y-3">
          <div className="list-item">
            <div className="flex items-center gap-4">
              <div className="icon-circle text-brand-green">
                <Droplets size={20} />
              </div>
              <div>
                <p className="font-bold">Water Intake</p>
                <p className="text-xs text-white/40">Daily Hydration</p>
              </div>
            </div>
            <p className="font-bold text-brand-green">{profile.dailyRequirements?.water || '3.5 L'}</p>
          </div>

          <div className="list-item">
            <div className="flex items-center gap-4">
              <div className="icon-circle text-brand-green">
                <Zap size={20} />
              </div>
              <div>
                <p className="font-bold">Protein</p>
                <p className="text-xs text-white/40">Muscle Repair</p>
              </div>
            </div>
            <p className="font-bold text-brand-green">{profile.dailyRequirements?.protein || '140g'}</p>
          </div>

          <div className="list-item">
            <div className="flex items-center gap-4">
              <div className="icon-circle text-brand-green">
                <Activity size={20} />
              </div>
              <div>
                <p className="font-bold">Calcium</p>
                <p className="text-xs text-white/40">Bone Health</p>
              </div>
            </div>
            <p className="font-bold text-brand-green">{profile.dailyRequirements?.calcium || '1000mg'}</p>
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="dark-gradient-card p-6 space-y-6">
          <h3 className="font-bold">Profile Setup</h3>
          <div className="space-y-4">
            <input 
              type="number" 
              value={tempWeight} 
              onChange={(e) => setTempWeight(Number(e.target.value))}
              placeholder="Weight (kg)"
              className="apple-input-v2 w-full"
            />
            <div className="grid grid-cols-3 gap-2">
              {(['Ectomorph', 'Mesomorph', 'Endomorph'] as BodyType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTempBodyType(type)}
                  className={cn(
                    "py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                    tempBodyType === type ? "bg-brand-green text-black border-brand-green" : "bg-white/5 text-white border-white/10"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <button 
              onClick={handleSetupComplete}
              disabled={loading}
              className="apple-button-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Update Profile"}
              <ArrowUpRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCamera = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('Scanner')}
      
      <div className="px-6">
        <div className="green-gradient-card p-8 h-48 flex flex-col justify-center items-center text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Analyze Food</h2>
          <p className="text-xs font-medium opacity-70">Take a photo or upload from gallery to get instant nutritional data</p>
        </div>
      </div>

      <div className="px-6 grid grid-cols-2 gap-4">
        <label className="dark-gradient-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all border-white/10">
          <div className="icon-circle text-brand-green bg-brand-green/10">
            <Camera size={24} />
          </div>
          <span className="font-bold text-sm">Camera</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, 'food')} />
        </label>
        <label className="dark-gradient-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all border-white/10">
          <div className="icon-circle text-brand-green bg-brand-green/10">
            <ImageIcon size={24} />
          </div>
          <span className="font-bold text-sm">Gallery</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'food')} />
        </label>
      </div>

      {loading && (
        <div className="px-6">
          <div className="glass-card p-12 flex flex-col items-center gap-4 border-brand-green/20">
            <Loader2 className="animate-spin text-brand-green" size={40} />
            <p className="text-brand-green font-bold animate-pulse">Processing Image...</p>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6"
        >
          <div className="dark-gradient-card p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{(translatedAnalysis || analysis).name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-brand-green rounded-full" />
                  <p className="text-brand-green font-bold text-sm">{(translatedAnalysis || analysis).calories} Kcal</p>
                </div>
              </div>
              <button onClick={() => setAnalysis(null)} className="icon-circle w-10 h-10">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Protein</p>
                <p className="font-bold text-brand-green">{(translatedAnalysis || analysis).nutrients.protein}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Carbs</p>
                <p className="font-bold text-brand-green">{(translatedAnalysis || analysis).nutrients.carbs}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Fats</p>
                <p className="font-bold text-brand-green">{(translatedAnalysis || analysis).nutrients.fats}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Vitamins & Minerals</p>
              <div className="flex flex-wrap gap-2">
                {(translatedAnalysis || analysis).nutrients.vitamins.map((v: string, i: number) => (
                  <span key={i} className="px-4 py-2 bg-brand-green/10 text-brand-green rounded-full text-[10px] font-bold border border-brand-green/20">
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-sm text-white/60 leading-relaxed italic">
              "{(translatedAnalysis || analysis).description}"
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderReading = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('AI Reading')}
      
      <div className="px-6">
        <div className="green-gradient-card p-8 h-48 flex flex-col justify-center items-center text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Pronunciation Help</h2>
          <p className="text-xs font-medium opacity-70">Capture text from an image and let AI read it aloud for you.</p>
        </div>
      </div>

      <div className="px-6 grid grid-cols-2 gap-4">
        <label className="dark-gradient-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all border-white/10">
          <div className="icon-circle text-brand-green bg-brand-green/10">
            <Camera size={24} />
          </div>
          <span className="font-bold text-sm">Camera</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, 'reading')} />
        </label>
        <label className="dark-gradient-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all border-white/10">
          <div className="icon-circle text-brand-green bg-brand-green/10">
            <ImageIcon size={24} />
          </div>
          <span className="font-bold text-sm">Gallery</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'reading')} />
        </label>
      </div>

      {loading && (
        <div className="px-6">
          <div className="glass-card p-12 flex flex-col items-center gap-4 border-brand-green/20">
            <Loader2 className="animate-spin text-brand-green" size={40} />
            <p className="text-brand-green font-bold animate-pulse">Extracting Text...</p>
          </div>
        </div>
      )}

      {extractedText && !loading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6"
        >
          <div className="dark-gradient-card p-6 space-y-6">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">Extracted Text</h2>
              <button onClick={() => setExtractedText('')} className="icon-circle w-10 h-10">
                <X size={20} />
              </button>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <p className="text-sm text-white/80 leading-relaxed">
                {extractedText}
              </p>
            </div>

            {audioBase64 && (
              <button 
                onClick={playAudio}
                disabled={isPlaying}
                className="apple-button-primary w-full flex items-center justify-center gap-3"
              >
                {isPlaying ? <Loader2 className="animate-spin" /> : <Volume2 size={20} />}
                {isPlaying ? "Reading Aloud..." : "Read Aloud"}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderTarget = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('Statistic')}
      
      <div className="px-6">
        <div className="dark-gradient-card p-8 h-64 flex flex-col justify-between relative">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="icon-circle w-8 h-8">
                <ArrowDownLeft size={16} className="text-brand-green" />
              </div>
              <h3 className="font-bold">Progress</h3>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <p className="text-[10px] font-bold">This Week</p>
              <LayoutGrid size={12} />
            </div>
          </div>
          
          {/* Mock Chart */}
          <div className="h-24 flex items-end gap-2 px-2">
            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className={cn(
                    "w-full rounded-t-lg transition-all duration-500",
                    i === 3 ? "bg-brand-green" : "bg-white/10"
                  )} 
                  style={{ height: `${h}%` }} 
                />
                <p className="text-[8px] font-bold text-white/30">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-white/5">
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase">Total Completed</p>
              <p className="text-xl font-bold">{goals.filter(g => g.isCompleted).length} Goals</p>
            </div>
            <div className="bg-brand-green/10 px-3 py-1 rounded-full border border-brand-green/20">
              <p className="text-[10px] font-bold text-brand-green">+12%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Daily Goals</h3>
          <button className="text-brand-green text-xs font-bold">Manage</button>
        </div>

        <div className="dark-gradient-card p-6 space-y-4">
          <input 
            placeholder="What's your next goal?" 
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            className="apple-input-v2 w-full"
          />
          <input 
            type="number" 
            placeholder="Hours"
            value={newGoalHours}
            onChange={(e) => setNewGoalHours(Number(e.target.value))}
            className="apple-input-v2 w-full"
          />
          <div className="flex justify-center pt-2">
            <button onClick={addGoal} className="apple-button-primary w-full sm:w-auto px-12">
              Add Goal
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="list-item h-24">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleGoalTimer(goal.id)}
                  className={cn(
                    "icon-circle transition-all",
                    goal.startTime ? "bg-brand-green text-black" : "text-brand-green"
                  )}
                >
                  {goal.startTime ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <div>
                  <p className="font-bold">{goal.title}</p>
                  <p className="text-2xl font-mono tracking-tighter text-brand-green">
                    {formatTime(goal.remainingSeconds)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setGoals(goals.filter(g => g.id !== goal.id))}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
              >
                <X size={16} className="text-white/30" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    // Calculate performance score: (logins * 10) + (shots * 25)
    const newScore = (performance.logins * 10) + (performance.shots * 25);
    setPerformance(prev => ({ ...prev, score: newScore }));
  }, [performance.logins, performance.shots]);

  const renderProfile = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('Performance')}
      
      <div className="px-6">
        <div className="dark-gradient-card p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-green/20 flex items-center justify-center border border-brand-green/30">
              <User size={32} className="text-brand-green" />
            </div>
            <div>
              <h2 className="text-xl font-bold">User Performance</h2>
              <p className="text-xs text-white/40">Daily activity tracking</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Daily Logins</p>
              <p className="text-2xl font-bold text-brand-green">{performance.logins}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Total Shots</p>
              <p className="text-2xl font-bold text-brand-green">{performance.shots}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="green-gradient-card p-8 text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Overall Performance Score</p>
          <h2 className="text-6xl font-bold tracking-tighter">{performance.score}</h2>
          <div className="pt-4">
            <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((performance.score / 1000) * 100, 100)}%` }}
                className="h-full bg-black/40"
              />
            </div>
            <p className="text-[10px] font-bold mt-2 opacity-50">Level: {Math.floor(performance.score / 500) + 1} Master</p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <h3 className="text-lg font-bold">Settings</h3>
        <div className="dark-gradient-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="icon-circle bg-brand-green/10 text-brand-green">
                <Volume2 size={18} />
              </div>
              <div>
                <p className="font-bold text-sm">Voice Response</p>
                <p className="text-[10px] text-white/40">AI will speak back to you</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (voiceEnabled) stopAllVoice();
              }}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                voiceEnabled ? "bg-brand-green" : "bg-white/10"
              )}
            >
              <motion.div 
                animate={{ x: voiceEnabled ? 24 : 4 }}
                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <h3 className="text-lg font-bold">Achievements</h3>
        <div className="space-y-3">
          <div className="list-item">
            <div className="flex items-center gap-4">
              <div className="icon-circle text-brand-green">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="font-bold">Early Bird</p>
                <p className="text-xs text-white/40">Logged in 10+ times</p>
              </div>
            </div>
            {performance.logins >= 10 && <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center"><CheckCircle2 size={14} className="text-black" /></div>}
          </div>
          <div className="list-item">
            <div className="flex items-center gap-4">
              <div className="icon-circle text-brand-green">
                <ImageIcon size={20} />
              </div>
              <div>
                <p className="font-bold">Foodie Pro</p>
                <p className="text-xs text-white/40">Scanned 5+ meals</p>
              </div>
            </div>
            {performance.shots >= 5 && <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center"><CheckCircle2 size={14} className="text-black" /></div>}
          </div>
        </div>
      </div>
    </div>
  );

  const handleSendMessage = async (textOverride?: string) => {
    const userMessage = textOverride || chatInput;
    if (!userMessage.trim() && selectedImages.length === 0) return;

    stopAllVoice();
    const currentImages = [...selectedImages];
    setChatInput('');
    setSelectedImages([]);

    const userParts: any[] = [];
    if (userMessage.trim()) userParts.push({ text: userMessage });
    currentImages.forEach(img => {
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(',')[1]
        }
      });
    });

    setChatHistory(prev => [...prev, { role: 'user', parts: userParts }]);
    setIsChatting(true);

    try {
      const response = await chatWithAI(userParts, chatHistory);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: response }] }]);
      
      // If it was a voice message, read the response aloud
      if (textOverride && voiceEnabled) {
        const audio = await generateSpeech(response);
        if (audio && voiceEnabled) {
          await playAudioFromBase64(audio);
        }
      }
    } catch (error: any) {
      setError(error.message || "Failed to send message. Please try again.");
      console.error(error);
    } finally {
      setIsChatting(false);
    }
  };

  const stopAllVoice = () => {
    setIsPlaying(false);
    setIsRecording(false);
    setIsChatting(false);
    setVolume(0);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Recognition already stopped");
      }
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        console.warn("Source already stopped");
      }
      sourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const playAudioFromBase64 = async (base64: string) => {
    try {
      stopAllVoice(); // Stop any existing playback/recording before starting new one
      setIsPlaying(true);
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const buffer = audioCtx.createBuffer(1, bytes.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < bytes.length; i++) {
        channelData[i] = bytes[i] / 32768;
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createBufferSource();
      sourceRef.current = source;
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!isPlaying) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        setVolume(sum / bufferLength);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      source.onended = () => {
        setIsPlaying(false);
        setVolume(0);
        sourceRef.current = null;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
      
      updateVolume();
      source.start();
    } catch (error) {
      console.error("Audio playback failed:", error);
      setIsPlaying(false);
      setVolume(0);
    }
  };

  const startVolumeAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        setVolume(sum / bufferLength);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      audioContextRef.current = audioContext;
      updateVolume();
    } catch (err) {
      console.error("Volume analysis failed:", err);
    }
  };

  const stopVolumeAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVolume(0);
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopAllVoice();
      return;
    }

    stopAllVoice();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'Bengali' ? 'bn-BD' : language === 'Hindi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      startVolumeAnalysis();
    };
    
    recognition.onend = () => {
      setIsRecording(false);
      stopVolumeAnalysis();
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setError("No speech detected. Please try again.");
      } else if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please check your browser permissions.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
      stopVolumeAnalysis();
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (event.results[0].isFinal) {
        if (transcript) {
          handleSendMessage(transcript);
        }
      } else {
        setChatInput(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 5 - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages(prev => [...prev, reader.result as string].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImagineInChat = async () => {
    if (!chatInput.trim() && selectedImages.length === 0) return;
    
    const userMessage = chatInput || "Generate an image based on this";
    const userParts: any[] = [{ text: userMessage }];
    
    selectedImages.forEach(img => {
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(',')[1]
        }
      });
    });

    setChatHistory(prev => [...prev, { role: 'user', parts: userParts }]);
    setChatInput('');
    const currentImages = [...selectedImages];
    setSelectedImages([]);
    setIsChatting(true);
    stopAllVoice();

    try {
      // Use the first image for editing if available
      const resultImage = await generateImage(userMessage, currentImages[0] || undefined);
      if (resultImage) {
        setChatHistory(prev => [...prev, { 
          role: 'model', 
          parts: [
            { text: "Here is your generated image:" },
            { inlineData: { mimeType: "image/png", data: resultImage.split(',')[1] } }
          ] 
        }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "I'm sorry, I couldn't generate an image based on that prompt." }] }]);
      }
    } catch (error: any) {
      setError(error.message || "Failed to generate image. Please try again.");
      console.error(error);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "An error occurred while generating the image." }] }]);
    } finally {
      setIsChatting(false);
    }
  };

  const renderChat = () => {
    return (
      <div className="min-h-screen bg-brand-dark text-white flex flex-col pb-32">
        <div className="p-6 pt-12 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green border border-brand-green/20">
              <Sparkle size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">AI Assistant</h1>
          </div>
          <button 
            onClick={() => {
              setChatHistory([]);
              stopAllVoice();
            }} 
            className="text-xs font-bold text-gray-400 uppercase tracking-widest"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col items-center">
          {/* Glowing Green Sphere */}
          <div className="relative w-48 h-48 my-8 flex items-center justify-center">
            <motion.div 
              animate={{ 
                scale: (isChatting || isRecording || isPlaying) ? [1, 1 + (volume / 100) * 0.5, 1] : 1,
                rotate: 360,
                boxShadow: (isRecording || isPlaying) 
                  ? [
                      `0 0 ${20 + volume}px rgba(163, 230, 53, 0.4)`, 
                      `0 0 ${40 + volume * 2}px rgba(163, 230, 53, 0.8)`, 
                      `0 0 ${20 + volume}px rgba(163, 230, 53, 0.4)`
                    ] 
                  : '0 0 40px rgba(163, 230, 53, 0.4)'
              }}
              transition={{ 
                duration: (isRecording || isPlaying) ? 0.1 : 20, 
                repeat: (isRecording || isPlaying) ? 0 : Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 rounded-full bg-brand-green border-4 border-white"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #bef264, #a3e635, #4d7c0f)',
                boxShadow: 'inset -10px -10px 30px rgba(0,0,0,0.2)'
              }}
            />
            {(isChatting || isRecording || isPlaying) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: [0.2, 0.5, 0.2], 
                  scale: [1, 1.2 + (volume / 50), 1] 
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -inset-8 rounded-full border-2 border-brand-green/30 blur-sm"
              />
            )}

            {/* Exit/Stop Button or Thinking Indicator */}
            {(isRecording || isPlaying || isChatting) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 flex flex-col items-center gap-2"
              >
                <button
                  onClick={stopAllVoice}
                  className="w-12 h-12 bg-red-500/20 backdrop-blur-md rounded-full flex items-center justify-center text-red-500 border border-red-500/30 hover:bg-red-500/40 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                  title="Stop everything"
                >
                  <X size={20} />
                </button>
                {isChatting && !isPlaying && (
                  <motion.p 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-[10px] font-bold text-white uppercase tracking-widest"
                  >
                    Thinking...
                  </motion.p>
                )}
              </motion.div>
            )}
          </div>

          <div className="w-full space-y-4 max-w-sm">
            {chatHistory.length === 0 ? (
              <div className="text-center space-y-2 py-8">
                <p className="text-gray-400 text-sm">Ask me anything in English, Bengali, or Hindi.</p>
                <p className="text-gray-300 text-[10px] font-bold uppercase tracking-widest">Powered by Gemini</p>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed space-y-2",
                    msg.role === 'user' 
                      ? "bg-white/10 text-white self-end ml-auto rounded-tr-none" 
                      : "bg-brand-green/10 text-white self-start mr-auto rounded-tl-none border border-brand-green/20"
                  )}
                >
                  {msg.parts.map((part, pi) => (
                    <div key={pi}>
                      {part.text && (
                        <div className="prose prose-sm max-w-none">
                          <Markdown>{part.text}</Markdown>
                        </div>
                      )}
                      {part.inlineData && (
                        <div className="space-y-2">
                          <img 
                            src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                            alt="AI Content" 
                            className="rounded-lg max-w-full h-auto mt-2"
                            referrerPolicy="no-referrer"
                          />
                          {msg.role === 'model' && (
                            <button 
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                                link.download = `ai-image-${Date.now()}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-green hover:text-brand-green/80 transition-colors"
                            >
                              <Download size={12} />
                              Download Image
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              ))
            )}
            {isChatting && (
              <div className="bg-brand-green/5 p-4 rounded-2xl self-start mr-auto rounded-tl-none border border-brand-green/10">
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="w-1.5 h-1.5 bg-brand-green rounded-full" />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-brand-green rounded-full" />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-brand-green rounded-full" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-brand-dark border-t border-white/10 space-y-4">
          {selectedImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative shrink-0 w-20 h-20">
                  <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover rounded-xl border border-white/10" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-brand-dark"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              multiple
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedImages.length >= 5}
              className={cn(
                "w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center transition-all active:scale-90 border border-white/10",
                selectedImages.length >= 5 && "opacity-20 cursor-not-allowed"
              )}
            >
              <ImageIcon size={20} />
            </button>
            <button 
              onClick={toggleVoiceInput}
              disabled={isChatting}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                isRecording ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-gray-100 text-gray-500"
              )}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isRecording ? "Listening..." : "Type your message..."}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 pr-14 text-white focus:outline-none focus:border-brand-green transition-all"
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={isChatting || (!chatInput.trim() && selectedImages.length === 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-brand-green text-black rounded-xl flex items-center justify-center disabled:opacity-50 transition-all active:scale-90"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkout = () => (
    <div className="space-y-6 pb-32">
      {renderHeader('Workout')}
      
      <div className="px-6">
        <div className="green-gradient-card p-8 h-48 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="icon-circle bg-black/10 text-black">
              <Dumbbell size={24} />
            </div>
            <div className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Active Plan
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Personalized Map</h2>
            <p className="text-xs font-medium opacity-70">Tailored for {profile.bodyType} • {profile.goal}</p>
          </div>
        </div>
      </div>

      <div className="px-6">
        {!profile.isSetupComplete ? (
          <div className="dark-gradient-card p-12 text-center space-y-4">
            <Activity size={48} className="mx-auto text-white/10" />
            <p className="text-white/40 font-medium">Complete your profile to unlock your workout map.</p>
            <button onClick={() => setActiveTab('home')} className="apple-button-primary">Go to Profile</button>
          </div>
        ) : (
          <div className="dark-gradient-card p-8 prose prose-invert max-w-none prose-p:text-sm prose-p:text-white/60 prose-headings:text-brand-green prose-li:text-sm prose-li:text-white/60">
            <Markdown>{workoutPlan}</Markdown>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-md"
          >
            <div className="bg-red-500/90 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-red-400/20">
              <div className="flex items-center gap-3">
                <Bell size={20} className="shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language Selector */}
      <div className="fixed top-8 right-20 z-50">
        <div className="bg-white/5 backdrop-blur-md rounded-full p-1.5 flex items-center gap-2 border border-white/10">
          <Languages size={14} className="ml-2 text-brand-green" />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-[10px] font-bold uppercase tracking-wider pr-2 focus:outline-none appearance-none cursor-pointer"
          >
            {['English', 'Bengali', 'Hindi', 'Spanish', 'French'].map(l => (
              <option key={l} value={l} className="bg-brand-dark">{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'home' && renderHome()}
            {activeTab === 'camera' && renderCamera()}
            {activeTab === 'reading' && renderReading()}
            {activeTab === 'target' && renderTarget()}
            {activeTab === 'workout' && renderWorkout()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'chat' && renderChat()}
            {activeTab === 'calculator' && <ScientificCalculator />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-lg z-50 px-1">
        <div className="nav-pill shadow-2xl shadow-black/80">
          <div className="flex items-center justify-evenly w-full py-1">
            <button 
              onClick={() => setActiveTab('home')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'home' ? "nav-item-active" : "text-white/40")}
            >
              <Home size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('camera')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'camera' ? "nav-item-active" : "text-white/40")}
            >
              <Camera size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'calculator' ? "nav-item-active" : "text-white/40")}
            >
              <Calculator size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('reading')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'reading' ? "nav-item-active" : "text-white/40")}
            >
              <BookOpen size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'chat' ? "nav-item-active" : "text-white/40")}
            >
              <MessageCircle size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('target')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'target' ? "nav-item-active" : "text-white/40")}
            >
              <Target size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('workout')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'workout' ? "nav-item-active" : "text-white/40")}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn("nav-item shrink-0 p-2.5", activeTab === 'profile' ? "nav-item-active" : "text-white/40")}
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
