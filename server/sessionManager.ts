import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "your-refresh-secret-key";

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private cleanupInterval: NodeJS.Timeout;

  // Session configuration
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SESSIONS_PER_USER = 5; // Maximum concurrent sessions per user

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.SESSION_CLEANUP_INTERVAL);
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string, 
    email: string, 
    role: string, 
    deviceInfo?: string, 
    ipAddress?: string
  ): Promise<TokenPair> {
    const sessionId = nanoid();
    const now = Date.now();
    const refreshToken = nanoid(64);

    // Check if user has too many active sessions
    await this.enforceSessionLimit(userId);

    const sessionData: SessionData = {
      sessionId,
      userId,
      email,
      role,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.REFRESH_TOKEN_EXPIRY,
      refreshToken,
      deviceInfo,
      ipAddress,
    };

    // Store session
    this.sessions.set(sessionId, sessionData);
    
    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Generate tokens
    const accessToken = this.generateAccessToken(sessionData);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validate and refresh an access token using refresh token
   */
  async refreshSession(refreshToken: string): Promise<TokenPair | null> {
    // Find session by refresh token
    const session = Array.from(this.sessions.values()).find(
      s => s.refreshToken === refreshToken
    );

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.destroySession(session.sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();

    // Generate new access token
    const accessToken = this.generateAccessToken(session);

    return {
      accessToken,
      refreshToken, // Keep the same refresh token
    };
  }

  /**
   * Validate an access token and return session data
   */
  async validateAccessToken(token: string): Promise<SessionData | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const session = this.sessions.get(decoded.sessionId);

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.destroySession(session.sessionId);
        return null;
      }

      // Update last activity
      session.lastActivity = Date.now();

      return session;
    } catch (error) {
      return null;
    }
  }

  /**
   * Destroy a specific session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Remove from user sessions
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    return true;
  }

  /**
   * Destroy all sessions for a user (logout from all devices)
   */
  async destroyAllUserSessions(userId: string): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return 0;
    }

    const sessionIds = Array.from(userSessionSet);
    let destroyedCount = 0;

    for (const sessionId of sessionIds) {
      if (await this.destroySession(sessionId)) {
        destroyedCount++;
      }
    }

    return destroyedCount;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return [];
    }

    const sessions: SessionData[] = [];
    for (const sessionId of userSessionSet) {
      const session = this.sessions.get(sessionId);
      if (session && Date.now() <= session.expiresAt) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeUsers: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      if (now > session.expiresAt) {
        expiredSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeUsers: this.userSessions.size,
      expiredSessions,
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(session: SessionData): string {
    return jwt.sign(
      {
        sessionId: session.sessionId,
        userId: session.userId,
        email: session.email,
        role: session.role,
      },
      JWT_SECRET,
      { expiresIn: '15m' } // 15 minutes
    );
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet || userSessionSet.size < this.MAX_SESSIONS_PER_USER) {
      return;
    }

    // Get all sessions for this user, sorted by last activity (oldest first)
    const userSessions = Array.from(userSessionSet)
      .map(sessionId => this.sessions.get(sessionId))
      .filter(session => session !== undefined)
      .sort((a, b) => a!.lastActivity - b!.lastActivity);

    // Remove oldest sessions to make room
    const sessionsToRemove = userSessions.length - this.MAX_SESSIONS_PER_USER + 1;
    for (let i = 0; i < sessionsToRemove; i++) {
      await this.destroySession(userSessions[i]!.sessionId);
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        expiredSessionIds.push(sessionId);
      }
    }

    for (const sessionId of expiredSessionIds) {
      this.destroySession(sessionId);
    }

    if (expiredSessionIds.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessionIds.length} expired sessions`);
    }
  }

  /**
   * Shutdown the session manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Graceful shutdown
process.on('SIGINT', () => {
  sessionManager.shutdown();
});

process.on('SIGTERM', () => {
  sessionManager.shutdown();
});