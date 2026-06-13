import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on("connect", () => console.log("WebSocket connected:", socket.id));
socket.on("disconnect", () => console.log("WebSocket disconnected"));

export default socket;
