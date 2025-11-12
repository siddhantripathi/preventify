/**
 * Service for calling backend summarization API
 */

import axios from 'axios';
import { API_BASE_URL } from '@env';

export interface SummaryResponse {
  summary: string;
  timestamp: string;
}

class SummaryService {
  private baseURL: string;

  constructor() {
    // Use localhost for Android emulator, 10.0.2.2 for Android device via USB
    // For physical device, replace with your computer's IP address
    this.baseURL = API_BASE_URL || 'http://10.0.2.2:3001';
  }

  /**
   * Generate summary from transcript text
   */
  async generateSummary(text: string, maxSentences: number = 3): Promise<SummaryResponse> {
    try {
      const response = await axios.post<SummaryResponse>(
        `${this.baseURL}/summarize`,
        {
          text,
          maxSentences,
        },
        {
          timeout: 35000, // 35 second timeout (model can take up to 30s)
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Summary generation failed:', error);
      
      if (error.response) {
        throw new Error(`API Error: ${error.response.data?.error || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network error: Could not reach the server. Make sure the backend API is running.');
      } else {
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Health check for the API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export default new SummaryService();

