import { UserRole } from "@shared/schema";

declare global {
  namespace Express {
    interface UserJwtPayload {
      userId: string;
      role: UserRole | string;
      [key: string]: any;
    }
    interface Request {
      user: UserJwtPayload;
    }
  }
}

export {};
