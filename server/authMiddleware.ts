import { Request, Response, NextFunction } from "express";
import { sessionManager, SessionData } from "./sessionManager";

// Extend Express Request type to include session data
declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
      user?: {
        userId: string;
        email: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

/**
 * Enhanced authentication middleware using session manager
 */
export async function authenticateToken(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ 
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Validate token using session manager
    const session = await sessionManager.validateAccessToken(token);
    
    if (!session) {
      res.status(403).json({ 
        message: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    // Attach session and user data to request
    req.session = session;
    req.user = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      sessionId: session.sessionId,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export async function optionalAuth(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const session = await sessionManager.validateAccessToken(token);
      if (session) {
        req.session = session;
        req.user = {
          userId: session.userId,
          email: session.email,
          role: session.role,
          sessionId: session.sessionId,
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue without user
    next();
  }
}

/**
 * Middleware to extract device info and IP address
 */
export function extractClientInfo(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Extract device info from User-Agent
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceInfo = parseUserAgent(userAgent);
  
  // Extract IP address
  const ipAddress = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    'Unknown';

  // Attach to request
  (req as any).deviceInfo = deviceInfo;
  (req as any).ipAddress = ipAddress;

  next();
}

/**
 * Simple user agent parser
 */
function parseUserAgent(userAgent: string): string {
  // Simple parsing - in production, consider using a library like 'ua-parser-js'
  if (userAgent.includes('Chrome')) {
    return 'Chrome Browser';
  } else if (userAgent.includes('Firefox')) {
    return 'Firefox Browser';
  } else if (userAgent.includes('Safari')) {
    return 'Safari Browser';
  } else if (userAgent.includes('Edge')) {
    return 'Edge Browser';
  } else if (userAgent.includes('Mobile')) {
    return 'Mobile Device';
  } else {
    return 'Unknown Device';
  }
}