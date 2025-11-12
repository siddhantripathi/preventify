"""
Example integration of Deepgram live transcription with SmolLM2 summarization.
This shows how to combine the transcript.py script with the summarizer.
"""

from deepgram import DeepgramClient
from deepgram.core.events import EventType
from urllib.parse import urljoin
import os
import subprocess
import threading
from transcript_summarizer import TranscriptSummarizer


# Load API key from environment
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Initialize the transcript summarizer
# Summaries will be generated every 60 seconds
summarizer = TranscriptSummarizer(summary_interval=60)


def n8n_webhook_callback(summary: str):
    """
    Callback function to send summaries to n8n webhook.
    Replace with your actual n8n webhook URL.
    """
    # Uncomment and configure when ready:
    # import requests
    # webhook_url = "https://your-n8n-instance.com/webhook/summaries"
    # requests.post(webhook_url, json={"summary": summary, "timestamp": datetime.now().isoformat()})
    print(f"[n8n] Would send summary to webhook: {summary[:50]}...")


# Set the callback for n8n integration
summarizer.set_summary_callback(n8n_webhook_callback)

# Start the summarizer
summarizer.start()

# Initialize Deepgram client
client = DeepgramClient(api_key=DEEPGRAM_API_KEY)

with client.listen.v2.connect(
    model="flux-general-en",
    encoding="linear16",
    sample_rate=16000,
) as connection:
    ready = threading.Event()
    
    def on_message(result):
        """Handle incoming transcript messages."""
        event = getattr(result, "event", None)
        turn_index = getattr(result, "turn_index", None)
        eot_confidence = getattr(result, "end_of_turn_confidence", None)
        
        if event == "StartOfTurn":
            print(f"--- StartOfTurn (Turn {turn_index}) ---")
        
        transcript = getattr(result, "transcript", None)
        if transcript:
            print(transcript)
            # Add transcript to summarizer buffer
            summarizer.add_transcript(transcript)
        
        if event == "EndOfTurn":
            print(f"--- EndOfTurn (Turn {turn_index}, Confidence: {eot_confidence}) ---")
    
    connection.on(EventType.OPEN, lambda _: ready.set())
    connection.on(EventType.MESSAGE, on_message)
    
    # Start audio stream (example with CSPAN Radio)
    ffmpeg = subprocess.Popen([
        "ffmpeg", "-loglevel", "quiet", "-i",
        urljoin("https://playerservices.streamtheworld.com",
                "/api/livestream-redirect/CSPANRADIOAAC.aac"),
        "-f", "s16le", "-ar", "16000", "-ac", "1", "-"
    ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    
    def stream():
        """Stream audio data to Deepgram."""
        ready.wait()
        while data := ffmpeg.stdout.read(2560):
            connection.send_media(data)
    
    threading.Thread(target=stream, daemon=True).start()
    
    print("Transcribing audio stream...")
    print("Summaries will be generated every 60 seconds.")
    print("Press Ctrl+C to stop.\n")
    
    try:
        connection.start_listening()
    except KeyboardInterrupt:
        print("\nStopping...")
        summarizer.stop()
        ffmpeg.terminate()

