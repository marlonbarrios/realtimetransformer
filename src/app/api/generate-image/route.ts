import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, style = "decolonial", size = "1024x1024" } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Enhance prompt with decolonial context when appropriate
    const enhancedPrompt = enhancePromptForDecolonialArt(prompt, style);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        size: size,
        quality: "standard",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("DALL-E API error:", response.status, errorData);
      return NextResponse.json(
        { error: `DALL-E API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      imageUrl: data.data[0].url,
      revisedPrompt: data.data[0].revised_prompt,
      originalPrompt: prompt,
      enhancedPrompt: enhancedPrompt
    });

  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

function enhancePromptForDecolonialArt(prompt: string, style: string): string {
  const basePrompt = prompt.toLowerCase();
  
  // Keywords that suggest decolonial enhancement
  const decolonialKeywords = [
    'indigenous', 'ancestral', 'traditional', 'decolonial', 'global south',
    'epistemology', 'cosmovision', 'pangea', 'resistance', 'liberation'
  ];
  
  const hasDecolonialContext = decolonialKeywords.some(keyword => 
    basePrompt.includes(keyword)
  );

  if (style === "decolonial" || hasDecolonialContext) {
    return `${prompt}. Style: Decolonial art aesthetic incorporating indigenous patterns, Global South perspectives, earth tones, organic forms, and non-Western artistic traditions. Avoid Western colonial imagery and Eurocentric perspectives.`;
  } 
  
  if (style === "speculative_cartography") {
    return `${prompt}. Style: Speculative cartography with fluid borders, non-hierarchical spatial relationships, migratory paths, and alternative geographical imaginaries that challenge center-periphery models.`;
  }
  
  if (style === "artificial_ecology") {
    return `${prompt}. Style: Artificial ecology visualization with multispecies relationships, metabolic networks, chimeric forms, and bio-technological symbiosis representing alternative models of intelligence.`;
  }
  
  if (style === "cultural_memory") {
    return `${prompt}. Style: Cultural memory archive aesthetic with layered textures, embodied knowledge representations, dance movement traces, and community storytelling elements.`;
  }
  
  // Default enhancement for general artistic requests
  return `${prompt}. High quality artistic rendering with attention to cultural sensitivity and diverse aesthetic traditions.`;
}
