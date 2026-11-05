import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { config } from "./config/env";

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

server.listen(config.port, () => {
  console.log(`🚀 Express server running on port ${config.port} (${config.nodeEnv})`);
});

export { server, io };
