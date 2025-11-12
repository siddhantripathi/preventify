# Preventify

Live transcription and AI-powered summarization system using Deepgram and Dockerized SmolLM2 model.

## Project Structure

```
Preventify/
├── api/                  # Backend Express API server
│   ├── server.js         # API endpoint for Docker model summarization
│   └── package.json
├── mobile/               # React Native Android app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── services/    # API services
│   │   └── hooks/       # Custom React hooks
│   └── App.tsx          # Main app component
├── summarizer.py         # Python summarizer module (standalone)
└── transcript_summarizer.py  # Python integration example
```

## Features

- **Live Transcription**: Real-time speech-to-text using Deepgram API
- **AI Summarization**: Automatic 3-sentence summaries every 60 seconds
- **Summary History**: View all previous summaries in descending order
- **React Native Mobile App**: Clean, modern Android interface

## Quick Start

### 1. Backend API Setup

```bash
cd api
npm install
npm start
```

The API will run on `http://localhost:3001`

### 2. Mobile App Setup

```bash
cd mobile
npm install

# Create .env file with:
# DEEPGRAM_API_KEY=your_key_here
# API_BASE_URL=http://10.0.2.2:3001

npm start
# In another terminal:
npm run android
```

### 3. Prerequisites

- Docker installed and running
- Docker model pulled: `docker model pull ai/smollm2:135M-Q4_K_M`
- Node.js >= 20
- React Native development environment
- Android Studio (for Android development)

## Architecture

1. **Mobile App** captures audio and streams to Deepgram WebSocket API
2. **Deepgram** returns real-time transcriptions
3. **Every 60 seconds**, accumulated transcript is sent to backend API
4. **Backend API** calls Docker model to generate summary
5. **Summary** is displayed in the app and added to history

## API Keys

Create `.env` files from the example files:
- Copy `api/.env.example` to `api/.env` and add your `DEEPGRAM_API_KEY`
- Copy `mobile/.env.example` to `mobile/.env` and configure `API_BASE_URL` (and optionally `DEEPGRAM_API_KEY`)
- Copy `.env.example` to `.env` in the root directory for Python scripts

**Important**: Never commit `.env` files to version control. They are already excluded via `.gitignore`.

## Documentation

- [Mobile App README](mobile/README.md)
- [API Server README](api/README.md)

## Notes

- Summaries are limited to 3 sentences maximum
- Backend API must be running for summarization
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For physical device, use your computer's IP address

