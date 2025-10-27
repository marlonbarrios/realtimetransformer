"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";
import { GuardrailChip } from "./GuardrailChip";
import { CompactImageUpload } from "./CompactImageUpload";
import { downloadImageFromUrl, downloadImageFromBase64, downloadImageDirectly, getImageFileName } from "@/app/lib/downloadUtils";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
  onImageAnalyzed?: (result: any) => void;
  translations: any;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
  onImageAnalyzed,
  translations,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }


  // Enhanced auto-scroll for immediate visibility of new content
  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      // Immediate scroll for new messages
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      
      // Additional scroll after a short delay to ensure content is rendered
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  // Enhanced streaming scroll - more frequent and responsive
  useEffect(() => {
    const hasStreamingMessage = transcriptItems.some(item => 
      item.type === "MESSAGE" && item.role === "assistant" && item.status === "IN_PROGRESS"
    );
    
    if (hasStreamingMessage) {
      // Scroll more frequently for streaming messages (every 50ms)
      const interval = setInterval(() => {
        scrollToBottom();
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [transcriptItems]);

  // Additional effect to ensure scroll on any content change
  useEffect(() => {
    // Scroll whenever transcript items change, with a small delay
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 10);
    
    return () => clearTimeout(timeoutId);
  }, [transcriptItems.length, transcriptItems]);

  // Scroll event listener to show/hide scroll-to-bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (transcriptRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    };

    const scrollElement = transcriptRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white min-h-0 rounded-xl h-full">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b bg-white rounded-t-xl">
          <span className="font-semibold">Transcript</span>
          <div className="flex gap-x-2">
            <button
              onClick={handleCopyTranscript}
              className="w-24 text-sm px-3 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium flex items-center justify-center gap-x-1 transition-colors"
            >
              <ClipboardCopyIcon />
              {justCopied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={downloadRecording}
              className="w-40 text-sm px-3 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white font-medium flex items-center justify-center gap-x-1 transition-colors"
            >
              <DownloadIcon />
              <span>Download Audio</span>
            </button>
          </div>
        </div>

        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto p-4 flex flex-col gap-y-4 flex-1 relative"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const containerClasses = `flex justify-end flex-col ${
                isUser ? "items-end" : "items-start"
              }`;
              const bubbleBase = `max-w-4xl p-3 ${
                isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"
              }`;
              const isBracketedMessage =
                title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage
                ? 'italic text-gray-400'
                : '';
              const displayTitle = isBracketedMessage
                ? title.slice(1, -1)
                : title;

              return (
                <div key={itemId} className={containerClasses}>
                  <div className="max-w-4xl">
                    <div
                      className={`${bubbleBase} rounded-t-xl ${
                        guardrailResult ? "" : "rounded-b-xl"
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          isUser ? "text-gray-400" : "text-gray-500"
                        } font-mono`}
                      >
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                        
                        {/* Typing indicator for streaming messages */}
                        {!isUser && item.status === "IN_PROGRESS" && (
                          <span className="inline-block ml-2 text-gray-400">
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce ml-1" style={{ animationDelay: '150ms' }}></span>
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce ml-1" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        )}
                        
                        {/* Debug: Show data object when it exists */}
                        {data && (
                          <div className="text-xs text-red-600 bg-red-50 p-1 rounded mt-1">
                            DEBUG: data exists - {typeof data} - hasImageUrl: {data?.imageUrl ? 'YES' : 'NO'}
                          </div>
                        )}
                        {/* Check if this is a function call output with an image */}
                        {typeof data === 'object' && data?.imageUrl && (
                          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-600 mb-2">🎨 Imagen generada:</div>
                            <div className="rounded-lg overflow-hidden border border-gray-300 bg-white">
                              <img 
                                src={data.imageUrl} 
                                alt={data.originalPrompt || "Generated image"}
                                className="cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                                onClick={() => window.open(data.imageUrl, '_blank')}
                                title="Haz clic para ver tamaño completo"
                                onError={(e) => {
                                  console.error('Error loading image:', e);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            {data.revisedPrompt && (
                              <div className="mt-2 text-xs text-gray-600 italic">
                                &ldquo;{data.revisedPrompt}&rdquo;
                              </div>
                            )}
                            <div className="mt-1 flex items-center gap-3 text-xs">
                              <a 
                                href={data.imageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:underline"
                              >
                                {translations?.viewFullImage || 'Ver imagen completa'} ↗
                              </a>
                              <button
                                onClick={async () => {
                                  try {
                                    await downloadImageFromUrl(
                                      data.imageUrl, 
                                      getImageFileName(data.originalPrompt, 'generated')
                                    );
                                  } catch (error) {
                                    console.log('Primary download failed, trying direct method:', error);
                                    downloadImageDirectly(data.imageUrl);
                                  }
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md font-medium transition-colors"
                                title={translations?.downloadImage || 'Descargar imagen'}
                              >
                                <DownloadIcon className="w-3 h-3" />
                                {translations?.downloadImage || 'Descargar imagen'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Check if this is an uploaded image */}
                        {typeof data === 'object' && data?.imageData && data?.isUploadedImage && (
                          <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                            <div className="text-xs text-blue-600 mb-2">
                              📷 Imagen subida: {data.fileName || 'imagen'} 
                              {data.analysisType && ` (${data.analysisType})`}
                            </div>
                            <div className="rounded-lg overflow-hidden border border-blue-200 bg-white">
                              <img 
                                src={data.imageData} 
                                alt="Uploaded image"
                                className="cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                                onClick={() => window.open(data.imageData, '_blank')}
                                title="Haz clic para ver tamaño completo"
                                onError={(e) => {
                                  console.error('Error loading uploaded image:', data.imageData?.substring(0, 50));
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs">
                              <a 
                                href={data.imageData} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:underline"
                              >
                                {translations?.viewFullImage || 'Ver imagen completa'} ↗
                              </a>
                              <button
                                onClick={() => downloadImageFromBase64(
                                  data.imageData, 
                                  getImageFileName(data.fileName, 'uploaded')
                                )}
                                className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md font-medium transition-colors"
                                title={translations?.downloadImage || 'Descargar imagen'}
                              >
                                <DownloadIcon className="w-3 h-3" />
                                {translations?.downloadImage || 'Descargar imagen'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-gray-500 text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-gray-800 text-left">
                      {/* Check if this is an image generation result */}
                      {typeof data === 'object' && data?.imageUrl ? (
                        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                          <div className="text-xs text-blue-700 mb-2">🖼️ Resultado de función: Imagen generada</div>
                          <div className="rounded-lg overflow-hidden border border-blue-200 bg-white">
                            <img 
                              src={data.imageUrl} 
                              alt={data.originalPrompt || "Generated image"}
                              className="cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                              onClick={() => window.open(data.imageUrl, '_blank')}
                              title="Haz clic para ver tamaño completo"
                              onError={(e) => {
                                console.error('Error loading breadcrumb image:', e);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          {data.revisedPrompt && (
                            <div className="mt-2 text-xs text-gray-600 italic">
                              &ldquo;{data.revisedPrompt}&rdquo;
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <a 
                              href={data.imageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline"
                            >
                              {translations?.viewFullImage || 'Abrir imagen completa'} ↗
                            </a>
                              <button
                                onClick={() => downloadImageFromUrl(
                                  data.imageUrl, 
                                  getImageFileName(data.originalPrompt, 'generated')
                                )}
                                className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md font-medium transition-colors"
                                title={translations?.downloadImage || 'Descargar imagen'}
                              >
                                <DownloadIcon className="w-3 h-3" />
                                {translations?.downloadImage || 'Descargar imagen'}
                              </button>
                          </div>
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Ver datos técnicos</summary>
                            <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : typeof data === 'object' && data?.imageData && data?.isUploadedImage ? (
                        <div className="mt-3 p-2 bg-green-50 rounded-lg">
                          <div className="text-xs text-green-700 mb-2">
                            📷 Imagen subida: {data.fileName || 'imagen'} 
                            {data.analysisType && ` (${data.analysisType})`}
                          </div>
                          <div className="rounded-lg overflow-hidden border border-green-200 bg-white">
                            <img 
                              src={data.imageData} 
                              alt="Uploaded image"
                              className="cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain' }}
                              onClick={() => window.open(data.imageData, '_blank')}
                              title="Haz clic para ver tamaño completo"
                              onError={(e) => {
                                console.error('Error loading uploaded breadcrumb image:', data.imageData?.substring(0, 50));
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <a 
                              href={data.imageData} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline"
                            >
                              {translations?.viewFullImage || 'Abrir imagen completa'} ↗
                            </a>
                            <button
                              onClick={() => downloadImageFromBase64(
                                data.imageData, 
                                getImageFileName(data.fileName, 'uploaded')
                              )}
                              className="flex items-center gap-1 text-green-600 hover:text-green-800 hover:underline transition-colors"
                              title={translations?.downloadImage || 'Descargar imagen'}
                            >
                              <DownloadIcon className="w-3 h-3" />
                              {translations?.downloadImage || 'Descargar imagen'}
                            </button>
                          </div>
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Ver datos técnicos</summary>
                            <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            } else {
              // Fallback if type is neither MESSAGE nor BREADCRUMB
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-gray-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
          
          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-32 right-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 z-20"
              title="Scroll to latest messages"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Text Input Box - Integrated with Chat */}
        <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-gray-200 bg-white">
          <input
            ref={inputRef}
            type="text"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSend) {
                onSendMessage();
              }
            }}
            className="flex-1 px-4 py-2 focus:outline-none text-gray-900 bg-white border border-gray-300 rounded-md"
            placeholder={canSend ? "Type a message..." : "Connect to start chatting..."}
            disabled={!canSend}
          />
          
          {onImageAnalyzed && (
            <CompactImageUpload
              onImageAnalyzed={onImageAnalyzed}
              isConnected={canSend}
              translations={translations}
            />
          )}
          
          <button
            onClick={onSendMessage}
            disabled={!canSend || !userText.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Transcript;
