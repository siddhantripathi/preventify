/**
 * Deepgram service for live transcription
 * Connects directly to Deepgram WebSocket API
 */

import { Platform } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';
import axios from 'axios';
import { DEEPGRAM_API_KEY, API_BASE_URL } from '@env';

export interface TranscriptMessage {
  transcript: string;
  isFinal: boolean;
}

export type TranscriptCallback = (message: TranscriptMessage) => void;

class DeepgramService {
  private ws: WebSocket | null = null;
  private isRecording: boolean = false;
  private transcriptCallback: TranscriptCallback | null = null;
  private audioChunkCount: number = 0;
  private testAudioInterval: ReturnType<typeof setInterval> | null = null;
  private useTestAudio: boolean = false; // Set to true for emulator testing
  private audioRecordInitialized: boolean = false;

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const result = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        return result === RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.MICROPHONE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  /**
   * Connect to Deepgram via backend proxy
   * React Native WebSocket doesn't support custom headers, so we use a backend proxy
   */
  private async connectDeepgram(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to backend WebSocket proxy
        // Backend handles Deepgram authentication with headers
        // For Android emulator, use 10.0.2.2 to access host machine's localhost
        const proxyUrl = 'ws://10.0.2.2:3001/ws/deepgram?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&language=en&punctuate=true&interim_results=true';

        console.log('Connecting to Deepgram via proxy:', proxyUrl);
        this.ws = new WebSocket(proxyUrl);

        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('Connection timeout. Check your API key and network connection.'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('Deepgram WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            // Deepgram can send binary messages (acknowledgments) or text messages (JSON transcripts)
            // Check if message is binary
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
              // Binary messages are just acknowledgments, we can ignore them
              console.log('[Deepgram] Received binary message (acknowledgment), size:', event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.size);
              return;
            }

            // For text messages, try to parse as JSON
            const messageText = typeof event.data === 'string' ? event.data : event.data.toString();
            
            console.log('[Deepgram] Received message:', messageText.substring(0, 200));
            
            // Skip empty messages or non-JSON messages (like "ok" status messages)
            if (!messageText || !messageText.trim().startsWith('{')) {
              console.log('[Deepgram] Skipping non-JSON message:', messageText.substring(0, 50));
              return;
            }

            const data = JSON.parse(messageText);
            console.log('[Deepgram] Parsed message type:', data.type, 'Full message:', JSON.stringify(data).substring(0, 300));
            this.handleDeepgramMessage(data);
          } catch (error) {
            // Only log if it's a JSON parsing error for what looks like JSON
            const messageText = typeof event.data === 'string' ? event.data : event.data?.toString() || '';
            if (messageText.trim().startsWith('{')) {
              console.error('[Deepgram] Error parsing WebSocket message:', error, 'Message:', messageText.substring(0, 200));
            } else {
              console.log('[Deepgram] Non-JSON message (ignored):', messageText.substring(0, 50));
            }
          }
        };

        this.ws.onerror = (error: any) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          const errorMsg = error?.message || 'WebSocket connection failed. Please check your API key.';
          reject(new Error(errorMsg));
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('WebSocket closed', event.code, event.reason);
          this.ws = null;
          if (event.code !== 1000 && event.code !== 1001) {
            // Not a normal closure
            const reason = event.reason || `Code ${event.code}`;
            reject(new Error(`WebSocket closed: ${reason}`));
          }
        };
      } catch (error: any) {
        reject(new Error(`Failed to create WebSocket: ${error.message}`));
      }
    });
  }

  /**
   * Handle incoming messages from Deepgram
   */
  private handleDeepgramMessage(data: any): void {
    console.log('[Deepgram] Handling message - type:', data.type, 'keys:', Object.keys(data));
    
    // Deepgram sends different message types
    // New format: TurnInfo messages with transcript directly
    if (data.type === 'TurnInfo') {
      console.log('[Deepgram] TurnInfo message - transcript:', data.transcript, 'event:', data.event, 'end_of_turn_confidence:', data.end_of_turn_confidence);
      
      if (data.transcript !== undefined) {
        const transcript = data.transcript;
        // TurnInfo messages with event "Update" are interim results
        // Final when event is "EndOfTurn" or when end_of_turn_confidence is high
        const isFinal = data.event === 'EndOfTurn' || (data.event === 'Update' && data.end_of_turn_confidence > 0.5);
        
        if (this.transcriptCallback && transcript.trim()) {
          console.log('[Deepgram] ✅ Received transcript:', transcript, isFinal ? '(final)' : '(interim)', 'event:', data.event);
          this.transcriptCallback({
            transcript,
            isFinal,
          });
        } else {
          console.log('[Deepgram] ⚠️ TurnInfo transcript empty or no callback. Transcript:', transcript, 'Has callback:', !!this.transcriptCallback);
        }
      } else {
        console.log('[Deepgram] TurnInfo message has no transcript field');
      }
    }
    // Legacy format: Results messages (keep for backward compatibility)
    else if (data.type === 'Results') {
      console.log('[Deepgram] Results message - channel:', data.channel, 'alternatives:', data.channel?.alternatives);
      
      if (data.channel?.alternatives?.[0]?.transcript) {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final || false;

        if (this.transcriptCallback && transcript.trim()) {
          console.log('[Deepgram] ✅ Received transcript (legacy):', transcript, isFinal ? '(final)' : '(interim)');
          this.transcriptCallback({
            transcript,
            isFinal,
          });
        }
      } else {
        console.log('[Deepgram] Results message has no transcript in expected location');
      }
    }
    // Connected message
    else if (data.type === 'Connected') {
      console.log('[Deepgram] ✅ Connected to Deepgram, request_id:', data.request_id);
    }
    // Unknown message type
    else {
      console.log('[Deepgram] ⚠️ Unknown message type:', data.type, 'Full data:', JSON.stringify(data).substring(0, 200));
    }
  }

  /**
   * Generate test audio (sine wave) for emulator testing
   * This creates a simple tone that Deepgram can transcribe
   */
  private startTestAudio(): void {
    console.log('Starting test audio generation (for emulator testing)');
    
    // Generate PCM audio: 16kHz, mono, 16-bit
    const sampleRate = 16000;
    const chunkSize = 1600; // 100ms chunks
    const frequency = 440; // A4 note
    
    this.testAudioInterval = setInterval(() => {
      if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Generate sine wave audio chunk
      const samples = new Int16Array(chunkSize);
      const phaseIncrement = (2 * Math.PI * frequency) / sampleRate;
      let phase = 0;

      for (let i = 0; i < chunkSize; i++) {
        samples[i] = Math.sin(phase) * 16383; // 16-bit PCM range
        phase += phaseIncrement;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
      }

      // Send audio chunk to Deepgram
      this.sendAudioData(samples.buffer);
    }, 100); // Send every 100ms
  }

  /**
   * Stop test audio generation
   */
  private stopTestAudio(): void {
    if (this.testAudioInterval) {
      clearInterval(this.testAudioInterval);
      this.testAudioInterval = null;
      console.log('Test audio generation stopped');
    }
  }

  /**
   * Initialize audio recorder for real microphone capture
   */
  private initAudioRecord(): void {
    if (this.audioRecordInitialized) {
      console.log('Audio recorder already initialized');
      return;
    }

    try {
      const options = {
        sampleRate: 16000, // Deepgram requires 16kHz
        channels: 1, // Mono
        bitsPerSample: 16, // 16-bit PCM
        audioSource: 6, // VOICE_RECOGNITION for best quality
        wavFile: 'test.wav', // Not used for streaming, but required
      };

      console.log('Initializing audio recorder with options:', options);
      AudioRecord.init(options);
      this.audioRecordInitialized = true;
      console.log('Audio recorder initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio recorder:', error);
      throw error;
    }
  }

  /**
   * Start real microphone audio capture using react-native-audio-record
   */
  private async startMicrophoneAudio(): Promise<void> {
    try {
      console.log('Starting microphone audio capture...');
      
      // Initialize audio recorder
      this.initAudioRecord();

      // Set up audio data callback
      AudioRecord.on('data', (data: string) => {
        console.log('Audio data received, length:', data?.length || 0);
        
        if (!this.isRecording) {
          console.log('Not recording, ignoring audio data');
          return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket not open, ignoring audio data. State:', this.ws?.readyState);
          return;
        }

        try {
          // react-native-audio-record sends data as base64-encoded PCM chunks
          // The data is already in 16-bit PCM format (signed 16-bit integers)
          // Decode base64 to Buffer, then convert to Int16Array for proper handling
          const audioChunk = Buffer.from(data, 'base64');
          
          // Deepgram expects signed 16-bit PCM (little-endian)
          // The Buffer already contains the raw bytes, we just need to send them
          const bytes = new Uint8Array(audioChunk);
          
          // Only log every 10th chunk to avoid spam
          if (!this.audioChunkCount) this.audioChunkCount = 0;
          this.audioChunkCount++;
          if (this.audioChunkCount % 10 === 0) {
            console.log('[Deepgram] Audio data received, chunk #' + this.audioChunkCount + ', size:', bytes.length, 'bytes');
          }
          
          // Send audio chunk to Deepgram as binary
          this.sendAudioData(bytes);
        } catch (error) {
          console.error('Error processing audio data:', error);
        }
      });

      // Start recording
      console.log('Calling AudioRecord.start()...');
      AudioRecord.start();
      console.log('Microphone recording started - waiting for audio data...');
      
      // Log after a short delay to see if data is coming
      setTimeout(() => {
        console.log('5 seconds after start - isRecording:', this.isRecording, 'ws state:', this.ws?.readyState);
      }, 5000);
      
    } catch (error: any) {
      console.error('Failed to start microphone audio:', error);
      throw new Error(`Microphone capture failed: ${error.message}`);
    }
  }

  /**
   * Stop microphone audio capture
   */
  private stopMicrophoneAudio(): void {
    try {
      if (this.audioRecordInitialized) {
        AudioRecord.stop();
        this.audioRecordInitialized = false;
        console.log('Microphone recording stopped');
      }
    } catch (error) {
      console.error('Error stopping microphone audio:', error);
    }
  }

  /**
   * Start transcription
   */
  async startTranscription(callback: TranscriptCallback, useTestAudio: boolean = false): Promise<void> {
    if (this.isRecording) {
      console.warn('Transcription already in progress');
      return;
    }

    try {
      // Request permissions (even for test audio, we'll request them)
      const hasPermission = await this.requestPermissions();
      if (!hasPermission && !useTestAudio) {
        throw new Error('Microphone permission denied');
      }

      // Connect to Deepgram
      await this.connectDeepgram();
      this.transcriptCallback = callback;
      this.useTestAudio = useTestAudio;

      // Start audio capture/streaming
      if (this.useTestAudio) {
        console.log('Using test audio mode (for emulator testing)');
        this.startTestAudio();
      } else {
        await this.startMicrophoneAudio();
      }
      
      this.isRecording = true;
      console.log('Transcription started');
      
    } catch (error: any) {
      console.error('Failed to start transcription:', error);
      this.stopTranscription();
      throw error;
    }
  }

  /**
   * Stop transcription
   */
  stopTranscription(): void {
    if (!this.isRecording) {
      return;
    }

    try {
      this.isRecording = false;

      // Stop audio capture
      if (this.useTestAudio) {
        this.stopTestAudio();
      } else {
        this.stopMicrophoneAudio();
      }

      // Close WebSocket
      if (this.ws) {
        this.ws.close(1000, 'Normal closure');
        this.ws = null;
      }

      this.transcriptCallback = null;
      console.log('Transcription stopped');
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  }

  /**
   * Send audio data to Deepgram
   * Call this method when you have audio chunks ready to send
   * Audio should be PCM format: 16kHz, mono, 16-bit
   */
  sendAudioData(audioData: ArrayBuffer | Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isRecording) {
      try {
        // Convert to Uint8Array if it's an ArrayBuffer
        let data: Uint8Array;
        if (audioData instanceof ArrayBuffer) {
          data = new Uint8Array(audioData);
        } else if (audioData instanceof Uint8Array) {
          data = audioData;
        } else {
          data = new Uint8Array(audioData);
        }
        
        // Log first few bytes occasionally to verify audio format (should be PCM)
        if (data.length > 0 && this.audioChunkCount % 50 === 0) {
          const sampleBytes = Array.from(data.slice(0, Math.min(8, data.length)));
          console.log('[Deepgram] 📤 Sending audio chunk #' + this.audioChunkCount + ':', data.length, 'bytes, first 8 bytes:', sampleBytes, 'WebSocket state:', this.ws.readyState);
        }
        
        // Send as binary data (not as base64 string)
        // React Native WebSocket expects ArrayBuffer or Uint8Array for binary data
        this.ws.send(data);
      } catch (error) {
        console.error('[Deepgram] ❌ Error sending audio data:', error);
      }
    } else {
      console.log('[Deepgram] ⚠️ Cannot send audio - ws:', !!this.ws, 'readyState:', this.ws?.readyState, 'isRecording:', this.isRecording);
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Transcribe an audio file using the backend API
   * This method sends the file path to the backend, which handles MP3 decoding and streaming to Deepgram
   */
  async transcribeFile(filePath: string, callback?: TranscriptCallback): Promise<string> {
    try {
      const baseURL = API_BASE_URL || 'http://10.0.2.2:3001';
      
      console.log(`Transcribing file: ${filePath}`);
      
      if (callback) {
        this.transcriptCallback = callback;
      }
      
      const response = await axios.post(`${baseURL}/transcribe-file`, {
        filePath: filePath
      }, {
        timeout: 60000 // 60 second timeout
      });

      const transcript = response.data.transcript || '';
      console.log('File transcription result:', transcript);
      
      // Call callback with the transcript if provided
      if (callback && transcript) {
        callback({
          transcript,
          isFinal: true
        });
      }
      
      return transcript;
    } catch (error: any) {
      console.error('File transcription error:', error);
      throw new Error(`Failed to transcribe file: ${error.message}`);
    }
  }
}

export default new DeepgramService();
