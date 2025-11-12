/**
 * Preventify Mobile App
 * Live transcription with AI-powered summarization
 */

import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import TranscriptView from './src/components/TranscriptView';
import SummaryView from './src/components/SummaryView';
import SummaryDropdown, { SummaryItem } from './src/components/SummaryDropdown';
import { useTranscription } from './src/hooks/useTranscription';
import { useSummaries } from './src/hooks/useSummaries';
import DeepgramService from './src/services/DeepgramService';

function App(): React.JSX.Element {
  const {
    transcript: liveTranscript,
    isRecording,
    error: transcriptionError,
    startTranscription,
    stopTranscription,
    clearTranscript,
  } = useTranscription();

  // Local state for file transcription
  const [fileTranscript, setFileTranscript] = useState<string>('');
  
  // Combine live and file transcripts
  const transcript = liveTranscript || fileTranscript;

  const {
    currentSummary,
    summaryHistory,
    isLoading: isSummaryLoading,
    error: summaryError,
    clearSummaries,
  } = useSummaries(transcript, isRecording);

  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        stopTranscription();
      } else {
        // Use real microphone (set to true for test audio mode)
        // Since you've enabled host microphone via ADB, use false for real mic
        await startTranscription(false); // false = use real microphone
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to toggle recording');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear the transcript and summaries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearTranscript();
            setFileTranscript('');
            clearSummaries();
          },
        },
      ]
    );
  };

  const handleTestMP3 = async () => {
    try {
      // Path relative to project root (backend will resolve it)
      const filePath = 'mobile/trial_voice1.mp3';
      
      // Use the same callback handler as live transcription
      const transcript = await DeepgramService.transcribeFile(filePath, (message) => {
        if (message.isFinal && message.transcript) {
          // Update transcript using the same handler as live transcription
          handleTranscriptMessage(message);
        }
      });
      
      // Also update transcript directly if callback didn't work
      if (transcript) {
        handleTranscriptMessage({ transcript, isFinal: true });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to transcribe MP3 file');
    }
  };

  // Helper to handle transcript messages for file transcription
  const handleTranscriptMessage = useCallback((message: { transcript: string; isFinal: boolean }) => {
    if (message.isFinal && message.transcript) {
      setFileTranscript(message.transcript);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Preventify</Text>
            <Text style={styles.headerSubtitle}>Live Transcription & Summarization</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={handleToggleRecording}
            >
              <Text style={styles.recordButtonText}>
                {isRecording ? '⏹ Stop Recording' : '▶ Start Recording'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestMP3}
            >
              <Text style={styles.testButtonText}>🎵 Test MP3 File</Text>
            </TouchableOpacity>

            {(transcript || summaryHistory.length > 0) && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearAll}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {transcriptionError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                Transcription Error: {transcriptionError}
              </Text>
            </View>
          )}

          <TranscriptView transcript={transcript} />

          <SummaryView
            summary={currentSummary}
            isLoading={isSummaryLoading}
            error={summaryError}
          />

          <SummaryDropdown summaries={summaryHistory} />

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Recording... Summaries will be generated every minute.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#d32f2f',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#ffe8e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 8,
  },
  recordingText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default App;
