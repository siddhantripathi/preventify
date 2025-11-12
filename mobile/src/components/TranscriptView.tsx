/**
 * Component for displaying live transcript text
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface TranscriptViewProps {
  transcript: string;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ transcript }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (scrollViewRef.current && transcript) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [transcript]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Transcript</Text>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.transcriptText}>
          {transcript || 'Waiting for audio...'}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 8,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
});

export default TranscriptView;

