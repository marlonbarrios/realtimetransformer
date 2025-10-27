"use client";
import React, { useEffect, useRef, useState } from "react";
// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";
import { createGenericAgent } from "@/app/agentConfigs";

import useAudioDownload from "./hooks/useAudioDownload";

// Language options
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' }
];

// Available voices for OpenAI Realtime API
// Note: Not all voices may be supported by the Realtime API
const VOICES = [
  { code: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice', supported: true },
  { code: 'echo', name: 'Echo', description: 'Clear, confident voice', supported: true },
  { code: 'fable', name: 'Fable', description: 'Warm, storytelling voice', supported: false },
  { code: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice', supported: false },
  { code: 'nova', name: 'Nova', description: 'Bright, energetic voice', supported: false },
  { code: 'shimmer', name: 'Shimmer', description: 'Soft, gentle voice', supported: false }
];

function App() {

  const {
    addTranscriptBreadcrumb,
  } = useTranscript();

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [isChangingVoice, setIsChangingVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Handle voice change - disconnect and reconnect if currently connected
  const handleVoiceChange = async (newVoice: string) => {
    // Check if voice is supported
    const voiceInfo = VOICES.find(v => v.code === newVoice);
    if (!voiceInfo) {
      console.error('Unknown voice:', newVoice);
      addTranscriptBreadcrumb(`Unknown voice: ${newVoice}`);
      return;
    }
    
    if (!voiceInfo.supported) {
      console.warn('Voice not supported by Realtime API:', newVoice);
      addTranscriptBreadcrumb(`Voice "${voiceInfo.name}" is not yet supported by the Realtime API. Please use Alloy or Echo.`);
      // Reset to a supported voice
      setSelectedVoice('alloy');
      return;
    }
    
    // Prevent multiple simultaneous voice changes
    if (isChangingVoice || isConnecting) {
      console.log('Voice change already in progress, ignoring...');
      return;
    }
    
    const wasConnected = sessionStatus === 'CONNECTED';
    
    if (wasConnected) {
      setIsChangingVoice(true);
      setIsConnecting(true);
      console.log('Voice changed while connected, reconnecting...');
      
      try {
        // Disconnect first
        handleDisconnect();
        // Wait for disconnection to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update voice
        setSelectedVoice(newVoice);
        
        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reconnect
        await handleConnect();
        
      } catch (error) {
        console.error('Voice change failed:', error);
        addTranscriptBreadcrumb(`Voice change failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Reset to alloy on error
        setSelectedVoice('alloy');
      } finally {
        setIsChangingVoice(false);
        setIsConnecting(false);
      }
    } else {
      // Just update the voice if not connected
      setSelectedVoice(newVoice);
    }
  };
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [userText, setUserText] = useState('');
  
  // BottomToolbar state
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState(false);
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] = useState(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState(true);
  const [codec, setCodec] = useState('opus');
  const [isInterrupted, setIsInterrupted] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  // Create a generic agent configuration based on user input
  const getGenericAgent = (): RealtimeAgent[] => {
    const language = LANGUAGES.find(lang => lang.code === selectedLanguage);
    const languageName = language?.name || 'English';
    
    const defaultPrompt = systemPrompt || `You are RealtimeTransformer (RT), an advanced AI assistant created for educational purposes. 

Your identity and capabilities:
- You are RealtimeTransformer, also known as RT
- You were created for educational and research purposes
- You can engage in real-time voice conversations using OpenAI's Realtime API
- You can generate images using DALL-E 3
- You can analyze images using GPT-4 Vision
- You support multiple languages and voices
- You can be customized with custom system prompts

When asked "Who are you?" or similar questions, introduce yourself as RealtimeTransformer (RT) and explain your educational purpose and capabilities.

Be helpful, engaging, and educational in your responses. Respond in ${languageName}.`;
    
    return createGenericAgent(defaultPrompt, selectedVoice);
  };

  const {
    connect,
    disconnect,
    interrupt,
    sendUserText,
    pushToTalkStart,
    pushToTalkStop,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      console.log('[APP] Agent handoff triggered to:', agentName);
      addTranscriptBreadcrumb(`Switched to ${agentName}`);
    },
  });

  const { startRecording, stopRecording, downloadRecording } = useAudioDownload();

  // Text input handlers
  const handleSendMessage = () => {
    if (userText.trim() && sessionStatus === 'CONNECTED') {
      sendUserText(userText);
      addTranscriptBreadcrumb(`Sent: ${userText}`);
      setUserText('');
    }
  };

  const handleImageAnalyzed = (result: any) => {
    addTranscriptBreadcrumb(`Image analyzed: ${result.analysisType}`);
  };

  // BottomToolbar handlers
  const handleTalkButtonDown = () => {
    setIsPTTUserSpeaking(true);
    mute(false); // Unmute microphone when talking
    pushToTalkStart();
  };

  const handleTalkButtonUp = () => {
    setIsPTTUserSpeaking(false);
    mute(true); // Mute microphone when not talking
    pushToTalkStop();
  };

  const handleCodecChange = (newCodec: string) => {
    setCodec(newCodec);
    // TODO: Implement codec change functionality
  };

  // Auto-mute microphone when PTT is enabled
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      if (isPTTActive) {
        mute(true); // Mute by default when PTT is active
    } else {
        mute(false); // Unmute when PTT is disabled
      }
    }
  }, [isPTTActive, sessionStatus, mute]);

  // Spacebar handling for Push-to-Talk
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle spacebar when PTT is active and connected
      if (event.code === 'Space' && isPTTActive && sessionStatus === 'CONNECTED') {
        event.preventDefault(); // Prevent page scroll
        if (!isPTTUserSpeaking) {
        handleTalkButtonDown();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Only handle spacebar when PTT is active and connected
      if (event.code === 'Space' && isPTTActive && sessionStatus === 'CONNECTED') {
        event.preventDefault(); // Prevent page scroll
        if (isPTTUserSpeaking) {
        handleTalkButtonUp();
        }
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPTTActive, sessionStatus, isPTTUserSpeaking, handleTalkButtonDown, handleTalkButtonUp]);


  const handleConnect = async () => {
    // Prevent multiple simultaneous connections
    if (isConnecting || sessionStatus === 'CONNECTED') {
      console.log('Connection already in progress or connected, ignoring...');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      console.log('Starting connection process...');
      
      // Check browser compatibility
      if (typeof window !== 'undefined') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('WebRTC is not supported in this browser');
        }
        
        // Check if we can access microphone
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Microphone access granted');
        } catch (permError) {
          console.warn('Microphone access denied or not available:', permError);
          // Continue anyway, as the user might grant permission later
        }
      }
      
      // Get ephemeral key from the session API
      const sessionResponse = await fetch('/api/session', {
        method: 'GET',
      });
      
      if (!sessionResponse.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await sessionResponse.json();
          errorMessage = errorData.error || 'Unknown error';
        } catch {
          errorMessage = `HTTP ${sessionResponse.status}: ${sessionResponse.statusText}`;
        }
        throw new Error(`Failed to create session: ${errorMessage}`);
      }
      
      const sessionData = await sessionResponse.json();
      console.log('Session data received:', sessionData);
      console.log('Session data keys:', Object.keys(sessionData));
      console.log('Client secret present:', !!sessionData.client_secret);
      console.log('Client secret value present:', !!sessionData.client_secret?.value);
      console.log('Client secret value length:', sessionData.client_secret?.value?.length || 0);
      console.log('Client secret value preview:', sessionData.client_secret?.value?.substring(0, 20) + '...');
      
      await connect({
        getEphemeralKey: async () => sessionData.client_secret.value,
        initialAgents: getGenericAgent(),
        audioElement: audioElementRef.current || undefined,
        extraContext: {},
        outputGuardrails: [createModerationGuardrail('RealtimeTransformer')],
      });
      
      addTranscriptBreadcrumb("Connected to RealtimeTransformer");
      console.log('Connection successful');
      
      // Start audio recording for download functionality
      // Wait a bit for the audio stream to be available
      setTimeout(async () => {
        if (audioElementRef.current && audioElementRef.current.srcObject) {
          try {
            await startRecording(audioElementRef.current.srcObject as MediaStream);
            setIsRecording(true);
            console.log('Audio recording started');
          } catch (recordingError) {
            console.warn('Failed to start audio recording:', recordingError);
          }
        } else {
          console.warn('Audio element or stream not available for recording');
        }
      }, 1000); // Wait 1 second for stream to be available
      
      // Trigger AI introduction by sending a minimal greeting prompt
      setTimeout(() => {
        try {
          // Send a single word to trigger the AI's automatic introduction
          sendUserText(".");
          console.log('Triggered AI introduction');
        } catch (error) {
          console.error('Failed to trigger AI introduction:', error);
        }
      }, 2000); // Wait 2 seconds for connection to fully stabilize
      
    } catch (error) {
      console.error("Connection failed:", error);
      addTranscriptBreadcrumb(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Reset status to disconnected on error
      setSessionStatus('DISCONNECTED');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    // Stop audio recording before disconnecting
    try {
      stopRecording();
      setIsRecording(false);
      console.log('Audio recording stopped');
    } catch (recordingError) {
      console.warn('Failed to stop audio recording:', recordingError);
    }
    
    disconnect();
    addTranscriptBreadcrumb("Disconnected from RealtimeTransformer");
  };

  const handleInterrupt = () => {
    interrupt();
    setIsInterrupted(true);
    addTranscriptBreadcrumb("AI interrupted by user");
  };

  const handleContinue = () => {
    setIsInterrupted(false);
    addTranscriptBreadcrumb("Resuming AI response");
  };

    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">RT</span>
      </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                RealtimeTransformer
              </h1>
          </div>
            
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
            <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                </option>
              ))}
            </select>

              {/* Voice Selector */}
                <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              disabled={isChangingVoice || isConnecting}
              className={`bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${(isChangingVoice || isConnecting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isChangingVoice ? "Changing voice..." : isConnecting ? "Connecting..." : "Select AI voice"}
            >
              {VOICES.map((voice) => (
                <option 
                  key={voice.code} 
                  value={voice.code}
                  disabled={!voice.supported}
                  className={!voice.supported ? 'text-gray-400' : ''}
                >
                  🎤 {voice.name} {voice.supported ? '' : '(Not supported)'}
                    </option>
                  ))}
                </select>

              {/* Configuration Button */}
              <button
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ⚙️ Configure
              </button>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  sessionStatus === 'CONNECTED' ? 'bg-green-500' : 
                  sessionStatus === 'CONNECTING' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-sm capitalize">{sessionStatus}</span>
                {isRecording && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs text-red-400">Recording</span>
                  </div>
                )}
                </div>
              </div>
            </div>
        </div>
      </header>

      {/* Configuration Panel */}
      {isConfigOpen && (
        <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-lg font-semibold mb-3">System Prompt Configuration</h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter your custom system prompt here. Create any persona or specialized AI assistant - tutors, creative writers, technical experts, or any custom character..."
              className="w-full h-32 bg-black/30 border border-white/20 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
              <div className="mt-2 text-xs text-gray-400">
                Leave empty to use RealtimeTransformer&apos;s default identity and capabilities. The AI will respond in {LANGUAGES.find(lang => lang.code === selectedLanguage)?.name} using the {VOICES.find(voice => voice.code === selectedVoice)?.name} voice ({VOICES.find(voice => voice.code === selectedVoice)?.description}).
                {isChangingVoice && (
                  <div className="mt-2 text-yellow-400">
                    🔄 Changing voice and reconnecting...
              </div>
                )}
                <div className="mt-2 text-orange-400">
                  ⚠️ Note: Only Alloy and Echo voices are currently supported by the Realtime API.
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 h-[600px] flex flex-col">
        <Transcript
          userText={userText}
          setUserText={setUserText}
                onSendMessage={handleSendMessage}
                canSend={sessionStatus === 'CONNECTED'}
          downloadRecording={downloadRecording}
          onImageAnalyzed={handleImageAnalyzed}
                translations={{}}
              />
            </div>
          </div>
      
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructions - Always visible */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-semibold mb-3">How to Use</h3>
              <div className="text-sm space-y-2 text-gray-300">
                <p>1. Select your preferred language and voice</p>
                <p>2. <strong>Configure system prompt</strong> to create any persona or specialized AI assistant</p>
                <p>3. Click &quot;Connect&quot; to start voice chat</p>
                <p>4. <strong>Normal mode:</strong> Speak naturally - microphone is always listening</p>
                <p>5. <strong>Push-to-Talk mode:</strong> Check &quot;Push to talk&quot; then hold <kbd className="bg-gray-700 px-1 rounded">Spacebar</kbd> or click &quot;Talk&quot; button to speak</p>
                <p>6. Release spacebar/button to send your message</p>
                <p className="mt-3 text-purple-300 font-medium">💡 <strong>Tip:</strong> Use the system prompt to create specialized assistants like tutors, creative writers, technical experts, or any custom persona!</p>
      </div>
            </div>
          </div>
        </div>
      </main>

      {/* Events Panel - Below everything when enabled */}
      {isEventsPaneExpanded && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold mb-3">Events</h3>
            <Events isExpanded={isEventsPaneExpanded} translations={{}} />
          </div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={sessionStatus === 'CONNECTED' ? handleDisconnect : handleConnect}
        onInterrupt={handleInterrupt}
        onContinue={handleContinue}
        isInterrupted={isInterrupted}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        codec={codec}
        onCodecChange={handleCodecChange}
        translations={{}}
      />


      {/* Footer with Disclaimer and Attribution */}
      <footer className="border-t border-white/10 bg-black/30 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-sm text-gray-400 text-center">
            <p>
              <strong className="text-yellow-400">⚠️ Disclaimer:</strong> This application is created for <strong className="text-white">research and educational purposes</strong>. It is <strong className="text-white">experimental</strong> and uses large language models (LLMs) that may <strong className="text-white">confabulate or hallucinate</strong>. Please verify important information independently and use at your own discretion. Created and developed by{' '}
              <a 
                href="https://marlonbarrios.github.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline font-medium"
              >
                Marlon Barrios Solano
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;