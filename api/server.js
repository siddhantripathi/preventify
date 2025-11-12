/**
 * Express server providing API endpoint for Docker model summarization
 */

const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const MODEL_NAME = 'ai/smollm2:135M-Q4_K_M';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_Key;

if (!DEEPGRAM_API_KEY) {
  console.error('ERROR: DEEPGRAM_API_KEY not found in environment variables!');
  console.error('Please ensure .env file contains DEEPGRAM_API_KEY or DEEPGRAM_API_Key');
}

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Enforce sentence limit by truncating text if necessary
 */
function enforceSentenceLimit(text, maxSentences) {
  if (!text) return '';
  
  // Split by sentence endings
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim());
  
  if (sentences.length <= maxSentences) {
    return text;
  }
  
  // Take first maxSentences and join
  const truncated = sentences.slice(0, maxSentences);
  let result = truncated.join('. ');
  
  // Ensure proper punctuation
  if (!result.match(/[.!?]$/)) {
    result += '.';
  }
  
  return result;
}

/**
 * Summarize text using Docker model
 */
async function summarizeText(text, maxSentences = 3) {
  if (!text || !text.trim()) {
    return '';
  }
  
  // Create prompt
  const prompt = `${text}\n\nSummarize the above in ${maxSentences} sentences.`;
  
  try {
    // Run Docker model
    const { stdout, stderr } = await execAsync(
      `docker model run ${MODEL_NAME} "${prompt.replace(/"/g, '\\"')}"`,
      { timeout: 30000 } // 30 second timeout
    );
    
    if (stderr && !stdout) {
      throw new Error(`Docker model error: ${stderr}`);
    }
    
    let summary = stdout.trim();
    
    // Enforce sentence limit
    summary = enforceSentenceLimit(summary, maxSentences);
    
    return summary;
  } catch (error) {
    if (error.killed) {
      throw new Error('Model inference timed out after 30 seconds');
    }
    throw new Error(`Model inference failed: ${error.message}`);
  }
}

/**
 * POST /summarize
 * Request body: { text: string, maxSentences?: number }
 * Response: { summary: string, timestamp: string }
 */
app.post('/summarize', async (req, res) => {
  try {
    const { text, maxSentences = 3 } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. "text" field is required and must be a string.'
      });
    }
    
    console.log(`[${new Date().toISOString()}] Generating summary for ${text.length} characters...`);
    
    const summary = await summarizeText(text, maxSentences);
    
    res.json({
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      message: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /transcribe-file
 * Streams an MP3 file to Deepgram and returns the transcript
 * Request body: { filePath: string }
 * Response: { transcript: string, isFinal: boolean } (streamed via WebSocket or returned)
 */
app.post('/transcribe-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. "filePath" field is required and must be a string.'
      });
    }

    // Resolve file path (relative to project root or absolute)
    let resolvedPath;
    if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      // Try multiple possible paths
      // __dirname is 'api' directory, so we go up one level to project root
      const projectRoot = path.join(__dirname, '..');
      const possiblePaths = [
        path.join(projectRoot, filePath),           // mobile/trial_voice1.mp3 from project root
        path.join(__dirname, '..', filePath),       // Same as above
        path.join(__dirname, filePath),             // From api directory
        filePath                                    // Relative to current working directory
      ];
      
      console.log('Attempting to resolve file path:', filePath);
      console.log('Project root:', projectRoot);
      console.log('Trying paths:', possiblePaths);
      
      resolvedPath = possiblePaths.find(p => {
        const exists = fs.existsSync(p);
        if (exists) {
          console.log('Found file at:', p);
        }
        return exists;
      });
      
      if (!resolvedPath) {
        console.error('File not found. Tried paths:', possiblePaths);
        console.error('Current working directory:', process.cwd());
        return res.status(404).json({
          error: `File not found: ${filePath}`,
          triedPaths: possiblePaths,
          projectRoot: projectRoot,
          cwd: process.cwd()
        });
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        error: `File not found: ${resolvedPath}`
      });
    }

    console.log(`[${new Date().toISOString()}] Transcribing file: ${resolvedPath}`);

    // Connect to Deepgram
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&language=en&punctuate=true&interim_results=true`;
    
    if (!DEEPGRAM_API_KEY) {
      return res.status(500).json({
        error: 'DEEPGRAM_API_KEY is missing!'
      });
    }

    const deepgramWs = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`
      }
    });

    let transcript = '';
    let isComplete = false;

    deepgramWs.on('open', () => {
      console.log('Deepgram WebSocket connected for file transcription');
      
      // Use ffmpeg to decode MP3 to PCM and stream to Deepgram
      // Output: 16kHz, mono, 16-bit PCM (s16le)
      const ffmpeg = spawn('ffmpeg', [
        '-i', resolvedPath,
        '-f', 's16le',
        '-ar', '16000',
        '-ac', '1',
        '-' // Output to stdout
      ]);

      ffmpeg.stdout.on('data', (chunk) => {
        if (deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(chunk);
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        // ffmpeg outputs progress to stderr, we can ignore it
      });

      ffmpeg.on('close', (code) => {
        console.log(`ffmpeg process exited with code ${code}`);
        // Close Deepgram connection after sending all audio
        setTimeout(() => {
          if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.close();
          }
        }, 1000);
      });

      ffmpeg.on('error', (error) => {
        console.error('ffmpeg error:', error);
        res.status(500).json({
          error: 'Failed to process audio file',
          message: error.message
        });
        deepgramWs.close();
      });
    });

    deepgramWs.on('message', (data) => {
      try {
        // Deepgram sends JSON messages for transcripts
        if (Buffer.isBuffer(data) || typeof data === 'string') {
          const messageText = Buffer.isBuffer(data) ? data.toString() : data;
          
          if (messageText.trim().startsWith('{')) {
            const message = JSON.parse(messageText);
            
            // Handle TurnInfo format (new Deepgram API format)
            if (message.type === 'TurnInfo' && message.transcript !== undefined) {
              const newTranscript = message.transcript;
              const isFinal = message.event === 'EndOfTurn' || (message.event === 'Update' && message.end_of_turn_confidence > 0.5);
              
              if (newTranscript.trim()) {
                if (isFinal) {
                  transcript = newTranscript;
                  isComplete = true;
                } else {
                  // For interim results, use the latest transcript
                  transcript = newTranscript;
                }
              }
            }
            // Handle legacy Results format (backward compatibility)
            else if (message.type === 'Results' && message.channel?.alternatives?.[0]?.transcript) {
              const newTranscript = message.channel.alternatives[0].transcript;
              const isFinal = message.is_final || false;
              
              if (newTranscript.trim()) {
                if (isFinal) {
                  transcript = newTranscript;
                  isComplete = true;
                } else {
                  // For interim results, we can append or replace
                  transcript = newTranscript;
                }
              }
            }
          }
        }
      } catch (error) {
        // Ignore parsing errors for non-JSON messages
      }
    });

    deepgramWs.on('close', () => {
      console.log('Deepgram WebSocket closed');
      if (!res.headersSent) {
        res.json({
          transcript: transcript || 'No transcript received',
          isFinal: isComplete,
          timestamp: new Date().toISOString()
        });
      }
    });

    deepgramWs.on('error', (error) => {
      console.error('Deepgram WebSocket error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Deepgram connection failed',
          message: error.message
        });
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!res.headersSent) {
        deepgramWs.close();
        res.json({
          transcript: transcript || 'Transcription timeout',
          isFinal: isComplete,
          timestamp: new Date().toISOString()
        });
      }
    }, 60000);

  } catch (error) {
    console.error('File transcription error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to transcribe file',
        message: error.message
      });
    }
  }
});

/**
 * WebSocket proxy for Deepgram
 * Proxies WebSocket connections from React Native app to Deepgram
 * Adds Authorization header since React Native WebSocket doesn't support headers
 */
const wss = new WebSocket.Server({ 
  server,
  path: '/ws/deepgram'
});

wss.on('connection', (clientWs, req) => {
  console.log('Client WebSocket connected');
  
  // Extract query parameters from client request
  const url = new URL(req.url, `http://${req.headers.host}`);
  const encoding = url.searchParams.get('encoding') || 'linear16';
  const sampleRate = url.searchParams.get('sample_rate') || '16000';
  const channels = url.searchParams.get('channels') || '1';
  const model = url.searchParams.get('model') || 'nova-2';
  const language = url.searchParams.get('language') || 'en';
  const punctuate = url.searchParams.get('punctuate') || 'true';
  const interimResults = url.searchParams.get('interim_results') || 'true';
  
  // Build Deepgram WebSocket URL with encoding parameters
  const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=${encoding}&sample_rate=${sampleRate}&channels=${channels}&model=${model}&language=${language}&punctuate=${punctuate}&interim_results=${interimResults}`;
  
  if (!DEEPGRAM_API_KEY) {
    console.error('DEEPGRAM_API_KEY is missing! Cannot connect to Deepgram.');
    clientWs.close(1011, 'Server configuration error: Missing API key');
    return;
  }

  // Connect to Deepgram with Authorization header
  const deepgramWs = new WebSocket(deepgramUrl, {
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`
    }
  });
  
  // Forward messages from client to Deepgram
  clientWs.on('message', (data, isBinary) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      try {
        // Forward binary audio data as-is
        // Deepgram expects raw PCM audio data (16-bit, 16kHz, mono)
        if (isBinary || Buffer.isBuffer(data)) {
          // Ensure it's a Buffer for proper binary handling
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          console.log('[Proxy] 📤 Forwarding binary audio to Deepgram:', buffer.length, 'bytes');
          deepgramWs.send(buffer, { binary: true });
        } else if (typeof data === 'string') {
          // Check if it's JSON (transcript messages) or base64 audio
          if (data.trim().startsWith('{')) {
            // JSON message
            console.log('[Proxy] 📤 Forwarding JSON to Deepgram:', data.substring(0, 100));
            deepgramWs.send(data);
          } else {
            // Might be base64 audio data, convert to buffer
            try {
              const buffer = Buffer.from(data, 'base64');
              console.log('[Proxy] 📤 Forwarding base64 audio to Deepgram:', buffer.length, 'bytes');
              deepgramWs.send(buffer, { binary: true });
            } catch (e) {
              console.error('[Proxy] ❌ Error converting base64 audio:', e);
            }
          }
        } else {
          // ArrayBuffer or Uint8Array - convert to Buffer
          const buffer = Buffer.from(data);
          console.log('[Proxy] 📤 Forwarding ArrayBuffer/Uint8Array to Deepgram:', buffer.length, 'bytes');
          deepgramWs.send(buffer, { binary: true });
        }
      } catch (error) {
        console.error('[Proxy] ❌ Error forwarding message to Deepgram:', error);
      }
    } else {
      console.log('[Proxy] ⚠️ Deepgram WebSocket not open, cannot forward. State:', deepgramWs.readyState);
    }
  });
  
  // Forward messages from Deepgram to client
  deepgramWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      if (isBinary) {
        console.log('[Proxy] 📥 Received binary from Deepgram:', Buffer.isBuffer(data) ? data.length : data.byteLength || data.length, 'bytes');
      } else {
        const messageText = Buffer.isBuffer(data) ? data.toString() : data.toString();
        console.log('[Proxy] 📥 Received message from Deepgram:', messageText.substring(0, 200));
      }
      // Forward message preserving binary/text type
      clientWs.send(data, { binary: isBinary });
    } else {
      console.log('[Proxy] ⚠️ Client WebSocket not open, cannot forward. State:', clientWs.readyState);
    }
  });
  
  // Handle Deepgram connection open
  deepgramWs.on('open', () => {
    console.log('Deepgram WebSocket connected via proxy');
  });
  
  // Handle errors
  deepgramWs.on('error', (error) => {
    console.error('Deepgram WebSocket error:', error);
    console.error('Error details:', error.message, error.stack);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Deepgram connection error');
    }
  });

  deepgramWs.on('close', (code, reason) => {
    console.log('Deepgram WebSocket closed:', code, reason?.toString());
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });
  
  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
  });
  
  // Clean up on close
  clientWs.on('close', () => {
    console.log('Client WebSocket disconnected');
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
  
});

// Start server
server.listen(PORT, () => {
  console.log(`Summarization API server running on port ${PORT}`);
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`WebSocket proxy available at ws://localhost:${PORT}/ws/deepgram`);
  console.log(`Endpoints:`);
  console.log(`  POST /summarize - Generate summary from text`);
  console.log(`  POST /transcribe-file - Transcribe MP3 file`);
  console.log(`  GET /health - Health check`);
});

