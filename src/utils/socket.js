import io from 'socket.io-client';

// Connect to backend URL
export const socket = io.connect("http://localhost:3001");
