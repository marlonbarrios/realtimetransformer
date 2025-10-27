"use client";

import React, { useState, useRef } from 'react';

export interface CompactImageUploadProps {
  onImageAnalyzed: (result: any) => void;
  isConnected: boolean;
  translations: any;
  className?: string;
}

export const CompactImageUpload: React.FC<CompactImageUploadProps> = ({ 
  onImageAnalyzed, 
  isConnected, 
  translations,
  className = ""
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState('general');
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysisTypes = {
    general: translations?.analysisGeneral || 'General',
    decolonial: translations?.analysisDecolonial || 'Decolonial',
    artistic: translations?.analysisArtistic || 'Artístico',
    technical: translations?.analysisTechnical || 'Técnico',
    cultural: translations?.analysisCultural || 'Cultural'
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(translations?.errorInvalidImage || 'Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert(translations?.errorImageTooLarge || 'La imagen es demasiado grande. Máximo 10MB');
      return;
    }

    setIsAnalyzing(true);
    setShowOptions(false);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('analysisType', analysisType);

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      onImageAnalyzed(result);

    } catch (error) {
      console.error('Error analyzing image:', error);
      alert(translations?.errorAnalyzing || 'Error al analizar la imagen. Inténtalo de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[CompactImageUpload] File input changed:', e.target.files);
    if (e.target.files && e.target.files[0]) {
      console.log('[CompactImageUpload] File selected:', e.target.files[0].name, e.target.files[0].type);
      handleFileSelect(e.target.files[0]);
    }
  };

  if (!isConnected) {
    console.log('[CompactImageUpload] Component hidden - not connected');
    return null;
  }

  console.log('[CompactImageUpload] Component rendering, showOptions:', showOptions, 'isAnalyzing:', isAnalyzing);

  return (
    <div className={`relative ${className}`}>
      {/* Main upload button */}
      <button
        onClick={() => {
          console.log('[CompactImageUpload] Button clicked, showOptions:', !showOptions);
          setShowOptions(!showOptions);
        }}
        disabled={isAnalyzing}
        className={`
          flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors bg-white
          ${isAnalyzing 
            ? 'border-blue-300 bg-blue-50 cursor-not-allowed' 
            : 'border-gray-400 hover:border-blue-500 hover:bg-blue-50 cursor-pointer shadow-sm'
          }
        `}
        title={translations?.uploadImage || 'Subir imagen'}
      >
        {isAnalyzing ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        ) : (
          <span className="text-lg">📷</span>
        )}
      </button>

      {/* Options dropdown */}
      {showOptions && !isAnalyzing && (
        <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-3 min-w-48 z-50">
          <div className="text-xs font-medium text-gray-700 mb-2">
            {translations?.analysisType || 'Tipo de análisis'}:
          </div>
          
          <select
            value={analysisType}
            onChange={(e) => {
              console.log('[CompactImageUpload] Analysis type changed:', e.target.value);
              setAnalysisType(e.target.value);
            }}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 mb-3"
          >
            {Object.entries(analysisTypes).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => {
              console.log('[CompactImageUpload] Select image button clicked');
              fileInputRef.current?.click();
            }}
            className="w-full text-xs bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            {translations?.selectImage || 'Seleccionar imagen'}
          </button>
          
          <div className="text-xs text-gray-400 mt-2 text-center">
            JPG, PNG, GIF, WebP (máx. 10MB)
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isAnalyzing}
      />
    </div>
  );
};
