export interface WebGL2Support {
  supported: boolean;
  reason?: string;
}

export function getWebGL2Support(documentRef: Document = document): WebGL2Support {
  try {
    const canvas = documentRef.createElement('canvas');
    const context = canvas.getContext('webgl2');
    return context === null
      ? { supported: false, reason: 'webgl2-unavailable' }
      : { supported: true };
  } catch {
    return { supported: false, reason: 'webgl2-check-failed' };
  }
}
