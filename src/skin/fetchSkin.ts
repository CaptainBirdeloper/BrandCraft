const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

const TIMEOUT_MS = 6000;

function fetchWithTimeout(url: string, timeoutMs: number, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(id);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }
    externalSignal.addEventListener('abort', onAbort, { once: true });
  }

  return fetch(url, { signal: controller.signal })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw err;
        }
        throw new Error('Skin fetch timed out');
      }
      throw err;
    })
    .finally(() => {
      window.clearTimeout(id);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onAbort);
      }
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  if (!blob.type.startsWith('image/')) {
    return Promise.reject(new Error('Invalid image format returned'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode skin image'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read skin blob'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchSkinByUsername(
  raw: string,
  signal?: AbortSignal,
): Promise<{ dataUrl: string; name: string }> {
  const name = raw.trim();
  if (!name) {
    throw new Error('Please enter a username');
  }

  if (!USERNAME_REGEX.test(name)) {
    throw new Error('Invalid username (3-16 letters, numbers, or _)');
  }

  // Tier 1: Crafthead (Cloudflare Edge worker, ultra-fast)
  try {
    const res = await fetchWithTimeout(
      `https://crafthead.net/skin/${encodeURIComponent(name)}`,
      TIMEOUT_MS,
      signal,
    );
    if (res.status === 200) {
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('image')) {
        throw new Error('Invalid response from skin provider');
      }
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, name };
    }
    if (res.status === 404) {
      throw new Error(`Player "${name}" not found`);
    }
  } catch (err: unknown) {
    // If caller aborted or explicit 404, do not fallback
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('not found'))) {
      throw err;
    }
    // Network / timeout error: proceed to Minotar fallback
  }

  // Tier 2: Minotar fallback
  try {
    const res = await fetchWithTimeout(
      `https://minotar.net/skin/${encodeURIComponent(name)}`,
      TIMEOUT_MS,
      signal,
    );
    if (res.status === 200) {
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('image')) {
        throw new Error('Invalid response from skin provider');
      }
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, name };
    }
    if (res.status === 404) {
      throw new Error(`Player "${name}" not found`);
    }
    throw new Error(`Skin server error (${res.status})`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Could not fetch skin: network error');
  }
}
