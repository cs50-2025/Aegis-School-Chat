import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      auth: { token: token || localStorage.getItem('aegis_token') || '' },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (token && socketInstance.auth && (socketInstance.auth as any).token !== token) {
    (socketInstance.auth as any).token = token;
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    }
  }
  return socketInstance;
}
