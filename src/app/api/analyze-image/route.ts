import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const analysisType = formData.get('analysisType') as string || 'general';
    const customPrompt = formData.get('customPrompt') as string || '';

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type;

    // Create analysis prompt based on type
    const analysisPrompt = createAnalysisPrompt(analysisType, customPrompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("GPT-4 Vision API error:", response.status, errorData);
      return NextResponse.json(
        { error: `GPT-4 Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    return NextResponse.json({
      analysis,
      analysisType,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      imageData: `data:${mimeType};base64,${base64Image}`,
      success: true
    });

  } catch (error) {
    console.error("Image analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}

function createAnalysisPrompt(analysisType: string, customPrompt: string): string {
  if (customPrompt) {
    return customPrompt;
  }

  switch (analysisType) {
    case 'decolonial':
      return `Analiza esta imagen desde una perspectiva decolonial. Considera:
- Representaciones de poder y jerarquías
- Perspectivas del Sur Global vs. hegemonía occidental
- Epistemologías indígenas y saberes ancestrales
- Elementos de resistencia o reproducción colonial
- Posibles reinterpretaciones decoloniales
- Contexto cultural e histórico relevante

Proporciona un análisis crítico y reflexivo que destaque tanto las problemáticas coloniales como los potenciales decoloniales presentes en la imagen.`;

    case 'artistic':
      return `Analiza esta imagen desde una perspectiva artística y estética. Considera:
- Composición, color, forma y técnica
- Estilo artístico y referencias históricas
- Simbolismo y significado visual
- Impacto emocional y estético
- Contexto cultural del arte representado
- Innovación o tradición en la expresión artística

Proporciona un análisis detallado que explore tanto los aspectos técnicos como conceptuales de la obra.`;

    case 'technical':
      return `Analiza esta imagen desde una perspectiva técnica. Describe:
- Calidad y características técnicas de la imagen
- Elementos visuales identificables
- Texto presente (si lo hay)
- Estructuras, objetos o personas
- Colores dominantes y composición
- Posibles defectos o características especiales

Proporciona una descripción precisa y objetiva de todos los elementos visuales presentes.`;

    case 'cultural':
      return `Analiza esta imagen desde una perspectiva cultural y antropológica. Considera:
- Elementos culturales y simbólicos presentes
- Tradiciones, costumbres o prácticas representadas
- Contexto histórico y social
- Significados culturales implícitos
- Diversidad e inclusión representada
- Narrativas culturales que la imagen transmite

Proporciona un análisis que respete y valore la diversidad cultural presente en la imagen.`;

    default:
      return `Analiza esta imagen de manera comprehensiva. Describe:
- ¿Qué ves en la imagen?
- Elementos principales y contexto
- Colores, composición y estilo
- Posibles significados o interpretaciones
- Aspectos técnicos relevantes
- Impresión general y mensaje transmitido

Proporciona un análisis equilibrado que cubra tanto aspectos descriptivos como interpretativos.`;
  }
}
