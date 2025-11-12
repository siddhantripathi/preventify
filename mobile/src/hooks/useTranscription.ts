/**
 * Custom hook for managing transcription state
 */

import { useState, useCallback, useEffect } from 'react';
import DeepgramService, { TranscriptMessage } from '../services/DeepgramService';

export const useTranscription = () => {
  const [transcript, setTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranscriptMessage = useCallback((message: TranscriptMessage) => {
    if (message.isFinal) {
      // Append final transcript
      setTranscript((prev) => {
        const newTranscript = prev ? `${prev} ${message.transcript}` : message.transcript;
        return newTranscript;
      });
    } else {
      // For interim results, we could show them differently
      // For now, we'll just append them
      setTranscript((prev) => {
        // Remove any previous interim result and add new one
        const baseTranscript = prev.split(' [interim]')[0];
        return `${baseTranscript} [interim] ${message.transcript}`;
      });
    }
  }, []);

  const startTranscription = useCallback(async (useTestAudio: boolean = false) => {
    try {
      setError(null);
      await DeepgramService.startTranscription(handleTranscriptMessage, useTestAudio);
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start transcription');
      setIsRecording(false);
    }
  }, [handleTranscriptMessage]);

  const stopTranscription = useCallback(() => {
    try {
      DeepgramService.stopTranscription();
      setIsRecording(false);
    } catch (err: any) {
      setError(err.message || 'Failed to stop transcription');
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        DeepgramService.stopTranscription();
      }
    };
  }, [isRecording]);

  return {
    transcript,
    isRecording,
    error,
    startTranscription,
    stopTranscription,
    clearTranscript,
  };
};

