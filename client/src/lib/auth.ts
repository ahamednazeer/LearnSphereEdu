import { apiRequest } from "./queryClient";
import { sessionManager } from "./sessionManager";

// Enhanced API request function that includes auth token with automatic refresh
export async function authenticatedApiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  return sessionManager.authenticatedRequest(method, url, data);
}

// Legacy support - migrate existing localStorage token to new system
function migrateLegacyToken() {
  const legacyToken = localStorage.getItem("authToken");
  if (legacyToken && !localStorage.getItem("accessToken")) {
    // For now, just remove the legacy token
    // In a real migration, you might want to validate it first
    localStorage.removeItem("authToken");
    console.log("Legacy token removed. Please log in again.");
  }
}

// Run migration on module load
migrateLegacyToken();
