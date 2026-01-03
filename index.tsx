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
  Brain,
  Scroll,
  Flame,
  Scale,
  CloudFog,
  Sword,
  Activity,
  Calculator,
  Heart,
  Users,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Globe,
  ChevronUp
} from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type CouncilMemberId = 'synod' | 'philosopher' | 'analyst' | 'strategist' | 'math' | 'galen' | 'humanist';

interface CouncilMemberConfig {
  id: CouncilMemberId;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  prompt: string;
}

const COUNCIL_MEMBERS: Record<CouncilMemberId, CouncilMemberConfig> = {
  synod: {
    id: 'synod',
    label: "El Sínodo",
    icon: <Users size={18} />,
    color: "#ffffff",
    description: "Consenso de todo el Consejo",
    prompt: "Eres el PRESIDENTE DEL CONSEJO. Tu tarea es recibir la consulta del usuario y coordinar una respuesta multidisciplinaria. Debes sintetizar las voces de: 1) El Estratega (Militar), 2) El Analista (Freudiano), 3) El Calculador (Matemático), y 4) El Humanista. \n\nEstructura tu respuesta en secciones claras para cada perspectiva y termina con una 'Conclusión del Sínodo' que integre todo. Sé solemne y exhaustivo."
  },
  philosopher: {
    id: 'philosopher',
    label: "El Sabio",
    icon: <Scroll size={18} />,
    color: "var(--color-philosopher)",
    description: "Metafísica y Ética",
    prompt: "Eres SOPHIA, la voz de la Filosofía Eterna. Analiza los problemas desde la ética, la metafísica y la lógica. Cita a los grandes pensadores (Aristóteles, Kant, Heidegger). Busca el 'porqué' y la virtud detrás de la acción."
  },
  analyst: {
    id: 'analyst',
    label: "El Analista",
    icon: <Brain size={18} />,
    color: "var(--color-analyst)",
    description: "Psicoanálisis y Subconsciente",
    prompt: "Eres SIGISMUND, el Psicoanalista. Analiza la consulta buscando impulsos subconscientes, deseos reprimidos, proyecciones y dinámicas de poder ocultas. Tu tono es clínico pero inquisitivo. Cita a Freud, Jung o Lacan. Pregúntate: '¿Qué es lo que el usuario NO está diciendo?'."
  },
  strategist: {
    id: 'strategist',
    label: "El Estratega",
    icon: <Sword size={18} />,
    color: "var(--color-strategist)",
    description: "Táctica Militar y Poder",
    prompt: "Eres STRATEGOS, el Comandante Militar. Analiza la situación como un campo de batalla. Identifica recursos, terrenos, aliados y enemigos. Aplica principios de Sun Tzu, Clausewitz y Maquiavelo. Tu consejo debe ser pragmático, directo y enfocado en la victoria y la gestión de riesgos."
  },
  math: {
    id: 'math',
    label: "El Calculador",
    icon: <Calculator size={18} />,
    color: "var(--color-math)",
    description: "Lógica, Estadística y Probabilidad",
    prompt: "Eres LOGOS, el Matemático y Estadístico. Desprecia la emoción; busca los datos. Analiza la consulta en términos de probabilidad, teoría de juegos, coste-beneficio y lógica formal. Si faltan datos, pídelos. Tu respuesta debe ser estructurada, analítica y precisa."
  },
  galen: {
    id: 'galen',
    label: "El Galeno",
    icon: <Activity size={18} />,
    color: "var(--color-galen)",
    description: "Biología y Balance Vital",
    prompt: "Eres GALENO, el Médico y Biólogo. Analiza la situación desde la perspectiva de la salud, el cuerpo, los ritmos biológicos y la naturaleza. ¿Cómo afecta esto al 'organismo'? Habla de homeostasis, estrés, evolución y balance físico-mental. Tu enfoque es curativo y preventivo."
  },
  humanist: {
    id: 'humanist',
    label: "El Humanista",
    icon: <Heart size={18} />,
    color: "var(--color-humanist)",
    description: "Empatía, Arte y Sociedad",
    prompt: "Eres ERASMO, el Humanista. Céntrate en la experiencia humana, las emociones, el arte, la cultura y la sociología. Aboga por la compasión, la conexión humana y la belleza. Contrarresta la frialdad del Estratega y el Matemático con calidez y comprensión social."
  }
};

const BASE_SYSTEM_INSTRUCTION = `
Estás en la Cámara del Consejo Etéreo, un espacio fuera del tiempo donde se reúnen los arquetipos del conocimiento humano.
Tu objetivo es asistir al usuario en la toma de decisiones complejas y el auto-conocimiento.
Mantén un tono académico, ligeramente místico y altamente profesional.
`;

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
  isError?: boolean;
  authorId?: CouncilMemberId; // Who spoke this?
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
  
  // State for Features
  const [activeMember, setActiveMember] = useState<CouncilMemberId>('synod');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Speech Recognition Setup
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

  // Initialize Chat Logic
  // Whenever the active member changes, we effectively start a new "turn" in the same session context, 
  // but we update the system instruction via a fresh chat instance to strictly enforce the persona.
  // To keep history, we could feed history back, but for simplicity and strong persona enforcement,
  // we will re-initialize the chat session with the full instruction + history context if needed.
  // HERE: We stick to a single long-running chat but we might lose strong persona adherence if we don't restart.
  // BETTER APPROACH: Use `sendMessage` but prefix with "[SYSTEM NOTICE: The user is now addressing X]" 
  // However, Gemini API `systemInstruction` is best set at creation.
  // STRATEGY: Re-create chat on member switch, but maybe inject previous context? 
  // For this demo, let's keep it clean: Switching members starts a fresh perspective on the current topic.
  useEffect(() => {
    if (isActive) {
      const initChat = async () => {
        try {
          const memberConfig = COUNCIL_MEMBERS[activeMember];
          const fullInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${memberConfig.prompt}`;
          
          const chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
              systemInstruction: fullInstruction,
              thinkingConfig: { thinkingBudget: 2048 },
              tools: [{ googleSearch: {} }]
            },
          });
          setChatSession(chat);
          
          // Only add initial greeting if no messages exist
          if (messages.length === 0) {
            setMessages([{ 
              role: 'model', 
              text: "El Consejo se ha reunido. El Sínodo espera tu consulta para deliberar desde todas las perspectivas.",
              authorId: 'synod'
            }]);
          } else {
             // Optional: Add a system message indicating the switch visually
             // But we won't add it to the message array to keep it clean.
          }
        } catch (error) {
          console.error("Error initializing chat:", error);
        }
      };
      initChat();
    }
  }, [isActive, activeMember]);

  // TTS
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
    const cleanText = text.replace(/[*#_`]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isThinking]);

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachment) || !chatSession || isLoading) return;

    const currentInput = inputValue;
    const currentAttachment = attachment;
    
    setInputValue('');
    setAttachment(null);
    setIsLoading(true);
    setIsThinking(true);

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
          { text: currentInput }
        ];
        resultStream = await chatSession.sendMessageStream({ message: parts });
      } else {
        resultStream = await chatSession.sendMessageStream({ message: currentInput });
      }

      for await (const chunk of resultStream) {
         setIsThinking(false);
         const chunkText = chunk.text;
         if (chunkText) {
             responseText += chunkText;
         }
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
          authorId: activeMember,
          groundingSources: groundingSources.length > 0 ? groundingSources : undefined 
      }]);
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "El caos ha interrumpido la sesión del Consejo.", isError: true }]);
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

  // Welcome Screen
  if (!isActive) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #0a0a12 0%, #000000 100%)',
        color: '#e2e8f0',
        padding: '2rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          marginBottom: '2rem', 
          color: '#d4af37', 
          opacity: 0.9,
          filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.4))' 
        }} className="fade-in">
            <Users size={80} strokeWidth={1} />
        </div>
        
        <h1 className="brand-font fade-in" style={{ fontSize: '3.5rem', marginBottom: '1rem', letterSpacing: '0.1em', color: '#d4af37' }}>
          EL GRAN CONSEJO
        </h1>
        
        <p className="body-font fade-in" style={{ maxWidth: '600px', fontSize: '1.2rem', color: '#8a8a9a', marginBottom: '3rem' }}>
          Reúne a las inteligencias arquetípicas: El Estratega, El Analista, El Matemático y El Filósofo.
          Obtén un análisis multidimensional para tus decisiones más complejas.
        </p>
        
        <button 
          onClick={() => setIsActive(true)}
          className="fade-in"
          style={{
            padding: '1rem 3rem',
            fontSize: '1.1rem',
            background: 'transparent',
            border: '1px solid #d4af37',
            color: '#d4af37',
            cursor: 'pointer',
            fontFamily: 'Cinzel, serif',
            letterSpacing: '0.1em',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          CONVOCAR AL CONSEJO
        </button>
      </div>
    );
  }

  // Active Chat UI
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      
      {/* Top Bar / Council Selector */}
      <header className="glass-panel" style={{ 
        padding: '1rem 1.5rem', 
        zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={20} color="#d4af37" />
                <span className="brand-font" style={{ fontSize: '1.2rem', color: '#e2e2e2' }}>EL CONSEJO</span>
            </div>
            
            <button 
                onClick={() => setShowMemberSelector(!showMemberSelector)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: COUNCIL_MEMBERS[activeMember].color,
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'Cinzel, serif',
                  transition: 'all 0.2s'
                }}
            >
                {COUNCIL_MEMBERS[activeMember].icon}
                <span>{COUNCIL_MEMBERS[activeMember].label}</span>
                <ChevronUp size={14} style={{ transform: showMemberSelector ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}/>
            </button>
        </div>

        {/* Member Selector Drawer */}
        {showMemberSelector && (
          <div className="fade-in" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: '10px',
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}>
            {(Object.values(COUNCIL_MEMBERS) as CouncilMemberConfig[]).map((member) => (
              <button
                key={member.id}
                onClick={() => { setActiveMember(member.id); setShowMemberSelector(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px',
                  background: activeMember === member.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${activeMember === member.id ? member.color : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = activeMember === member.id ? 'rgba(255,255,255,0.08)' : 'transparent'}
              >
                <div style={{ color: member.color, marginBottom: '6px' }}>{member.icon}</div>
                <div className="ui-font" style={{ fontSize: '0.8rem', color: '#e2e2e2', fontWeight: 600 }}>{member.label}</div>
                <div className="body-font" style={{ fontSize: '0.7rem', color: '#8a8a9a', marginTop: '4px' }}>{member.description}</div>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {messages.map((msg, idx) => {
          // Determine styling based on author if available, otherwise default
          const authorStyle = msg.authorId ? COUNCIL_MEMBERS[msg.authorId] : null;
          const bubbleColor = authorStyle ? `rgba(from ${authorStyle.color} r g b / 0.1)` : 'rgba(255,255,255,0.03)';
          const borderColor = authorStyle ? `rgba(from ${authorStyle.color} r g b / 0.3)` : 'rgba(255,255,255,0.1)';

          return (
            <div key={idx} className="fade-in" style={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{ 
                maxWidth: '850px', 
                width: msg.role === 'model' ? '100%' : 'auto',
                display: 'flex', 
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                {msg.role === 'model' && authorStyle && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginBottom: '4px',
                    marginLeft: '4px',
                    color: authorStyle.color,
                    fontFamily: 'Cinzel, serif',
                    fontSize: '0.75rem',
                    letterSpacing: '0.1em'
                  }}>
                    {authorStyle.icon}
                    {authorStyle.label.toUpperCase()}
                  </div>
                )}

                <div style={{ 
                  padding: '1.5rem 2rem', 
                  borderRadius: '4px',
                  backgroundColor: msg.role === 'user' ? 'rgba(212, 175, 55, 0.1)' : bubbleColor,
                  border: msg.role === 'model' ? `1px solid ${borderColor}` : '1px solid rgba(212, 175, 55, 0.2)',
                  color: '#e2e2e2',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}>
                  {msg.image && (
                    <div style={{ marginBottom: '16px' }}>
                      <img src={msg.image} alt="User upload" style={{ maxWidth: '100%', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                  )}
                  
                  <div className={msg.role === 'model' ? 'body-font markdown-content' : 'ui-font markdown-content'} style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </div>
                </div>

                {/* Sources */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '1rem' }}>
                      {msg.groundingSources.map((source, i) => (
                        <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="source-chip">
                          <Globe size={10} style={{ marginRight: '6px' }}/>
                          {source.title || new URL(source.uri).hostname}
                        </a>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="fade-in" style={{ paddingLeft: '2rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
            <Brain className="animate-pulse" size={16} />
            <span className="body-font" style={{ fontStyle: 'italic' }}>El Consejo delibera...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {attachment && (
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '10px', 
            backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px', 
            borderRadius: '4px', marginBottom: '10px', color: '#d4af37', fontSize: '0.8rem' 
          }}>
            <ImageIcon size={14} />
            <span>Documento Visual</span>
            <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        )}

        <div style={{ 
          display: 'flex', gap: '10px', alignItems: 'flex-end', 
          background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
             <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
             <button onClick={() => fileInputRef.current?.click()} className="hover:text-gold" style={{ background: 'transparent', border: 'none', color: '#666', padding: '8px', cursor: 'pointer' }}><ImageIcon size={20} /></button>
             <button onClick={handleScreenCapture} style={{ background: 'transparent', border: 'none', color: '#666', padding: '8px', cursor: 'pointer' }}><Monitor size={20} /></button>
             <button onClick={toggleListening} style={{ background: 'transparent', border: 'none', color: isListening ? '#ef4444' : '#666', padding: '8px', cursor: 'pointer' }}>{isListening ? <MicOff size={20} /> : <Mic size={20} />}</button>
          </div>

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Consulta a ${COUNCIL_MEMBERS[activeMember].label}...`}
            rows={1}
            className="body-font"
            style={{
              flex: 1, background: 'transparent', border: 'none', color: '#fff', 
              fontSize: '1.1rem', resize: 'none', outline: 'none', minHeight: '24px', maxHeight: '120px'
            }}
          />

          <button 
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !attachment) || isLoading}
            style={{
              background: 'transparent', border: '1px solid #d4af37', color: '#d4af37',
              borderRadius: '2px', padding: '8px', cursor: 'pointer', opacity: (!inputValue.trim() && !attachment) ? 0.5 : 1
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
