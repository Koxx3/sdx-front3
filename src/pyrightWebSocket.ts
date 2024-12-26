// pyrightWebSocket.ts
let globalSocket: WebSocket | null = null;
let globalUrl: string | null = null;
let manuallyClosed = false;

const RECONNECT_DELAY_MS = 3000;

/**
 * Returns a single WebSocket instance for Pyright. 
 * - Auto-reconnects if closed unexpectedly.
 * - If you call closePyrightWebSocket, it won't reconnect.
 */
export function getOrCreatePyrightWebSocket(url: string): WebSocket {
  // Reuse the socket if same URL
  if (globalSocket && globalUrl === url) {
    return globalSocket;
  }

  globalUrl = url;
  manuallyClosed = false;

  console.log('[pyrightWebSocket] Creating new WebSocket:', url);

  const socket = new WebSocket(url);
  socket.onopen = () => {
    console.log('[pyrightWebSocket] Connected!');
  };
  socket.onclose = (ev) => {
    console.warn('[pyrightWebSocket] Closed:', ev.code, ev.reason);
    if (!manuallyClosed) {
      // Attempt reconnect
      setTimeout(() => {
        console.log('[pyrightWebSocket] Reconnecting...');
        globalSocket = getOrCreatePyrightWebSocket(url);
      }, RECONNECT_DELAY_MS);
    }
  };
  socket.onerror = (err) => {
    console.error('[pyrightWebSocket] Error:', err);
  };

  globalSocket = socket;
  return socket;
}

export function closePyrightWebSocket() {
  if (globalSocket) {
    manuallyClosed = true;
    globalSocket.close();
    globalSocket = null;
  }
}
