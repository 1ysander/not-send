import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export function setIO(server: SocketIOServer): void {
  io = server;
}

export function getIO(): SocketIOServer | null {
  return io;
}
