interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface SessionInfo {
  sessionId: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  isCurrent: boolean;
}

class ClientSessionManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load tokens from localStorage
   */
  private loadFromStorage(): void {
    this.accessToken = localStorage.getItem("accessToken");
    this.refreshToken = localStorage.getItem("refreshToken");
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (error) {
        console.error("Failed to parse user data:", error);
        this.clearSession();
      }
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveToStorage(): void {
    if (this.accessToken) {
      localStorage.setItem("accessToken", this.accessToken);
    } else {
      localStorage.removeItem("accessToken");
    }

    if (this.refreshToken) {
      localStorage.setItem("refreshToken", this.refreshToken);
    } else {
      localStorage.removeItem("refreshToken");
    }

    if (this.user) {
      localStorage.setItem("user", JSON.stringify(this.user));
    } else {
      localStorage.removeItem("user");
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<User> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Login failed");
    }

    const data = await response.json();
    
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = data.user;
    
    this.saveToStorage();
    
    return this.user;
  }

  /**
   * Logout from current session
   */
  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
          },
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    this.clearSession();
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch("/api/auth/logout-all", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
          },
        });
      } catch (error) {
        console.error("Logout all request failed:", error);
      }
    }

    this.clearSession();
  }

  /**
   * Clear session data
   */
  private clearSession(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.saveToStorage();
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken || !this.refreshToken) {
      return null;
    }

    // Check if token is likely expired (we can't decode JWT on client without library)
    // For now, we'll try to use it and refresh on 401
    return this.accessToken;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async performRefresh(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.clearSession();
        return false;
      }

      const data = await response.json();
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.saveToStorage();
      
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearSession();
      return false;
    }
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  async authenticatedRequest(
    method: string,
    url: string,
    data?: unknown
  ): Promise<Response> {
    let token = await this.getAccessToken();
    
    if (!token) {
      throw new Error("No access token available");
    }

    const makeRequest = async (accessToken: string): Promise<Response> => {
      let headers: Record<string, string> = {
        "Authorization": `Bearer ${accessToken}`,
      };
      let body: BodyInit | undefined = undefined;

      if (data instanceof FormData) {
        body = data;
      } else if (data) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(data);
      }

      return fetch(url, {
        method,
        headers,
        body,
        credentials: "include",
      });
    };

    // First attempt
    let response = await makeRequest(token);

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      
      if (refreshed) {
        token = await this.getAccessToken();
        if (token) {
          response = await makeRequest(token);
        }
      }
      
      // If still unauthorized after refresh, redirect to login
      if (response.status === 401) {
        this.clearSession();
        window.location.href = "/login";
        throw new Error("Authentication required");
      }
    }

    if (!response.ok) {
      const text = (await response.text()) || response.statusText;
      throw new Error(`${response.status}: ${text}`);
    }

    return response;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.accessToken && this.refreshToken && this.user);
  }

  /**
   * Get user sessions
   */
  async getUserSessions(): Promise<SessionInfo[]> {
    const response = await this.authenticatedRequest("GET", "/api/protected/user/sessions");
    return response.json();
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.authenticatedRequest("DELETE", `/api/protected/user/sessions/${sessionId}`);
  }
}

// Export singleton instance
export const sessionManager = new ClientSessionManager();

// Export types
export type { User, SessionInfo, TokenPair };