import { io, Socket } from 'socket.io-client';

// Dynamically determine the WebSocket URL based on the current host
const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // If accessing from localhost, use localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:3001';
  }
  
  // Otherwise, use the same hostname but on port 3001
  return `ws://${window.location.hostname}:3001`;
};

export const createSocket = (token: string): Socket => {
  const WS_URL = getWebSocketUrl();
  
  return io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
};