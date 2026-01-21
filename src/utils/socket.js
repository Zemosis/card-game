import io from "socket.io-client";

// If we are in production (Netlify), use Render URL.
// If we are developing locally, use localhost:3001.
// const URL = process.env.NODE_ENV === 'production'
//   ? 'https://card-game-paji.onrender.com'
//   : 'http://localhost:3001';

// export const socket = io.connect(URL);
export const socket = io.connect("http://localhost:3001");
