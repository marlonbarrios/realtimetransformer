import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for OpenAI Chat Completions API with structured outputs
export async function POST(req: NextRequest) {
  const body = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Convert the request to chat completions format
    const messages = body.input || body.messages || [];
    
    const response = await openai.chat.completions.create({
      model: body.model || 'gpt-4o-mini',
      messages: messages,
      stream: false,
    });

    // Extract the content and parse if structured
    const content = response.choices[0]?.message?.content;
    
    if (body.text?.format?.type === 'json_schema' && content) {
      try {
        const parsed = JSON.parse(content);
        return NextResponse.json({
          output_parsed: parsed,
          raw_response: response
        });
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return NextResponse.json({ 
          error: 'Failed to parse structured output',
          content: content 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      content: content,
      raw_response: response
    });
    
  } catch (err: any) {
    console.error('OpenAI API error:', err);
    return NextResponse.json({ 
      error: 'OpenAI API request failed', 
      details: err.message 
    }, { status: 500 });
  }
}