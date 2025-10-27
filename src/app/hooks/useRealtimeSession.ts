import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      } 
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  };

  useEffect(() => {
    if (sessionRef.current) {
      // Log server errors with detailed information
      sessionRef.current.on("error", (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('=== RealtimeSession Error ===');
          console.error('Arguments count:', args.length);
          console.error('Arguments:', args);
          
          if (args.length > 0) {
            args.forEach((arg, index) => {
              console.error(`Argument ${index}:`, arg);
              console.error(`Argument ${index} type:`, typeof arg);
              if (arg && typeof arg === 'object') {
                console.error(`Argument ${index} keys:`, Object.keys(arg));
                console.error(`Argument ${index} stringified:`, JSON.stringify(arg, null, 2));
              }
            });
          }
        }
        
        // Try to extract meaningful error information
        let errorMessage = 'Unknown error';
        let errorType = 'unknown';
        
        if (args.length > 0) {
          const firstArg = args[0];
          if (typeof firstArg === 'string') {
            errorMessage = firstArg;
            errorType = 'string_error';
          } else if (typeof firstArg === 'object' && firstArg !== null) {
            errorMessage = firstArg.message || firstArg.error || firstArg.type || JSON.stringify(firstArg);
            errorType = firstArg.type || 'object_error';
          } else if (firstArg instanceof Error) {
            errorMessage = firstArg.message;
            errorType = 'Error_instance';
          }
        }
        
        console.error('Extracted error message:', errorMessage);
        console.error('Extracted error type:', errorType);
        console.error('================================');
        
        logServerEvent({
          type: "realtime_session_error",
          errorType: errorType,
          message: errorMessage,
          details: args,
          timestamp: new Date().toISOString()
        });
      });

      // history events
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);
      sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);

      // additional transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
      
      // Add WebRTC specific error handling with detailed logging
      sessionRef.current.transport.on("error", (error: any) => {
        console.error('=== WebRTC Transport Error ===');
        console.error('Error object:', error);
        console.error('Error type:', typeof error);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Error toString:', error?.toString());
        
        if (error && typeof error === 'object') {
          console.error('Error keys:', Object.keys(error));
          console.error('Error stringified:', JSON.stringify(error, null, 2));
        }
        
        console.error('================================');
        
        logServerEvent({
          type: "webrtc_transport_error",
          message: error?.message || error?.toString() || 'Unknown WebRTC error',
          errorType: typeof error,
          details: error,
          timestamp: new Date().toISOString()
        });
      });
    }
  }, [sessionRef.current]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

      try {
        const ek = await getEphemeralKey();
        console.log('Ephemeral key received:', ek ? 'Present' : 'Missing');
        
        const rootAgent = initialAgents[0];
        console.log('Root agent:', rootAgent);

        // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
        //  simulate how the voice agent sounds over a PSTN/SIP phone call.
        const codecParam = codecParamRef.current;
        const audioFormat = audioFormatForCodec(codecParam);
        console.log('Audio format:', audioFormat);

        sessionRef.current = new RealtimeSession(rootAgent, {
          transport: new OpenAIRealtimeWebRTC({
            audioElement,
            // Set preferred codec before offer creation
            changePeerConnection: async (pc: RTCPeerConnection) => {
              console.log('Setting up peer connection with codec:', codecParam);
              try {
                applyCodec(pc);
                return pc;
              } catch (codecError) {
                console.error('Codec application error:', codecError);
                throw codecError;
              }
            },
          }),
          model: 'gpt-4o-realtime-preview-2025-06-03',
          config: {
            inputAudioFormat: audioFormat,
            outputAudioFormat: audioFormat,
            inputAudioTranscription: {
              model: 'gpt-4o-mini-transcribe',
            },
          },
          outputGuardrails: outputGuardrails ?? [],
          context: extraContext ?? {},
        });
        
        console.log('RealtimeSession created successfully');
        
        // Add error handling for the connection process
        try {
          console.log('Attempting to connect with ephemeral key...');
          await sessionRef.current.connect({ apiKey: ek });
          console.log('Connected to RealtimeSession');
          updateStatus('CONNECTED');
        } catch (connectionError: any) {
          console.error('=== Connection Process Error ===');
          console.error('Connection error:', connectionError);
          console.error('Connection error message:', connectionError?.message || 'No message');
          console.error('Connection error type:', typeof connectionError);
          console.error('Connection error stack:', connectionError?.stack || 'No stack');
          
          if (connectionError && typeof connectionError === 'object') {
            console.error('Connection error keys:', Object.keys(connectionError));
            console.error('Connection error stringified:', JSON.stringify(connectionError, null, 2));
          }
          
          console.error('Ephemeral key used:', ek ? 'Present' : 'Missing');
          console.error('Ephemeral key length:', ek?.length || 0);
          console.error('Ephemeral key preview:', ek?.substring(0, 20) + '...');
          console.error('================================');
          
          logServerEvent({
            type: "connection_process_error",
            message: connectionError?.message || 'Connection failed',
            details: connectionError,
            timestamp: new Date().toISOString()
          });
          
          throw connectionError;
        }
        
      } catch (error) {
        console.error('[useRealtimeSession] Connection failed:', error);
        updateStatus('DISCONNECTED');
        throw error;
      }
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
