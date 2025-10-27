import { NextRequest, NextResponse } from 'next/server';

// Function to clean DuckDuckGo redirect URLs
function cleanDuckDuckGoUrl(url: string): string {
  if (!url) return '';
  
  // Handle DuckDuckGo redirect URLs
  if (url.includes('duckduckgo.com/l/?uddg=')) {
    try {
      const match = url.match(/uddg=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    } catch (e) {
      console.log('[cleanDuckDuckGoUrl] Error decoding URL:', e);
    }
  }
  
  // If it starts with //, add https:
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const { query, explanation } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    console.log('[web-search] Searching for:', query);
    console.log('[web-search] Explanation:', explanation);

    // Using DuckDuckGo Instant Answer API (free, no API key required)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1&no_html=1`;
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'RealtimeTransformer/1.0 (Educational/Research)',
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract useful information from DuckDuckGo response
      const searchResults = {
        query: query,
        instant_answer: data.Answer || data.AbstractText || null,
        definition: data.Definition || null,
        related_topics: data.RelatedTopics?.slice(0, 3)?.map((topic: any) => ({
          text: topic.Text,
          url: cleanDuckDuckGoUrl(topic.FirstURL)
        })) || [],
        infobox: data.Infobox ? {
          content: data.Infobox.content?.slice(0, 3)?.map((item: any) => ({
            label: item.label,
            value: item.value
          })) || []
        } : null,
        external_links: data.Results?.slice(0, 3)?.map((result: any) => ({
          title: result.Text,
          url: cleanDuckDuckGoUrl(result.FirstURL)
        })) || []
      };

      // If no good results from DuckDuckGo, try a simple web scraping approach
      if (!searchResults.instant_answer && !searchResults.definition && searchResults.related_topics.length === 0) {
        console.log('[web-search] No good results from DuckDuckGo, trying alternative search');
        
        // Fallback: Use a search engine results page scraper (simplified)
        try {
          const fallbackUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RealtimeTransformer/1.0)',
            },
          });
          
          if (fallbackResponse.ok) {
            const htmlText = await fallbackResponse.text();
            
            // Very basic extraction - just get first few search results
            const resultMatches = htmlText.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g);
            
            if (resultMatches && resultMatches.length > 0) {
              searchResults.external_links = resultMatches.slice(0, 3).map(match => {
                const urlMatch = match.match(/href="([^"]*)"/);
                const titleMatch = match.match(/>([^<]*)</);
                return {
                  title: titleMatch ? titleMatch[1].trim() : 'Search Result',
                  url: urlMatch ? cleanDuckDuckGoUrl(urlMatch[1]) : '#'
                };
              });
            }
          }
        } catch (fallbackError) {
          console.log('[web-search] Fallback search also failed:', fallbackError);
        }
      }

      console.log('[web-search] Search results:', searchResults);

      return NextResponse.json({
        success: true,
        results: searchResults,
        timestamp: new Date().toISOString()
      });

    } catch (searchError) {
      console.error('[web-search] Search API error:', searchError);
      
      // Return a structured response even if search fails
      return NextResponse.json({
        success: false,
        error: "Search temporarily unavailable",
        results: {
          query: query,
          message: "La búsqueda web no está disponible temporalmente. Por favor, reformula tu pregunta o consulta fuentes específicas.",
          suggestions: [
            "Intenta hacer la pregunta de manera más específica",
            "Proporciona más contexto sobre lo que buscas",
            "Pregunta sobre temas relacionados con el proyecto RealtimeTransformer"
          ]
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[web-search] Server error:', error);
    return NextResponse.json(
      { error: "Internal server error during web search" },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
