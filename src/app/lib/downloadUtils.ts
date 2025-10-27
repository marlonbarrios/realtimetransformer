// Download utilities for RealtimeTransformer

export async function downloadImageFromUrl(imageUrl: string, fileName?: string): Promise<void> {
  try {
    console.log('[downloadImageFromUrl] Starting download for:', imageUrl);
    
    // Try to use a proxy approach for CORS-restricted URLs
    let response: Response;
    
    try {
      // First, try direct fetch
      response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit'
      });
    } catch (corsError) {
      console.log('[downloadImageFromUrl] CORS error, trying alternative method:', corsError);
      
      // If CORS fails, create a proxy through our own API
      response = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl })
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the blob
    const blob = await response.blob();
    console.log('[downloadImageFromUrl] Blob created, size:', blob.size);
    
    // Create a temporary URL for the blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const link = document.createElement('a');
    link.href = blobUrl;
    
    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `realtime-transformer-image-${timestamp}.png`;
    link.download = fileName || defaultFileName;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(blobUrl);
    
    console.log('[downloadImageFromUrl] Image downloaded successfully:', link.download);
  } catch (error) {
    console.error('[downloadImageFromUrl] Error downloading image:', error);
    
    // Fallback: try to open in new window for manual save
    try {
      window.open(imageUrl, '_blank');
      alert('No se pudo descargar automáticamente. La imagen se abrió en una nueva pestaña para que puedas guardarla manualmente.');
    } catch (fallbackError) {
      console.error('[downloadImageFromUrl] Fallback failed:', fallbackError);
      alert('Error al descargar la imagen. Por favor, haz clic derecho en la imagen y selecciona "Guardar imagen como..."');
    }
  }
}

export async function downloadImageFromBase64(base64Data: string, fileName?: string): Promise<void> {
  try {
    console.log('[downloadImageFromBase64] Starting download for base64 data');
    
    // Convert base64 to blob
    const response = await fetch(base64Data);
    if (!response.ok) {
      throw new Error(`Failed to fetch base64 data: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('[downloadImageFromBase64] Blob created, size:', blob.size);
    
    // Create a temporary URL for the blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Create a temporary download link
    const link = document.createElement('a');
    link.href = blobUrl;
    
    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `realtime-transformer-uploaded-${timestamp}.png`;
    link.download = fileName || defaultFileName;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(blobUrl);
    
    console.log('[downloadImageFromBase64] Image downloaded successfully:', link.download);
  } catch (error) {
    console.error('[downloadImageFromBase64] Error downloading base64 image:', error);
    
    // Fallback: try to open base64 in new window
    try {
      window.open(base64Data, '_blank');
      alert('No se pudo descargar automáticamente. La imagen se abrió en una nueva pestaña para que puedas guardarla manualmente.');
    } catch (fallbackError) {
      console.error('[downloadImageFromBase64] Fallback failed:', fallbackError);
      alert('Error al descargar la imagen. Por favor, haz clic derecho en la imagen y selecciona "Guardar imagen como..."');
    }
  }
}

// Simple download that just opens the image in a new tab for manual save
export function downloadImageDirectly(imageUrl: string): void {
  try {
    console.log('[downloadImageDirectly] Opening image in new tab:', imageUrl);
    
    // For external URLs, best approach is to open in new tab
    const newWindow = window.open(imageUrl, '_blank');
    
    if (newWindow) {
      // Focus the new window
      newWindow.focus();
      alert('La imagen se abrió en una nueva pestaña. Haz clic derecho y selecciona "Guardar imagen como..." para descargarla.');
    } else {
      throw new Error('Popup blocked');
    }
    
    console.log('[downloadImageDirectly] Image opened in new tab');
  } catch (error) {
    console.error('[downloadImageDirectly] Error:', error);
    // Copy URL to clipboard as fallback
    try {
      navigator.clipboard.writeText(imageUrl);
      alert('No se pudo abrir la imagen. La URL se copió al portapapeles. Pégala en una nueva pestaña para ver la imagen.');
    } catch (clipboardError) {
      console.error('Clipboard copy failed:', clipboardError);
      alert(`No se pudo descargar la imagen automáticamente. Copia esta URL manualmente: ${imageUrl}`);
    }
  }
}

export function getImageFileName(originalPrompt?: string, imageType: 'generated' | 'uploaded' = 'generated'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseType = imageType === 'generated' ? 'generated' : 'uploaded';
  
  if (originalPrompt) {
    // Clean the prompt for filename (remove special characters, limit length)
    const cleanPrompt = originalPrompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return `realtime-transformer-${baseType}-${cleanPrompt}-${timestamp}.png`;
  }
  
  return `realtime-transformer-${baseType}-${timestamp}.png`;
}
