// Image analysis utility for RealtimeTransformer agents

import { tool } from '@openai/agents/realtime';

export interface ImageAnalysisParams {
  imageData: string; // base64 data URL
  analysisType?: 'general' | 'artistic' | 'technical' | 'educational' | 'creative' | 'custom';
  customPrompt?: string;
}

export interface ImageAnalysisResult {
  analysis: string;
  analysisType: string;
  fileName?: string;
  success: boolean;
  error?: string;
}

export const analyzeImageTool = tool({
  name: "analyze_image",
  description: `Analyze uploaded images using GPT-4 Vision. This tool can analyze any image and provide detailed descriptions and insights.
  
This tool is perfect for analyzing:
- Artistic works and visual content
- Technical diagrams and charts
- Photographs and visual media
- Educational materials and illustrations
- Design mockups and concepts
- Any visual content you upload

Use this when users upload an image or when you need to analyze visual content.`,
  
  parameters: {
    type: "object",
    properties: {
      imageData: {
        type: "string",
        description: "Base64 encoded image data URL (data:image/...;base64,...)"
      },
      analysisType: {
        type: "string",
        enum: ["general", "artistic", "technical", "educational", "creative", "custom"],
        description: "Type of analysis to perform. 'artistic' for aesthetic analysis, 'technical' for technical description, 'educational' for educational content analysis, 'creative' for creative interpretation, 'general' for comprehensive analysis."
      },
      customPrompt: {
        type: "string",
        description: "Custom analysis prompt when analysisType is 'custom'"
      }
    },
    required: ["imageData"],
    additionalProperties: false
  },
  
  execute: async (params: any) => {
    try {
      const { imageData, analysisType = 'general', customPrompt } = params as ImageAnalysisParams;
      const formData = new FormData();
      
      // Convert base64 data URL to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], "uploaded-image.png", { type: blob.type });
      
      formData.append('image', file);
      formData.append('analysisType', analysisType);
      if (customPrompt) {
        formData.append('customPrompt', customPrompt);
      }

      const apiResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        return {
          analysis: '',
          analysisType: params.analysisType || 'general',
          success: false,
          error: errorData.error || 'Failed to analyze image'
        };
      }

      const result = await apiResponse.json();
      
      return {
        analysis: result.analysis,
        analysisType: result.analysisType,
        fileName: result.fileName,
        success: true
      };

    } catch (error) {
      console.error('Image analysis tool error:', error);
      return {
        analysis: '',
        analysisType: params.analysisType || 'general',
        success: false,
        error: 'Network error during image analysis'
      };
    }
  }
});

export async function callImageAnalysis(params: ImageAnalysisParams): Promise<ImageAnalysisResult> {
  try {
    const formData = new FormData();
    
    // Convert base64 data URL to blob
    const response = await fetch(params.imageData);
    const blob = await response.blob();
    const file = new File([blob], "uploaded-image", { type: blob.type });
    
    formData.append('image', file);
    formData.append('analysisType', params.analysisType || 'general');
    if (params.customPrompt) {
      formData.append('customPrompt', params.customPrompt);
    }

    const apiResponse = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData,
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      return {
        analysis: '',
        analysisType: params.analysisType || 'general',
        success: false,
        error: errorData.error || 'Failed to analyze image'
      };
    }

    const result = await apiResponse.json();
    
    return {
      analysis: result.analysis,
      analysisType: result.analysisType,
      fileName: result.fileName,
      success: true
    };

  } catch (error) {
    console.error('Image analysis client error:', error);
    return {
      analysis: '',
      analysisType: params.analysisType || 'general',
      success: false,
      error: 'Network error during image analysis'
    };
  }
}
