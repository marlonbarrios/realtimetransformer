// Image generation utility for RealtimeTransformer agents

export interface ImageGenerationParams {
  prompt: string;
  style?: 'artistic' | 'realistic' | 'cartoon' | 'abstract' | 'technical' | 'general';
  size?: '1024x1024' | '1024x1792' | '1792x1024';
}

export interface ImageGenerationResult {
  imageUrl: string;
  revisedPrompt: string;
  originalPrompt: string;
  enhancedPrompt: string;
  success: boolean;
  error?: string;
}

import { tool } from '@openai/agents/realtime';

export const generateImageTool = tool({
  name: "generate_image",
  description: `Generate images using DALL-E 3. This tool can create any type of image based on your description.
  
This tool is perfect for creating:
- Artistic visualizations and illustrations
- Concept art and design mockups
- Educational diagrams and charts
- Creative and imaginative scenes
- Technical diagrams and schematics
- Any visual content you can describe

Use this when the user explicitly requests an image, visualization, or artistic representation.`,
  
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Detailed description of the image to generate. Be specific about visual elements, style, and mood."
      },
      style: {
        type: "string",
        enum: ["artistic", "realistic", "cartoon", "abstract", "technical", "general"],
        description: "Artistic style to apply. Choose based on the context: 'artistic' for creative/artistic images, 'realistic' for photorealistic images, 'cartoon' for cartoon/animated style, 'abstract' for abstract art, 'technical' for diagrams/charts, 'general' for other requests."
      },
      size: {
        type: "string",
        enum: ["1024x1024", "1024x1792", "1792x1024"],
        description: "Image dimensions. Square (1024x1024) for general use, portrait (1024x1792) for vertical compositions, landscape (1792x1024) for horizontal compositions."
      }
    },
    required: ["prompt"],
    additionalProperties: false
  },
  
  execute: async (params: any) => {
    const { prompt, style = 'general', size = '1024x1024' } = params as ImageGenerationParams;
    const result = await callImageGeneration({
      prompt,
      style,
      size
    });
    
    if (result.success) {
      return {
        success: true,
        imageUrl: result.imageUrl,
        revisedPrompt: result.revisedPrompt,
        originalPrompt: result.originalPrompt,
        enhancedPrompt: result.enhancedPrompt,
        message: `Image generated successfully! I created: "${result.revisedPrompt}"`
      };
    } else {
      return {
        success: false,
        error: result.error,
        message: `I apologize, but I encountered an error generating the image: ${result.error}`
      };
    }
  }
});

export async function callImageGeneration(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        style: params.style || 'general',
        size: params.size || '1024x1024'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        imageUrl: '',
        revisedPrompt: '',
        originalPrompt: params.prompt,
        enhancedPrompt: '',
        success: false,
        error: errorData.error || 'Failed to generate image'
      };
    }

    const data = await response.json();
    
    return {
      imageUrl: data.imageUrl,
      revisedPrompt: data.revisedPrompt,
      originalPrompt: data.originalPrompt,
      enhancedPrompt: data.enhancedPrompt,
      success: true
    };

  } catch (error) {
    console.error('Image generation client error:', error);
    return {
      imageUrl: '',
      revisedPrompt: '',
      originalPrompt: params.prompt,
      enhancedPrompt: '',
      success: false,
      error: 'Network error during image generation'
    };
  }
}
