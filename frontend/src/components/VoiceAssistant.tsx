import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Send, Bot, User as UserIcon,
  Shield, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw,
  Sparkles, ShieldAlert, FileText, CornerDownLeft, Info, HelpCircle,
  UserCheck, Check
} from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseSpokenAmount, extractWalletAddress, extractTransactionHash } from '../utils/hindiNumberParser';
import { api } from '../services/api';
import { WalletVerificationResponse, AvailableInvestigator } from '../types';

export interface ExtractedComplaintData {
  victim_name: string;
  incident_date: string;
  scam_channel: string;
  amount_lost: number;
  currency: string;
  suspect_wallet: string;
  blockchain: string;
  transaction_hash?: string;
  description: string;
  investigator_id?: number | null;
  investigator_name?: string;
  statutory_fir_narrative: string;
  transcript: { sender: 'ai' | 'victim'; text: string; timestamp: string }[];
  syndicate_detected?: boolean;
  syndicate_tag?: string;
}

interface VoiceAssistantProps {
  onComplete: (data: ExtractedComplaintData) => void;
  onCancel: () => void;
  defaultName?: string;
  availableInvestigators?: AvailableInvestigator[];
}

interface QuestionConfig {
  id: number;
  field: keyof ExtractedComplaintData;
  questionEn: string;
  questionHi: string;
  placeholderEn: string;
  placeholderHi: string;
  quickRepliesEn: string[];
  quickRepliesHi: string[];
}

// Aligned with the AI's natural intake ordering: Name -> Amount -> Suspect Wallet -> Modus Operandi -> Details -> Investigator
const BASE_QUESTIONS: QuestionConfig[] = [
  {
    id: 1,
    field: 'victim_name',
    questionEn: 'Hello! I am CryptoTrace AI Intake Officer. I am here to help you lodge your official cybercrime complaint. First, what is your full name?',
    questionHi: 'नमस्ते! मैं CryptoTrace AI साइबर अधिकारी हूं। आपकी शिकायत दर्ज करने में मदद करूंगा। सबसे पहले, अपना पूरा नाम बताएं।',
    placeholderEn: 'e.g. Rahul Sharma',
    placeholderHi: 'उदा. राहुल शर्मा',
    quickRepliesEn: ['Rahul Sharma', 'Ananya Patel', 'Vikram Singh'],
    quickRepliesHi: ['राहुल शर्मा', 'अनन्या पटेल', 'विक्रम सिंह']
  },
  {
    id: 2,
    field: 'amount_lost',
    questionEn: 'How much money or cryptocurrency did you lose in total? You can speak in Rupees (e.g. "50,000" or "Two Lakhs").',
    questionHi: 'आपको कुल कितने रुपयों का नुकसान हुआ? आप बोल सकते हैं (उदा. "पचास हजार" या "दो लाख रुपये").',
    placeholderEn: 'e.g. 2,50,000 INR (Two Lakhs Fifty Thousand)',
    placeholderHi: 'उदा. ₹2,50,000 (दो लाख रुपये)',
    quickRepliesEn: ['₹50,000', '₹2,50,000 (Two Lakhs Fifty Thousand)', '₹5,00,000 (Five Lakhs)', '₹15,00,000 (Fifteen Lakhs)'],
    quickRepliesHi: ['₹50,000 (पचास हजार)', '₹2,50,000 (ढाई लाख रुपये)', '₹5,00,000 (पांच लाख रुपये)', '₹15,00,000 (पंद्रह लाख रुपये)']
  },
  {
    id: 3,
    field: 'suspect_wallet',
    questionEn: 'What is the scammer\'s cryptocurrency wallet address or Transaction Hash where the funds were sent?',
    questionHi: 'स्कैमर का क्रिप्टोकरंसी वॉलेट एड्रेस या ट्रांजैक्शन हैश क्या है जहाँ पैसे ट्रांसफर किए गए थे?',
    placeholderEn: 'e.g. 0x742d35cc6634c0532925a3b844bc454e4438f44e',
    placeholderHi: 'उदा. 0x742d35cc6634c0532925a3b844bc454e4438f44e',
    quickRepliesEn: ['0x742d35cc6634c0532925a3b844bc454e4438f44e', '0x28c6c06298d514db089934071355e5743bf21d60', 'I do not have the wallet right now'],
    quickRepliesHi: ['0x742d35cc6634c0532925a3b844bc454e4438f44e', '0x28c6c06298d514db089934071355e5743bf21d60', 'मेरे पास अभी वॉलेट एड्रेस नहीं है']
  },
  {
    id: 4,
    field: 'scam_channel',
    questionEn: 'How were you approached by the fraudster? Was it through Telegram, WhatsApp, a task scheme, or a fake police call?',
    questionHi: 'धोखेबाज ने आपसे कैसे संपर्क किया? क्या यह टेलीग्राम, व्हाट्सएप, टास्क स्कीम, या फर्जी पुलिस कॉल के जरिए हुआ?',
    placeholderEn: 'e.g. Telegram VIP Investment Group',
    placeholderHi: 'उदा. टेलीग्राम वीआईपी इन्वेस्टमेंट ग्रुप',
    quickRepliesEn: ['Telegram Investment Group', 'WhatsApp Part-Time Job Scheme', 'Fake CBI / Police Digital Arrest', 'Romance / Fake Trading App'],
    quickRepliesHi: ['टेलीग्राम इन्वेस्टमेंट ग्रुप', 'व्हाट्सएप पार्ट-टाइम टास्क जॉब', 'फर्जी पुलिस / CBI डिजिटल अरेस्ट', 'रोमांस / ट्रेडिंग प्लेटफार्म']
  },
  {
    id: 5,
    field: 'description',
    questionEn: 'Please describe briefly what happened. Did they promise daily returns or demand a tax/fee to unlock withdrawals?',
    questionHi: 'स्कैमर ने आपको क्या झांसा दिया था? क्या उन्होंने दैनिक मुनाफे का वादा किया था या निकासी शुल्क मांगा था?',
    placeholderEn: 'e.g. Promised 20% daily returns, then blocked withdrawals demanding 30% tax',
    placeholderHi: 'उदा. 20% मुनाफे का वादा किया, बाद में निकासी के लिए 30% टैक्स मांगा',
    quickRepliesEn: [
      'Promised 250% guaranteed ROI, then refused withdrawal without paying 30% GST.',
      'Completed online rating tasks, balance showed ₹8 Lakhs, but demanded ₹2 Lakhs security deposit.',
      'Caller claimed to be Cyber Police Mumbai stating my Aadhaar was linked to money laundering.'
    ],
    quickRepliesHi: [
      '24 घंटे में 250% मुनाफे का वादा किया, फिर 30% जीएसटी टैक्स जमा किए बिना पैसे निकालने से मना कर दिया।',
      'ऑनलाइन होटल रेटिंग टास्क पूरे किए, खाते में 8 लाख दिखे, पर निकासी के लिए 2 लाख मांगे।',
      'कॉलर ने खुद को साइबर पुलिस बताकर कहा कि मेरा आधार मनी लॉन्ड्रिंग में फंसा है और डिजिटल अरेस्ट की धमकी दी।'
    ]
  },
  {
    id: 6,
    field: 'investigator_name',
    questionEn: 'Which Cybercrime Investigator should lead your case? You can choose an approved officer or select Central Queue.',
    questionHi: 'इस केस की जांच के लिए आप किस साइबर अधिकारी को नियुक्त करना चाहते हैं? आप अधिकारी चुन सकते हैं या सेंट्रल कतार चुन सकते हैं।',
    placeholderEn: 'Select an officer or say "Auto Assign"',
    placeholderHi: 'अधिकारी चुनें या "ऑटो असाइन" कहें',
    quickRepliesEn: ['Auto-Assign (Central Cyber Queue)', 'Insp. Vikramaditya (Cyber Cell Mumbai)', 'Insp. Priya Nair (Forensic Cyber Cell Delhi)'],
    quickRepliesHi: ['ऑटो असाइन (सेंट्रल साइबर कतार)', 'इंस्पेक्टर विक्रमादित्य (मुंबई सेल)', 'इंस्पेक्टर प्रिया नायर (दिल्ली सेल)']
  }
];

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onComplete,
  onCancel,
  defaultName = '',
  availableInvestigators = []
}) => {
  // Default to English ('en') for reliable browser speech recognition across all environments
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inputText, setInputText] = useState('');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Extracted Complaint State
  const [extractedData, setExtractedData] = useState<ExtractedComplaintData>({
    victim_name: defaultName,
    incident_date: new Date().toISOString().slice(0, 10),
    scam_channel: '',
    amount_lost: 0,
    currency: 'INR',
    suspect_wallet: '',
    blockchain: 'Ethereum',
    transaction_hash: '',
    description: '',
    investigator_id: null,
    investigator_name: 'Central Cyber Queue (Auto-Assign)',
    statutory_fir_narrative: '',
    transcript: []
  });

  // Dynamic Questions with loaded investigators
  const questions: QuestionConfig[] = BASE_QUESTIONS.map(q => {
    if (q.field === 'investigator_name' && availableInvestigators && availableInvestigators.length > 0) {
      const officerNames = availableInvestigators.map(inv => `${inv.full_name} (${inv.department || inv.organization || 'Cyber Crime Cell'})`);
      return {
        ...q,
        quickRepliesEn: ['Auto-Assign (Central Cyber Queue)', ...officerNames.slice(0, 3)],
        quickRepliesHi: ['ऑटो असाइन (सेंट्रल कतार)', ...officerNames.slice(0, 3)]
      };
    }
    return q;
  });

  // Autonomous Agent 2: Real-time background triage alert
  const [triageAlert, setTriageAlert] = useState<{
    scanning: boolean;
    verdict?: WalletVerificationResponse;
  }>({ scanning: false });

  // Chat message stream
  const [messages, setMessages] = useState<{
    id: string;
    sender: 'ai' | 'victim';
    text: string;
    timestamp: string;
  }[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isAutoAdvancingRef = useRef(false);

  // Synchronized refs to avoid stale closures in speech callbacks
  const currentStepRef = useRef(currentStepIndex);
  currentStepRef.current = currentStepIndex;

  const extractedDataRef = useRef(extractedData);
  extractedDataRef.current = extractedData;

  const isDoneRef = useRef(isDone);
  isDoneRef.current = isDone;

  const langRef = useRef(lang);
  langRef.current = lang;

  // Speech Hook with Auto-Advance on pause
  const {
    isListening,
    transcript,
    isSupported,
    audioLevel,
    startListening,
    stopListening,
    resetTranscript,
    speak,
    stopSpeaking
  } = useSpeechToText({
    lang: lang === 'hi' ? 'hi-IN' : 'en-IN',
    continuous: true,
    onResult: (text) => {
      setInputText(text);
    },
    onSpeechFinal: (finalText) => {
      // Auto-advance as soon as user finishes speaking their phrase
      if (!isDoneRef.current && finalText && finalText.trim().length > 0 && !isAutoAdvancingRef.current) {
        isAutoAdvancingRef.current = true;
        handleSendResponse(finalText);
        setTimeout(() => {
          isAutoAdvancingRef.current = false;
        }, 1500);
      }
    }
  });

  // Speak AI question and automatically turn on microphone when AI finishes speaking
  const askQuestionWithAudio = (promptText: string) => {
    stopListening(); // Mute mic while AI speaks to prevent audio self-transcription
    resetTranscript();

    if (!voiceMuted) {
      speak(promptText, langRef.current === 'hi' ? 'hi-IN' : 'en-IN', () => {
        // As soon as AI speech completes, automatically turn on the microphone!
        setTimeout(() => {
          if (!isDoneRef.current) {
            resetTranscript();
            startListening();
          }
        }, 250);
      });
    } else {
      setTimeout(() => {
        if (!isDoneRef.current) {
          resetTranscript();
          startListening();
        }
      }, 150);
    }
  };

  // Initialize first greeting on mount / language switch
  useEffect(() => {
    const firstQ = questions[0];
    const initialText = lang === 'hi' ? firstQ.questionHi : firstQ.questionEn;
    const initialMsg = {
      id: `init-ai-${Date.now()}`,
      sender: 'ai' as const,
      text: initialText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([initialMsg]);

    // Speak initial greeting and start listening
    askQuestionWithAudio(initialText);

    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [lang]);

  // Auto scroll chat to newest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, triageAlert, isListening]);

  // Autonomous Agent 2: Background threat lookup when a wallet address is entered
  const runBackgroundThreatTriage = async (walletAddr: string) => {
    setTriageAlert({ scanning: true });
    try {
      const res = await api.verifyWallet({
        wallet_address: walletAddr,
        blockchain: extractedData.blockchain || 'Ethereum'
      });
      setTriageAlert({ scanning: false, verdict: res });
    } catch (e) {
      setTriageAlert({ scanning: false });
    }
  };

  // Compile formal Indian Cyber Police Statutory FIR narrative (Agent 3)
  const generateStatutoryNarrative = (data: ExtractedComplaintData) => {
    const dateFormatted = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    return `FORMAL STATUTORY COMPLAINT UNDER SECTIONS 419, 420 OF INDIAN PENAL CODE (IPC) & SECTION 66D OF THE INFORMATION TECHNOLOGY ACT, 2000.

TO: THE OFFICER IN CHARGE, CYBER CRIME POLICE STATION / NATIONAL CYBER CRIME REPORTING PORTAL (NCRP)
DATE: ${dateFormatted}

1. COMPLAINANT: ${data.victim_name || 'Complainant Citizen'}
2. REPORTED LOSS AMOUNT: ₹${(data.amount_lost || 0).toLocaleString('en-IN')} (${data.currency})
3. INITIAL CONTACT CHANNEL / MODUS OPERANDI: ${data.scam_channel || 'Social Messaging Platform (Telegram/WhatsApp)'}
4. SUSPECT BLOCKCHAIN INFRASTRUCTURE:
   - Recipient Suspect Wallet: ${data.suspect_wallet || 'Identified via transaction record'}
   - Blockchain Ledger: ${data.blockchain}
   - Transaction Hash: ${data.transaction_hash || 'Recorded in evidence locker'}

5. DESIGNATED INVESTIGATING OFFICER: ${data.investigator_name || 'Central Cyber Queue Auto-Assign'}

6. STATEMENT OF FACTS:
"The complainant was systematically induced into transferring cryptocurrency by unknown perpetrators masquerading as legitimate investment coordinators. The perpetrators promised fraudulent high-yield daily returns and subsequently blocked withdrawals by coercing additional payments labeled as processing fees/taxes. The transferred funds entered the aforementioned recipient wallet address."

7. RELIEF SOUGHT:
Immediate preservation of wallet ledger logs, issuance of statutory notices under Section 91 CrPC / Section 94 BNSS to destination Virtual Asset Service Providers (VASPs), freezing of illicit accounts, and apprehension of perpetrators.`;
  };

  const normalizeScamChannel = (spoken: string): string => {
    const lower = spoken.toLowerCase();
    if (lower.includes('telegram') || lower.includes('टेलीग्राम')) {
      return 'Telegram Investment Group';
    }
    if (lower.includes('whatsapp') || lower.includes('व्हाट्सएप') || lower.includes('वॉट्सएप')) {
      return 'WhatsApp Part-Time Job Scheme';
    }
    if (lower.includes('task') || lower.includes('job') || lower.includes('टास्क') || lower.includes('जॉब') || lower.includes('rating') || lower.includes('रेटिंग')) {
      return 'Part-Time Task & Rating Fraud';
    }
    if (lower.includes('police') || lower.includes('cbi') || lower.includes('arrest') || lower.includes('अरेस्ट') || lower.includes('पुलिस')) {
      return 'Fake CBI / Police Digital Arrest';
    }
    if (lower.includes('trade') || lower.includes('trading') || lower.includes('crypto') || lower.includes('ट्रेडिंग') || lower.includes('इन्वेस्ट') || lower.includes('invest')) {
      return 'Fake Crypto Trading Platform';
    }
    return spoken.trim();
  };

  // Helper to determine next question index based on missing fields
  const calculateNextStepIndex = (data: ExtractedComplaintData): number => {
    if (!data.victim_name) return 0;
    if (!data.amount_lost) return 1;
    if (!data.suspect_wallet) return 2;
    if (!data.scam_channel) return 3;
    if (!data.description) return 4;
    return Math.min(5, questions.length - 1);
  };

  // Handle user response submission & transition
  const handleSendResponse = async (answerText: string) => {
    const cleanAnswer = answerText.trim();
    if (!cleanAnswer || isProcessing) return;

    setIsProcessing(true);
    stopListening();
    resetTranscript();
    stopSpeaking();

    const updatedData = { ...extractedDataRef.current };
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append victim message immediately to chat UI
    const victimMsg = {
      id: `victim-${Date.now()}`,
      sender: 'victim' as const,
      text: cleanAnswer,
      timestamp: nowTime
    };

    setMessages(prev => [...prev, victimMsg]);
    setInputText('');

    updatedData.transcript = [
      ...updatedData.transcript,
      { sender: 'victim', text: cleanAnswer, timestamp: nowTime }
    ];

    extractedDataRef.current = updatedData;
    setExtractedData({ ...updatedData });

    // 1. Try sending to the backend Dynamic State-Machine RAG Engine
    let handledByBackend = false;
    try {
      const response = await fetch('/api/agent/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: updatedData.transcript.map(t => ({
            role: t.sender === 'victim' ? 'user' : 'agent',
            content: t.text
          })),
          latest_user_input: cleanAnswer
        })
      });

      if (response.ok) {
        const aiData = await response.json();
        const aiReply = aiData.reply_text || "Thank you. Let's proceed with the next detail.";
        const ext = aiData.extracted_data || {};

        // Merge newly extracted fields into our form state
        if (ext.victim_name) updatedData.victim_name = ext.victim_name;
        if (ext.amount_lost) updatedData.amount_lost = ext.amount_lost;
        if (ext.currency) updatedData.currency = ext.currency;
        if (ext.blockchain) updatedData.blockchain = ext.blockchain;
        if (ext.transaction_hash) updatedData.transaction_hash = ext.transaction_hash;
        if (ext.description) updatedData.description = ext.description;
        if (ext.scam_channel) updatedData.scam_channel = ext.scam_channel;

        if (ext.suspect_wallet && ext.suspect_wallet !== updatedData.suspect_wallet) {
          updatedData.suspect_wallet = ext.suspect_wallet;
          runBackgroundThreatTriage(ext.suspect_wallet);
        }

        // Match available investigator if mentioned
        if (availableInvestigators && availableInvestigators.length > 0) {
          const found = availableInvestigators.find(inv =>
            cleanAnswer.toLowerCase().includes(inv.full_name.toLowerCase()) ||
            (inv.username && cleanAnswer.toLowerCase().includes(inv.username.toLowerCase()))
          );
          if (found) {
            updatedData.investigator_id = found.id;
            updatedData.investigator_name = found.full_name;
          }
        }

        // Dynamically compute next question index
        const nextStep = calculateNextStepIndex(updatedData);
        setCurrentStepIndex(nextStep);
        currentStepRef.current = nextStep;

        // Append AI response to chat
        const aiMsgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai' as const,
          text: aiReply,
          timestamp: aiMsgTime
        };

        updatedData.transcript.push({ sender: 'ai', text: aiReply, timestamp: aiMsgTime });
        extractedDataRef.current = updatedData;
        setExtractedData({ ...updatedData });
        setMessages(prev => [...prev, aiMsg]);

        // Speak the AI reply
        askQuestionWithAudio(aiReply);

        // Check if report collection is complete
        if (aiData.is_complete) {
          const finalNarrative = generateStatutoryNarrative(updatedData);
          updatedData.statutory_fir_narrative = finalNarrative;
          extractedDataRef.current = updatedData;
          setExtractedData({ ...updatedData });
          isDoneRef.current = true;
          setIsDone(true);
        }

        handledByBackend = true;
      }
    } catch (apiErr) {
      console.warn("Backend dynamic intake error, fallback to local state engine:", apiErr);
    }

    // 2. Local Fallback if backend was unreachable or errored
    if (!handledByBackend) {
      const curIdx = currentStepRef.current;
      const currentQ = questions[curIdx] || questions[0];

      if (currentQ.field === 'victim_name') {
        updatedData.victim_name = cleanAnswer;
      } else if (currentQ.field === 'amount_lost') {
        const parsed = parseSpokenAmount(cleanAnswer);
        updatedData.amount_lost = parsed.amount !== null ? parsed.amount : (parseFloat(cleanAnswer.replace(/[^0-9.]/g, '')) || 250000);
      } else if (currentQ.field === 'suspect_wallet') {
        const extractedWallet = extractWalletAddress(cleanAnswer) || cleanAnswer;
        updatedData.suspect_wallet = extractedWallet;
        if (extractedWallet.startsWith('0x') || extractedWallet.length > 25) {
          runBackgroundThreatTriage(extractedWallet);
        }
      } else if (currentQ.field === 'scam_channel') {
        updatedData.scam_channel = normalizeScamChannel(cleanAnswer);
      } else if (currentQ.field === 'description') {
        updatedData.description = cleanAnswer;
      } else {
        (updatedData as any)[currentQ.field] = cleanAnswer;
      }

      const nextIndex = curIdx + 1;
      currentStepRef.current = nextIndex;
      setCurrentStepIndex(nextIndex);

      if (nextIndex < questions.length) {
        const nextQ = questions[nextIndex];
        const nextPrompt = lang === 'hi' ? nextQ.questionHi : nextQ.questionEn;
        const nextAiMsgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nextAiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai' as const,
          text: nextPrompt,
          timestamp: nextAiMsgTime
        };

        updatedData.transcript.push({ sender: 'ai', text: nextPrompt, timestamp: nextAiMsgTime });
        extractedDataRef.current = updatedData;
        setExtractedData({ ...updatedData });
        setMessages(prev => [...prev, nextAiMsg]);

        askQuestionWithAudio(nextPrompt);
      } else {
        const finalNarrative = generateStatutoryNarrative(updatedData);
        updatedData.statutory_fir_narrative = finalNarrative;
        extractedDataRef.current = updatedData;
        setExtractedData({ ...updatedData });
        isDoneRef.current = true;
        setIsDone(true);
      }
    }

    setIsProcessing(false);
  };

  const handleFinalSubmit = () => {
    onComplete(extractedData);
  };

  const activeQuestion = questions[Math.min(currentStepIndex, questions.length - 1)];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden flex flex-col h-[720px] max-h-[85vh]">
      {/* Background forensic neon glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-blue-400">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-wide">
                AI Voice Complaint Assistant
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                Live Dynamic Intake
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Microphone listens automatically • Speak or type your answer to advance
            </p>
          </div>
        </div>

        {/* Controls: Language & Voice Mute */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80 text-xs font-bold">
            <button
              onClick={() => {
                setLang('en');
                stopSpeaking();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                lang === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => {
                setLang('hi');
                stopSpeaking();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                lang === 'hi' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇮🇳 हिन्दी
            </button>
          </div>

          {/* Voice Mute Button */}
          <button
            onClick={() => {
              setVoiceMuted(!voiceMuted);
              if (!voiceMuted) stopSpeaking();
            }}
            className={`p-2 rounded-xl border transition-colors ${
              voiceMuted
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : 'bg-blue-950/60 text-blue-300 border-blue-700/60'
            }`}
            title={voiceMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
          >
            {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Exit / Switch to Form */}
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Manual Form
          </button>
        </div>
      </div>

      {/* Autonomous Agent 2 Real-Time Badge */}
      {triageAlert.scanning && (
        <div className="mt-2 p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 flex items-center gap-2 text-xs text-blue-300 animate-pulse shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>⚡ <strong>Threat Triage Agent:</strong> Scanning suspect wallet on-chain and checking NCRP syndicate cluster...</span>
        </div>
      )}

      {triageAlert.verdict && triageAlert.verdict.risk_tier === 'CRITICAL' && (
        <div className="mt-2 p-3 rounded-xl bg-red-950/80 border-2 border-red-500/80 flex items-center justify-between gap-3 text-xs text-white shadow-lg shadow-red-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="font-bold text-red-300 uppercase tracking-wide text-[10px] block">
                🚨 Agent 2 Real-Time Syndicate Alert
              </span>
              <span>
                Suspect wallet is confirmed in <strong>{triageAlert.verdict.complaint_count} prior FIR complaints</strong>
                {triageAlert.verdict.syndicate_tag && ` and linked to Syndicate ${triageAlert.verdict.syndicate_tag}`}!
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white shrink-0">
            PRIORITY: CRITICAL
          </span>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2 relative z-10 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((m) => {
          const isAi = m.sender === 'ai';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              {isAi && (
                <div className="w-7 h-7 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs shadow-md ${
                  isAi
                    ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm leading-relaxed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm font-medium'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[9px] mt-1.5 font-mono ${isAi ? 'text-slate-400' : 'text-blue-200'} text-right`}>
                  {m.timestamp}
                </div>
              </div>

              {!isAi && (
                <div className="w-7 h-7 rounded-xl bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5 shadow-sm">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Real-time Listening Banner */}
        {isListening && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/70 text-xs text-emerald-200 shadow-lg shadow-emerald-900/30 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-0.5 h-4">
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: `${Math.max(25, audioLevel)}%`, animationDelay: '0ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: `${Math.max(45, audioLevel * 0.8)}%`, animationDelay: '150ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: `${Math.max(65, audioLevel * 1.2)}%`, animationDelay: '300ms' }} />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: `${Math.max(35, audioLevel * 0.9)}%`, animationDelay: '200ms' }} />
              </div>
              <span className="font-medium text-emerald-300">
                🎙️ {transcript ? `"${transcript}"` : (lang === 'hi' ? 'माइक सुन रहा है... अपना उत्तर बोलें' : 'Listening... Speak your answer now')}
              </span>
            </div>

            {transcript && (
              <button
                type="button"
                onClick={() => handleSendResponse(transcript)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>AI Intake Officer is processing your response...</span>
          </div>
        )}

        {/* Completed Confirmation Dossier Card */}
        {isDone && (
          <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950/70 border-2 border-emerald-500/70 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">
                  Complaint Dossier Synthesized
                </h4>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Legal Statutory Requisition Ready (Sec 419, 420 IPC • Sec 66D IT Act • Sec 94 BNSS)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-mono">Complainant Name</span>
                <span className="font-bold text-white">{extractedData.victim_name || 'Recorded'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-mono">Reported Loss</span>
                <span className="font-bold text-emerald-400">₹{(extractedData.amount_lost || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 col-span-2">
                <span className="text-[10px] text-slate-400 block font-mono">Suspect Wallet / TxID</span>
                <span className="font-mono text-[11px] text-blue-300 break-all">{extractedData.suspect_wallet || 'Recorded in evidence locker'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 col-span-2">
                <span className="text-[10px] text-slate-400 block font-mono">Assigned Investigating Officer</span>
                <span className="font-bold text-blue-300 flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>{extractedData.investigator_name || 'Central Cyber Queue Auto-Assign'}</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleFinalSubmit}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-blue-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Populate Complaint Form & Finalize Submission</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Replies */}
      {!isDone && (
        <div className="py-2 shrink-0">
          <div className="text-[10px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>Suggested Responses (Click or Speak):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(lang === 'hi' 
              ? activeQuestion.quickRepliesHi 
              : activeQuestion.quickRepliesEn
            ).map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendResponse(reply)}
                className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 border border-slate-700 transition-all shadow-sm cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar with Mic & Send */}
      {!isDone && (
        <div className="pt-2 border-t border-slate-800 relative z-10 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendResponse(inputText);
            }}
            className="flex items-center gap-2"
          >
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              className={`p-3 rounded-2xl transition-all shadow-md flex items-center justify-center cursor-pointer ${
                isListening
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/50 ring-4 ring-emerald-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
              }`}
              title={isListening ? 'Click to pause mic' : 'Click to start speaking'}
            >
              {isListening ? <Mic className="w-5 h-5 text-white animate-pulse" /> : <MicOff className="w-5 h-5 text-slate-200" />}
            </button>

            {/* Text Input with Real-time Speech Sync */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isListening
                    ? (lang === 'hi' ? 'बोलिए, मैं सुन रहा हूं...' : 'Listening... Speak your answer now')
                    : (lang === 'hi' ? activeQuestion.placeholderHi : activeQuestion.placeholderEn)
                }
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl py-3 pl-4 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-2xl transition-colors shadow-md shadow-blue-600/20 cursor-pointer"
              title="Submit Answer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 px-1 font-mono">
            <span>Step {currentStepIndex + 1} of {questions.length}: {activeQuestion.field.replace('_', ' ').toUpperCase()}</span>
            <div className="flex items-center gap-3">
              {!isListening && (
                <button
                  type="button"
                  onClick={() => startListening()}
                  className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                >
                  🎙️ Turn Mic On
                </button>
              )}
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Auto-Advance Ready</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
