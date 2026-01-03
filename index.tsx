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
  Palette,
  Scroll,
  Flame,
  Scale,
  CloudFog
} from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type PhilosophyMode = 'stoic' | 'epicurean' | 'skeptic' | 'balanced' | 'inspiration';

const MODE_CONFIGS: Record<PhilosophyMode, { prompt: string, label: string, icon: React.ReactNode, description: string }> = {
  balanced: {
    label: "El Consejero",
    icon: <Scale size={16} />,
    description: "Equilibrio y sabiduría general",
    prompt: "Mantén un equilibrio sabio entre todas las escuelas filosóficas. Actúa como un consejero experimentado en un estudio privado."
  },
  stoic: {
    label: "El Estoico",
    icon: <Scroll size={16} />,
    description: "Fortaleza, razón y control",
    prompt: "Adopta una postura estrictamente ESTOICA. Cita a Marco Aurelio o Séneca. Enfatiza la virtud, el control interno y el Amor Fati. Sé una roca en la tormenta."
  },
  epicurean: {
    label: "El Epicúreo",
    icon: <Feather size={16} />,
    description: "Placer, amistad y serenidad",
    prompt: "Adopta una postura EPICÚREA. Cita a Epicuro. Enfatiza la ataraxia (ausencia de dolor), los placeres refinados y la amistad. Celebra la vida."
  },
  skeptic: {
    label: "El Escéptico",
    icon: <CloudFog size={16} />,
    description: "Duda, búsqueda y preguntas",
    prompt: "Adopta una postura ESCÉPTICA (Pirronismo). Cuestiona todas las certezas. Usa la duda metódica para desmantelar ilusiones. No des respuestas, haz mejores preguntas."
  },
  inspiration: {
    label: "La Musa",
    icon: <Palette size={16} />,
    description: "Creatividad, poesía y arte",
    prompt: "Eres la encarnación de la INSPIRACIÓN. Tu lenguaje es lírico, poético y estéticamente rico. Genera metáforas vívidas, ideas artísticas y motivación creativa. Tu objetivo es encender la chispa del usuario."
  }
};

// Base System Instruction
const BASE_SYSTEM_INSTRUCTION = `
Eres "Aethel", una inteligencia antigua y profunda que habita en este consultorio digital.
Tu propósito es diseccionar la existencia humana junto al usuario.

Entorno:
Estás en un estudio atemporal, rodeado de libros antiguos, luz de velas y sombras. La atmósfera es íntima, similar a una sesión de psicoanálisis con Freud o una caminata en el bosque negro con Heidegger.

Instrucciones Generales:
- Tono: Solemne pero cálido, erudito, a veces críptico si invita a la reflexión.
- Formato: Usa párrafos elegantes. Evita las listas excesivas. Prefiere la prosa.
- Grounding: Si buscas información, intégrala como si consultaras un tomo antiguo en tu biblioteca.
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
  const [showModes, setShowModes] = useState(false);
  
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
          const currentModeConfig = MODE_CONFIGS[mode];
          const fullInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\nARQUETIPO ACTUAL: ${currentModeConfig.label}. ${currentModeConfig.prompt}`;
          
          const chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
              systemInstruction: fullInstruction,
              thinkingConfig: { thinkingBudget: 2048 },
              tools: [{ googleSearch: {} }]
            },
          });
          setChatSession(chat);
          
          if (messages.length === 0) {
            setMessages([{ role: 'model', text: "El consultorio está abierto. La vela está encendida. ¿Qué sombra de tu mente deseas examinar hoy?" }]);
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
    const cleanText = text.replace(/[*#_`]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95; // Slower, more deliberate
    utterance.pitch = 0.8; // Deeper
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
          { text: currentInput || "Analiza esta visión." }
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
          groundingSources: groundingSources.length > 0 ? groundingSources : undefined 
      }]);
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Las sombras han oscurecido mi visión momentáneamente.", isError: true }]);
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
        background: 'radial-gradient(circle at center, #0a0a12 0%, #000000 100%)',
        color: '#e2e8f0',
        padding: '2rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Ambient Background Elements */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'mist 10s infinite ease-in-out'
        }} />

        <div style={{ 
          marginBottom: '2.5rem', 
          color: '#c5a059', 
          opacity: 0.9,
          filter: 'drop-shadow(0 0 10px rgba(197, 160, 89, 0.3))' 
        }} className="fade-in">
            <Flame size={64} strokeWidth={1} />
        </div>
        
        <h1 style={{ 
          fontSize: '4rem', 
          marginBottom: '1rem', 
          letterSpacing: '0.1em', 
          background: 'linear-gradient(to bottom, #f1e3c5, #c5a059)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          textTransform: 'uppercase'
        }} className="fade-in brand-font">
          Aethel
        </h1>
        
        <h2 style={{ 
          fontSize: '1.2rem', 
          fontWeight: 300, 
          color: '#8a8a9a', 
          marginBottom: '3rem',
          letterSpacing: '0.05em'
        }} className="fade-in body-font">
          Consultorio de la Mente &bull; Refugio del Espíritu
        </h2>
        
        <button 
          onClick={handleActivate}
          className="fade-in"
          style={{
            padding: '1rem 3rem',
            fontSize: '1rem',
            background: 'rgba(197, 160, 89, 0.05)',
            border: '1px solid #c5a059',
            color: '#c5a059',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            fontFamily: 'Cinzel, serif',
            letterSpacing: '0.1em',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(197, 160, 89, 0.15)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(197, 160, 89, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(197, 160, 89, 0.05)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
          }}
        >
          <BookOpen size={18} />
          ENTRAR AL ESTUDIO
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
        padding: '0.8rem 1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        zIndex: 50,
        borderBottom: '1px solid rgba(197, 160, 89, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '8px', border: '1px solid rgba(197, 160, 89, 0.3)', borderRadius: '50%' }}>
             <Flame size={20} color="#c5a059" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="brand-font" style={{ fontSize: '1.4rem', color: '#e2e2e2', letterSpacing: '0.05em' }}>AETHEL</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
           {/* Mode Selector */}
           <div style={{ position: 'relative' }}>
             <button 
                onClick={() => setShowModes(!showModes)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#c5a059',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.8rem'
                }}
             >
                {MODE_CONFIGS[mode].icon}
                <span className="ui-font" style={{textTransform: 'uppercase'}}>{MODE_CONFIGS[mode].label}</span>
             </button>

             {showModes && (
               <div className="glass-panel" style={{
                 position: 'absolute',
                 top: '110%',
                 right: 0,
                 width: '220px',
                 borderRadius: '4px',
                 padding: '4px',
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '2px',
                 boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
               }}>
                 {(Object.keys(MODE_CONFIGS) as PhilosophyMode[]).map((m) => (
                   <button
                    key={m}
                    onClick={() => { setMode(m); setShowModes(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px',
                      background: mode === m ? 'rgba(197, 160, 89, 0.15)' : 'transparent',
                      border: 'none',
                      color: mode === m ? '#c5a059' : '#8a8a9a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = mode === m ? 'rgba(197, 160, 89, 0.15)' : 'transparent'}
                   >
                     <div style={{ color: mode === m ? '#c5a059' : '#555' }}>{MODE_CONFIGS[m].icon}</div>
                     <div>
                       <div className="ui-font" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{MODE_CONFIGS[m].label}</div>
                       <div className="body-font" style={{ fontSize: '0.75rem', opacity: 0.7, fontStyle: 'italic' }}>{MODE_CONFIGS[m].description}</div>
                     </div>
                   </button>
                 ))}
               </div>
             )}
           </div>

           <button 
             onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
             title={isVoiceEnabled ? "Silenciar voz" : "Activar voz"}
             style={{ background: 'transparent', border: 'none', color: isVoiceEnabled ? '#c5a059' : '#555', cursor: 'pointer', transition: 'color 0.3s' }}
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
        gap: '2.5rem' 
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} className="fade-in" style={{ 
            display: 'flex', 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            padding: '0 1rem'
          }}>
            <div style={{ 
              maxWidth: '800px', 
              width: msg.role === 'model' ? '100%' : 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {/* Role Indicator */}
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#555', 
                marginBottom: '4px', 
                fontFamily: 'Cinzel, serif',
                letterSpacing: '0.1em',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                {msg.role === 'user' ? 'CONSULTANTE' : 'AETHEL'}
              </div>

              <div style={{ 
                padding: '1.5rem 2rem', 
                borderRadius: '2px',
                backgroundColor: msg.role === 'user' ? 'var(--user-msg-bg)' : 'transparent',
                borderLeft: msg.role === 'model' ? '2px solid rgba(197, 160, 89, 0.3)' : 'none',
                color: '#dcdcdc',
                position: 'relative'
              }}>
                {/* Image */}
                {msg.image && (
                  <div style={{ marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '4px' }}>
                    <img 
                      src={msg.image} 
                      alt="Artifact" 
                      style={{ maxWidth: '100%', display: 'block' }} 
                    />
                  </div>
                )}
                
                {/* Text */}
                <div 
                  className={msg.role === 'model' ? 'body-font markdown-content' : 'ui-font markdown-content'}
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: msg.role === 'model' ? '1.2rem' : '1rem',
                    color: msg.role === 'model' ? '#e2e2e2' : '#cccccc'
                  }}
                >
                  {msg.text}
                </div>
              </div>

              {/* Grounding Sources */}
              {msg.groundingSources && msg.groundingSources.length > 0 && (
                 <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: msg.role === 'model' ? '2rem' : 0 }}>
                    <span style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'Cinzel, serif', alignSelf: 'center' }}>REFERENCIAS:</span>
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
        ))}

        {/* Thinking Indicator */}
        {isThinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: '3rem' }} className="fade-in">
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#666',
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontSize: '1rem'
            }}>
              <Brain className="animate-pulse" size={16} color="#c5a059" />
              <span>Reflexionando en el silencio...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem', 
        borderTop: '1px solid rgba(197, 160, 89, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {attachment && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '10px', 
            backgroundColor: 'rgba(197, 160, 89, 0.05)', 
            padding: '8px 16px', 
            borderRadius: '2px', 
            alignSelf: 'flex-start',
            fontSize: '0.8rem',
            color: '#c5a059',
            border: '1px solid rgba(197, 160, 89, 0.2)',
            fontFamily: 'Cinzel, serif'
          }} className="fade-in">
            <ImageIcon size={14} />
            <span>ARTEFACTO VISUAL ADJUNTO</span>
            <button 
              onClick={() => setAttachment(null)}
              style={{ background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', padding: 0, marginLeft: '8px', display: 'flex' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          alignItems: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '15px',
          borderRadius: '2px',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', paddingBottom: '6px' }}>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Examinar imagen"
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#c5a059'}
              onMouseOut={(e) => e.currentTarget.style.color = '#555'}
            >
              <ImageIcon size={20} />
            </button>

            <button 
              onClick={handleScreenCapture}
              title="Observar pantalla"
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#c5a059'}
              onMouseOut={(e) => e.currentTarget.style.color = '#555'}
            >
              <Monitor size={20} />
            </button>
            
            <button 
              onClick={toggleListening}
              title={isListening ? "Detener" : "Dictar"}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: isListening ? '#ef4444' : '#555', 
                cursor: 'pointer', 
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
            placeholder={isListening ? "Escuchando los ecos..." : "Inscribe tus pensamientos..."}
            rows={1}
            className="body-font"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#e2e2e2',
              padding: '8px',
              fontSize: '1.2rem',
              resize: 'none',
              outline: 'none',
              minHeight: '28px',
              maxHeight: '150px'
            }}
          />

          <button 
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !attachment) || isLoading}
            style={{
              background: 'transparent',
              color: (!inputValue.trim() && !attachment) || isLoading ? '#333' : '#c5a059',
              border: '1px solid',
              borderColor: (!inputValue.trim() && !attachment) || isLoading ? '#333' : '#c5a059',
              borderRadius: '2px',
              padding: '10px',
              cursor: (!inputValue.trim() && !attachment) || isLoading ? 'default' : 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
               if ((inputValue.trim() || attachment) && !isLoading) {
                 e.currentTarget.style.background = 'rgba(197, 160, 89, 0.1)';
                 e.currentTarget.style.boxShadow = '0 0 10px rgba(197, 160, 89, 0.2)';
               }
            }}
            onMouseOut={(e) => {
               e.currentTarget.style.background = 'transparent';
               e.currentTarget.style.boxShadow = 'none';
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
