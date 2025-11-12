/**
 * Custom hook for managing summaries
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import SummaryService from '../services/SummaryService';
import { SummaryItem } from '../components/SummaryDropdown';

const SUMMARY_INTERVAL_MS = 60000; // 60 seconds

export const useSummaries = (transcript: string, isRecording: boolean) => {
  const [currentSummary, setCurrentSummary] = useState<string | null>(null);
  const [summaryHistory, setSummaryHistory] = useState<SummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>('');

  const generateSummary = useCallback(async (text: string) => {
    if (!text || !text.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await SummaryService.generateSummary(text);
      
      const newSummaryItem: SummaryItem = {
        id: Date.now().toString(),
        summary: response.summary,
        timestamp: response.timestamp,
      };

      setCurrentSummary(response.summary);
      // Prepend to history for descending order (newest first)
      setSummaryHistory((prev) => [newSummaryItem, ...prev]);
      lastTranscriptRef.current = ''; // Clear after successful summary
    } catch (err: any) {
      setError(err.message || 'Failed to generate summary');
      console.error('Summary generation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up interval to generate summaries every minute
  useEffect(() => {
    if (!isRecording) {
      // Clear interval when not recording
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Generate summary immediately if there's transcript
    if (transcript && transcript !== lastTranscriptRef.current) {
      const transcriptToSummarize = transcript.replace(/ \[interim\].*$/, '');
      if (transcriptToSummarize.trim()) {
        generateSummary(transcriptToSummarize);
        lastTranscriptRef.current = transcript;
      }
    }

    // Set up interval for periodic summaries
    intervalRef.current = setInterval(() => {
      const transcriptToSummarize = transcript.replace(/ \[interim\].*$/, '');
      if (transcriptToSummarize.trim() && transcriptToSummarize !== lastTranscriptRef.current) {
        generateSummary(transcriptToSummarize);
        lastTranscriptRef.current = transcriptToSummarize;
      }
    }, SUMMARY_INTERVAL_MS);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording, transcript, generateSummary]);

  const clearSummaries = useCallback(() => {
    setCurrentSummary(null);
    setSummaryHistory([]);
    lastTranscriptRef.current = '';
  }, []);

  return {
    currentSummary,
    summaryHistory,
    isLoading,
    error,
    generateSummary,
    clearSummaries,
  };
};

