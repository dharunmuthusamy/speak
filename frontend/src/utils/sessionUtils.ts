/**
 * Centralized session management utilities
 * Ensures consistent session ID generation and handling across the application
 */

export class SessionUtils {
  /**
   * Generate a consistent session ID
   * Format: session_[timestamp]_[random_suffix]
   */
  static generateSessionId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${randomSuffix}`;
  }

  /**
   * Extract numeric ID from session string for API calls
   * Handles various session ID formats
   */
  static extractNumericId(sessionId: string): number | null {
    // Handle formats like: session_1234567890_abc123, session_1234567890, 1234567890
    const match = sessionId.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Validate session ID format
   */
  static isValidSessionId(sessionId: string): boolean {
    return /^session_\d+(_[a-z0-9]+)?$/.test(sessionId);
  }

  /**
   * Get session display name (last 6 characters of ID)
   */
  static getDisplayName(sessionId: string): string {
    return sessionId.slice(-6);
  }

  /**
   * Format session timestamp for display
   */
  static formatTimestamp(timestamp: number | string): string {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Calculate session duration in seconds
   */
  static calculateDuration(startTime: number, endTime?: number): number {
    const end = endTime || Date.now();
    return Math.floor((end - startTime) / 1000);
  }

  /**
   * Format duration for display
   */
  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

export default SessionUtils;
