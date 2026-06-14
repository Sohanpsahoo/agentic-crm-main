import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on("connect", () => console.log("WebSocket connected:", socket.id));
socket.on("disconnect", () => console.log("WebSocket disconnected"));

export default socket;
