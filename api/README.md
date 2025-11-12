# Preventify API Server

Express.js backend API that wraps Docker model calls for text summarization.

## Prerequisites

- Node.js >= 14
- Docker installed and running
- Docker model `ai/smollm2:135M-Q4_K_M` pulled (see main README)

## Setup

1. **Install dependencies:**
   ```bash
   cd api
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

   The server will run on `http://localhost:3001` by default.

## API Endpoints

### POST /summarize

Generate a summary from transcript text.

**Request:**
```json
{
  "text": "Your transcript text here...",
  "maxSentences": 3
}
```

**Response:**
```json
{
  "summary": "Generated summary text...",
  "timestamp": "2025-01-10T17:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "message": "Detailed error message"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-10T17:00:00.000Z"
}
```

### POST /transcribe-file

Transcribe an MP3 audio file using Deepgram.

**Request:**
```json
{
  "filePath": "mobile/trial_voice1.mp3"
}
```

**Response:**
```json
{
  "transcript": "Transcribed text from the audio file...",
  "timestamp": "2025-01-10T17:00:00.000Z"
}
```

### WebSocket /ws/deepgram

WebSocket proxy endpoint for Deepgram live transcription. This endpoint:
- Handles Deepgram authentication
- Forwards audio data to Deepgram
- Forwards transcript messages back to client

**Query Parameters:**
- `encoding`: Audio encoding (default: `linear16`)
- `sample_rate`: Sample rate in Hz (default: `16000`)
- `channels`: Number of audio channels (default: `1`)
- `model`: Deepgram model (default: `nova-2`)
- `language`: Language code (default: `en`)
- `punctuate`: Enable punctuation (default: `true`)
- `interim_results`: Return interim results (default: `true`)

## Configuration

1. **Environment Variables:**
   - Copy `.env.example` to `.env`
   - Add your Deepgram API key: `DEEPGRAM_API_KEY=your_key_here`
   - Get your API key from: https://console.deepgram.com/

2. **Server Settings:**
   - `PORT`: Server port (default: 3001)
   - Model name is hardcoded to `ai/smollm2:135M-Q4_K_M`

## Notes

- The API calls Docker model via `docker model run` command
- Request timeout is 30 seconds (model inference timeout)
- CORS is enabled for React Native app access
- The model enforces a maximum sentence limit (default: 3)

