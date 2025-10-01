/**
 * Visitor Tracking Service
 * Handles tracking of unique site visitors
 */

import { backendApi } from './backend-api';

class VisitorTrackingService {
  private visitorId: string | null = null;
  private isTracking = false;

  /**
   * Generate a unique visitor ID
   */
  private generateVisitorId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `visitor_${timestamp}_${random}`;
  }

  /**
   * Get or create visitor ID from localStorage
   */
  private getVisitorId(): string {
    if (this.visitorId) {
      return this.visitorId;
    }

    try {
      const stored = localStorage.getItem('zet_visitor_id');
      if (stored) {
        this.visitorId = stored;
        return stored;
      }
    } catch (error) {
      console.warn('Failed to read visitor ID from localStorage:', error);
    }

    // Generate new visitor ID
    this.visitorId = this.generateVisitorId();
    
    try {
      localStorage.setItem('zet_visitor_id', this.visitorId);
    } catch (error) {
      console.warn('Failed to store visitor ID in localStorage:', error);
    }

    return this.visitorId;
  }

  /**
   * Get client IP address (simplified - in production, this would be handled by the server)
   */
  private getClientIP(): string {
    // TODO: In a real application, the IP address would be determined by the server
    // For client-side tracking, we'll use a placeholder or try to get it from a service
    // For now, we'll use a placeholder that indicates client-side tracking
    return 'client-side-tracking';
  }

  /**
   * Get visitor information
   */
  private getVisitorInfo() {
    const visitorId = this.getVisitorId();
    const userAgent = navigator.userAgent;
    const referrer = document.referrer || undefined;
    const ipAddress = this.getClientIP();

    return {
      visitorId,
      ipAddress,
      userAgent,
      referrer,
    };
  }

  /**
   * Track a new visitor
   */
  async trackVisitor(): Promise<void> {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;

    try {
      const visitorInfo = this.getVisitorInfo();
      
      await backendApi.trackVisitor(visitorInfo);
      console.log('Visitor tracked successfully');
    } catch (error) {
      console.warn('Failed to track visitor:', error);
    } finally {
      this.isTracking = false;
    }
  }

  /**
   * Increment visit count for existing visitor
   */
  async incrementVisit(): Promise<void> {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;

    try {
      const visitorId = this.getVisitorId();
      await backendApi.incrementVisitorVisit(visitorId);
      console.log('Visit count incremented successfully');
    } catch (error) {
      console.warn('Failed to increment visit count:', error);
    } finally {
      this.isTracking = false;
    }
  }

  /**
   * Initialize visitor tracking
   * Call this when the app loads
   */
  async initialize(): Promise<void> {
    try {
      // Check if this is a returning visitor
      const visitorId = this.getVisitorId();
      const isReturningVisitor = localStorage.getItem('zet_visitor_returning') === 'true';

      if (isReturningVisitor) {
        // Increment visit count for returning visitor
        await this.incrementVisit();
      } else {
        // Track new visitor
        await this.trackVisitor();
        localStorage.setItem('zet_visitor_returning', 'true');
      }
    } catch (error) {
      console.warn('Failed to initialize visitor tracking:', error);
    }
  }

  /**
   * Get current visitor ID
   */
  getCurrentVisitorId(): string | null {
    return this.visitorId;
  }
}

export const visitorTracking = new VisitorTrackingService();
