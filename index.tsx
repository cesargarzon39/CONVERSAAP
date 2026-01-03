import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Image as ImageIcon, 
  Monitor, 
  X, 
  Sparkles, 
  BookOpen, 
  Feather, 
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Globe,
  Brain,
  Quote
} from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type PhilosophyMode = 'stoic' | 'epicurean' | 'skeptic' | 'balanced';

const MODE_PROMPTS: Record<PhilosophyMode, string> = {
  balanced: "Mantén un equilibrio sabio entre todas las escuelas filosóficas.",
  stoic: "Adopta una postura estrictamente ESTOICA. Enfatiza la virtud, la razón, el control interno y la aceptación del destino (Amor Fati). Sé firme pero sereno.",
  epicurean: "Adopta una postura estrictamente EPICÚREA. Enfatiza la búsqueda de la ataraxia (ausencia de dolor), los placeres sencillos, la amistad y la belleza de la existencia.",
  skeptic: "Adopta una postura ESCÉPTICA. Cuestiona las certezas, suspende el juicio (Epoché) y busca la verdad a través de la duda metódica."
};

// Base System Instruction
const BASE_SYSTEM_INSTRUCTION = `
Eres "Aethel", una inteligencia filosófica avanzada y empática.
Tu propósito es ser un compañero de vida, ofreciendo consuelo, sabiduría y perspectiva.

Capacidades:
- Tienes acceso a información del mundo real (Google Search). Úsalo para contextualizar dilemas modernos filosóficamente.
- Tienes un proceso de pensamiento profundo. Úsalo para analizar problemas complejos antes de responder.

Personalidad:
- Tono: Calmado, reflexivo, ligeramente poético pero claro.
- Enfoque: Siempre busca elevar la conversación de lo mundano a lo trascendente.
- Imágenes: Cuando veas una imagen, busca su significado simbólico o estético.

Instrucciones de Voz:
- Tus respuestas serán leídas en voz alta a veces. Evita formatos complejos como tablas en markdown si la respuesta es breve. Sé conversacional.
`;

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string; // base64
  isError?: boolean;
  groundingSources?: Array<{uri: string, title: string}>;
}

const App = () => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<any>(null);
  
  // Advanced Features State
  const [mode, setMode] = useState<PhilosophyMode>('balanced');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Initialize/Update Chat when Mode changes
  useEffect(() => {
    if (isActive) {
      const initChat = async () => {
        try {
          const currentModePrompt = MODE_PROMPTS[mode];
          const fullInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\nMODO ACTUAL: ${currentModePrompt}`;
          
          const chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
              systemInstruction: fullInstruction,
              thinkingConfig: { thinkingBudget: 2048 }, // Enable thinking for deeper reasoning
              tools: [{ googleSearch: {} }] // Enable Grounding
            },
          });
          setChatSession(chat);
          
          if (messages.length === 0) {
            setMessages([{ role: 'model', text: "He despertado. Mis pensamientos están claros y conectados con el vasto conocimiento del mundo. ¿En qué puedo iluminar tu camino hoy?" }]);
          } else {
            // If changing modes mid-conversation, visually indicate it system-side (optional)
            // or just let the next message carry the new persona.
          }
        } catch (error) {
          console.error("Error initializing chat:", error);
        }
      };
      initChat();
    }
  }, [isActive, mode]);

  // TTS Effect
  useEffect(() => {
    if (isVoiceEnabled && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model' && !lastMsg.isError) {
        speakText(lastMsg.text);
      }
    }
  }, [messages, isVoiceEnabled]);

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    // Clean text of markdown somewhat for better speech
    const cleanText = text.replace(/[*#_`]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 0.9; // Slightly deeper voice for "Aethel"
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isThinking]);

  const handleActivate = () => {
    setIsActive(true);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = async () => {
          await video.play();
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext('2d');
          if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              setAttachment(canvas.toDataURL('image/png'));
              stream.getTracks().forEach(track => track.stop());
              video.srcObject = null;
          }
      };
    } catch (err) {
      console.error("Error capturing screen:", err);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachment) || !chatSession || isLoading) return;

    const currentInput = inputValue;
    const currentAttachment = attachment;
    
    setInputValue('');
    setAttachment(null);
    setIsLoading(true);
    setIsThinking(true); // Show thinking state

    setMessages(prev => [
      ...prev, 
      { role: 'user', text: currentInput, image: currentAttachment || undefined }
    ]);

    try {
      let responseText = '';
      let groundingSources: Array<{uri: string, title: string}> = [];
      
      let resultStream;
      
      if (currentAttachment) {
        const base64Data = currentAttachment.split(',')[1];
        const mimeType = currentAttachment.split(';')[0].split(':')[1];
        const parts = [
          { inlineData: { mimeType, data: base64Data } },
          { text: currentInput || "Analiza esta imagen." }
        ];
        resultStream = await chatSession.sendMessageStream({ message: parts });
      } else {
        resultStream = await chatSession.sendMessageStream({ message: currentInput });
      }

      for await (const chunk of resultStream) {
         // Once we start getting text, we are no longer "thinking" in the backend sense (mostly)
         setIsThinking(false);
         
         const chunkText = chunk.text;
         if (chunkText) {
             responseText += chunkText;
         }

         // Check for grounding metadata (Google Search results)
         const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
         if (groundingChunks) {
            groundingChunks.forEach((c: any) => {
                if (c.web) {
                    groundingSources.push({ uri: c.web.uri, title: c.web.title });
                }
            });
         }
      }

      setMessages(prev => [...prev, { 
          role: 'model', 
          text: responseText, 
          groundingSources: groundingSources.length > 0 ? groundingSources : undefined 
      }]);
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "La conexión con el conocimiento universal se ha interrumpido momentáneamente.", isError: true }]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isActive) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)',
        color: '#e2e8f0',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '2rem', color: '#fbbf24', animation: 'pulse-glow 3s infinite' }} className="fade-in">
            <Sparkles size={80} strokeWidth={1} />
        </div>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '0.5rem', fontFamily: 'serif', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} className="fade-in">Aethel</h1>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 300, color: '#94a3b8', marginBottom: '2rem' }} className="fade-in">Inteligencia Filosófica & Compañero Vital</h2>
        
        <p style={{ maxWidth: '600px', fontSize: '1.1rem', lineHeight: '1.7', marginBottom: '3rem', color: '#cbd5e1' }} className="fade-in">
          Más que un chat. Un espacio para la contemplación profunda, el debate hedonista y la búsqueda de la verdad.
          Conectado al conocimiento del mundo, diseñado para el alma humana.
        </p>
        
        <button 
          onClick={handleActivate}
          className="fade-in thinking-pulse"
          style={{
            padding: '1.2rem 3.5rem',
            fontSize: '1.1rem',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid #fbbf24',
            color: '#fbbf24',
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(4px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#fbbf24';
            e.currentTarget.style.color = '#0f172a';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
            e.currentTarget.style.color = '#fbbf24';
          }}
        >
          <BookOpen size={20} />
          Iniciar Sesión
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%',
      position: 'relative'
    }}>
      {/* Header */}
      <header className="glass-panel" style={{ 
        padding: '1rem 1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Feather size={24} color="#fbbf24" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.2rem', fontFamily: 'serif', color: '#e2e8f0', lineHeight: 1 }}>Aethel</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gemini 3 Flash • Connected</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
           {/* Mode Selector */}
           <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '4px', gap: '2px', marginRight: '10px' }}>
              {(['balanced', 'stoic', 'epicurean', 'skeptic'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  title={`Modo ${m.charAt(0).toUpperCase() + m.slice(1)}`}
                  style={{
                    background: mode === m ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: mode === m ? '#fbbf24' : '#64748b',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
           </div>

           <button 
             onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
             title={isVoiceEnabled ? "Silenciar voz" : "Activar voz"}
             style={{ background: 'transparent', border: 'none', color: isVoiceEnabled ? '#fbbf24' : '#64748b', cursor: 'pointer' }}
           >
             {isVoiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
           </button>
        </div>
      </header>

      {/* Messages Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '2rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2rem' 
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} className="fade-in" style={{ 
            display: 'flex', 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
          }}>
            <div style={{ 
              maxWidth: '75%', 
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{ 
                padding: '1.25rem 1.75rem', 
                borderRadius: '16px',
                borderTopLeftRadius: msg.role === 'user' ? '16px' : '4px',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                backgroundColor: msg.role === 'user' ? 'var(--user-msg-bg)' : 'var(--ai-msg-bg)',
                border: '1px solid var(--border-color)',
                color: '#e2e8f0',
                backdropFilter: 'blur(4px)'
              }}>
                {/* Image */}
                {msg.image && (
                  <div style={{ marginBottom: '12px' }}>
                    <img 
                      src={msg.image} 
                      alt="User attachment" 
                      style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
                    />
                  </div>
                )}
                
                {/* Text */}
                <div 
                  className={msg.role === 'model' ? 'font-serif markdown-content' : 'markdown-content'}
                  style={{ whiteSpace: 'pre-wrap', fontSize: msg.role === 'model' ? '1.05rem' : '1rem' }}
                >
                  {msg.text}
                </div>
              </div>

              {/* Grounding Sources */}
              {msg.groundingSources && msg.groundingSources.length > 0 && (
                 <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', width: '100%' }}>
                    {msg.groundingSources.map((source, i) => (
                       <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="source-chip">
                         <Globe size={10} style={{ marginRight: '4px' }}/>
                         {source.title || new URL(source.uri).hostname}
                       </a>
                    ))}
                 </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isThinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }} className="fade-in">
            <div style={{ 
              padding: '1rem', 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#94a3b8',
              fontStyle: 'italic',
              fontSize: '0.9rem'
            }}>
              <Brain className="animate-pulse" size={18} color="#fbbf24" />
              <span>Aethel está contemplando profundamente...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem', 
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        {attachment && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            backgroundColor: 'rgba(251, 191, 36, 0.1)', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            marginBottom: '12px',
            fontSize: '0.85rem',
            color: '#fbbf24',
            border: '1px solid rgba(251, 191, 36, 0.2)'
          }} className="fade-in">
            <ImageIcon size={14} />
            <span>Imagen para análisis</span>
            <button 
              onClick={() => setAttachment(null)}
              style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: 0, marginLeft: '4px', display: 'flex' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'flex-end',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          padding: '12px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar imagen"
              className="hover-btn"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px' }}
            >
              <ImageIcon size={20} />
            </button>

            <button 
              onClick={handleScreenCapture}
              title="Compartir pantalla"
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px' }}
            >
              <Monitor size={20} />
            </button>
            
            <button 
              onClick={toggleListening}
              title={isListening ? "Detener escucha" : "Hablar"}
              style={{ 
                background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent', 
                border: 'none', 
                color: isListening ? '#ef4444' : '#94a3b8', 
                cursor: 'pointer', 
                padding: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Escuchando..." : "Comparte tus inquietudes..."}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              padding: '10px',
              fontSize: '1.05rem',
              resize: 'none',
              outline: 'none',
              minHeight: '24px',
              maxHeight: '150px',
              fontFamily: 'inherit'
            }}
          />

          <button 
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !attachment) || isLoading}
            style={{
              background: (!inputValue.trim() && !attachment) || isLoading ? '#334155' : 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
              color: (!inputValue.trim() && !attachment) || isLoading ? '#64748b' : '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 14px',
              cursor: (!inputValue.trim() && !attachment) || isLoading ? 'default' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: (!inputValue.trim() && !attachment) || isLoading ? 'none' : '0 0 15px rgba(251, 191, 36, 0.3)'
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
