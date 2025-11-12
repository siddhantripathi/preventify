/**
 * Component for displaying current summary
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface SummaryViewProps {
  summary: string | null;
  isLoading: boolean;
  error: string | null;
}

const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  isLoading,
  error,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Summary</Text>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Generating summary...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {!isLoading && !error && (
        <Text style={styles.summaryText}>
          {summary || 'No summary available yet. Summaries are generated every minute.'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    minHeight: 100,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffe8e8',
    padding: 12,
    borderRadius: 4,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
});

export default SummaryView;

