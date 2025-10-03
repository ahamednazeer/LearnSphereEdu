import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
import { serveStatic } from "./production";
import { log } from "./utils";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5173", "http://localhost:5000"],
      methods: ["GET", "POST"]
    }
  });

  // Video calling signaling
  const videoSessions = new Map<string, Set<string>>(); // sessionId -> Set of userIds
  // Track userId <-> socket.id to correctly route signals
  const userIdToSocketId = new Map<string, string>();
  const socketIdToUserId = new Map<string, string>();
  // Store user profiles so we can provide names/roles to new joiners
  const userProfiles = new Map<string, { userName: string; isHost: boolean }>();

  io.on('connection', (socket) => {
    log(`Socket connected: ${socket.id}`);

    // Join video session
    socket.on('join-video-session', ({ sessionId, userId, userName, isHost }) => {
      // Join the session room
      socket.join(sessionId);

      // Also join a personal room keyed by userId so we can route signals by userId
      socket.join(userId);
      userIdToSocketId.set(userId, socket.id);
      socketIdToUserId.set(socket.id, userId);

      // Save profile for name lookups
      userProfiles.set(userId, { userName, isHost: !!isHost });
      
      if (!videoSessions.has(sessionId)) {
        videoSessions.set(sessionId, new Set());
      }
      videoSessions.get(sessionId)!.add(userId);

      // Send current participants list to the new joiner
      const participants = Array.from(videoSessions.get(sessionId) || []).filter(id => id !== userId)
        .map(id => ({ userId: id, userName: userProfiles.get(id)?.userName || 'Unknown', isHost: !!userProfiles.get(id)?.isHost }));
      socket.emit('participants', participants);

      // Notify other participants in the session
      socket.to(sessionId).emit('user-joined', { userId, userName, isHost });
      
      log(`User ${userName} (${userId}) joined video session ${sessionId}`);
    });

    // Leave video session
    socket.on('leave-video-session', ({ sessionId, userId }) => {
      socket.leave(sessionId);
      
      if (videoSessions.has(sessionId)) {
        videoSessions.get(sessionId)!.delete(userId);
        if (videoSessions.get(sessionId)!.size === 0) {
          videoSessions.delete(sessionId);
        }
      }

      // Remove profile
      userProfiles.delete(userId);

      // Notify other participants
      socket.to(sessionId).emit('user-left', { userId });
      
      log(`User ${userId} left video session ${sessionId}`);
    });

    // WebRTC signaling
    // Route by userId using personal rooms to ensure correct delivery regardless of socket.id
    socket.on('signal', ({ to, from, signal }) => {
      // Emit directly to the room named by the recipient's userId
      io.to(to).emit('signal', { from, signal });
    });

    // Participant updates (mute/unmute, video on/off)
    socket.on('participant-update', ({ sessionId, userId, isMuted, isVideoOff }) => {
      socket.to(sessionId).emit('participant-update', { userId, isMuted, isVideoOff });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      log(`Socket disconnected: ${socket.id}`);

      const userId = socketIdToUserId.get(socket.id);
      if (userId) {
        // Remove personal mapping
        socketIdToUserId.delete(socket.id);
        userIdToSocketId.delete(userId);

        // Remove from any sessions and notify others
        for (const [sessionId, participants] of videoSessions.entries()) {
          if (participants.has(userId)) {
            participants.delete(userId);
            socket.to(sessionId).emit('user-left', { userId });
            if (participants.size === 0) videoSessions.delete(sessionId);
          }
        }

        // Remove profile
        userProfiles.delete(userId);
      }
    });
  });

  const server = await registerRoutes(app, httpServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // In Docker, bind to 0.0.0.0 to accept external connections
  // In development, bind to localhost for security
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
  
  httpServer.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
