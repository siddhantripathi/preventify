# Preventify Mobile App

React Native Android app for live transcription with AI-powered summarization.

## Features

- **Live Transcription**: Real-time speech-to-text using Deepgram API
- **AI Summarization**: Automatic summaries generated every 60 seconds using Dockerized SmolLM2 model
- **Summary History**: View all previous summaries in a dropdown menu (descending order)
- **Clean UI**: Modern, user-friendly interface

## Prerequisites

- Node.js >= 20
- React Native development environment set up
- Android Studio and Android SDK (for Android development)
- Backend API server running (see `../api/README.md`)

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` in the `mobile/` directory
   - Update the values:
     ```
     API_BASE_URL=http://10.0.2.2:3001
     DEEPGRAM_API_KEY=your_deepgram_api_key_here  # Optional if using backend proxy
     ```
   
   **Note**: 
   - For Android emulator, use `10.0.2.2` to access localhost
   - For physical device, use your computer's IP address (e.g., `http://192.168.1.100:3001`)
   - Get your Deepgram API key from: https://console.deepgram.com/

3. **Start Metro bundler:**
   ```bash
   npm start
   ```

4. **Run on Android:**
   ```bash
   npm run android
   ```

## Project Structure

```
mobile/
├── src/
│   ├── components/       # UI components
│   │   ├── TranscriptView.tsx
│   │   ├── SummaryView.tsx
│   │   └── SummaryDropdown.tsx
│   ├── services/         # API services
│   │   ├── DeepgramService.ts
│   │   └── SummaryService.ts
│   ├── hooks/            # Custom React hooks
│   │   ├── useTranscription.ts
│   │   └── useSummaries.ts
│   └── types/            # TypeScript type definitions
│       └── env.d.ts
├── App.tsx               # Main app component
└── .env                  # Environment variables (not in git)
```

## Usage

1. **Start the backend API server** (in `../api/` directory):
   ```bash
   cd ../api
   npm install
   npm start
   ```

2. **Launch the app** on Android device/emulator

3. **Tap "Start Recording"** to begin live transcription

4. **Speak** - your words will be transcribed in real-time

5. **Summaries** are automatically generated every 60 seconds

6. **View previous summaries** by tapping "Previous Summaries" dropdown

7. **Tap "Stop Recording"** when done

## Troubleshooting

### Backend Connection Issues
- Ensure the backend API is running on port 3001
- For Android emulator: Use `http://10.0.2.2:3001`
- For physical device: Use your computer's IP address (e.g., `http://192.168.1.100:3001`)

### Microphone Permissions
- Android: Permissions are automatically requested on first use
- If permissions are denied, go to Settings > Apps > Preventify > Permissions and enable microphone

### Audio Recording Issues

#### Android Emulator Microphone
The Android emulator microphone often doesn't work. The app includes a **test audio mode** that generates test audio to verify the WebSocket connection and audio streaming.

**Option 1: Use Test Audio Mode (Default)**
- The app automatically uses test audio mode when running on emulator
- This verifies that Deepgram connection and audio streaming work
- Test audio generates a sine wave tone (won't produce speech transcription, but confirms the pipeline works)

**Option 2: Enable Host Microphone (Recommended for Testing)**
To use your computer's microphone with the Android emulator:
```bash
adb emu avd hostmicon
```
This routes your host machine's microphone to the emulator. Then set `useTestAudio: false` in `App.tsx`.

**Option 3: Use Physical Device**
For best results, test on a physical Android device with a working microphone.

#### Physical Device
- Ensure your device has microphone access
- Permissions are automatically requested on first use
- If permissions are denied, go to Settings > Apps > Preventify > Permissions and enable microphone

## Dependencies

- `react-native`: Core framework
- `react-native-audio-recorder-player`: Audio recording library
- `react-native-permissions`: Permission handling
- `react-native-dotenv`: Environment variable management
- `axios`: HTTP client for API calls

## Audio Implementation

The app supports two audio modes:

1. **Test Audio Mode** (Default for emulator): Generates sine wave audio to verify WebSocket connection and streaming pipeline
2. **Microphone Mode**: Captures audio from device microphone (requires working microphone)

For production use on physical devices, microphone capture will need to be fully implemented using native modules for low-latency audio streaming. The current implementation uses test audio mode for emulator testing.

## Notes

- Summaries are limited to 3 sentences maximum
- Transcript buffer is cleared after each summary generation
- The app requires an active internet connection for Deepgram transcription
- Backend API must be running for summarization to work
