"""
Integration script for live transcript summarization.
This script combines Deepgram live transcription with SmolLM2 summarization,
generating summaries every 1 minute from accumulated transcript text.
"""

import time
import threading
from datetime import datetime
from typing import List, Optional, Callable
from summarizer import SmolLM2Summarizer


class TranscriptSummarizer:
    """
    Manages live transcript summarization with periodic summary generation.
    """
    
    def __init__(
        self,
        summary_interval: int = 60,  # seconds
        summarizer: Optional[SmolLM2Summarizer] = None
    ):
        """
        Initialize the transcript summarizer.
        
        Args:
            summary_interval: Time in seconds between summaries (default: 60)
            summarizer: Optional SmolLM2Summarizer instance (creates new if None)
        """
        self.summary_interval = summary_interval
        self.summarizer = summarizer or SmolLM2Summarizer()
        self.transcript_buffer: List[str] = []
        self.buffer_lock = threading.Lock()
        self.summary_callback: Optional[Callable[[str], None]] = None
        self.running = False
        self.summary_thread: Optional[threading.Thread] = None
    
    def add_transcript(self, text: str):
        """
        Add transcript text to the buffer.
        
        Args:
            text: Transcript text to add
        """
        if text and text.strip():
            with self.buffer_lock:
                self.transcript_buffer.append(text.strip())
    
    def set_summary_callback(self, callback: Callable[[str], None]):
        """
        Set a callback function to be called when a summary is generated.
        Useful for n8n webhook integration.
        
        Args:
            callback: Function that accepts summary text as parameter
        """
        self.summary_callback = callback
    
    def _generate_summary(self) -> Optional[str]:
        """
        Generate a summary from the current transcript buffer.
        
        Returns:
            Summary text or None if buffer is empty
        """
        with self.buffer_lock:
            if not self.transcript_buffer:
                return None
            
            # Get all transcript text
            full_text = " ".join(self.transcript_buffer)
            
            # Clear buffer after summarizing
            self.transcript_buffer.clear()
        
        try:
            summary = self.summarizer.summarize_transcript(full_text)
            return summary
        except Exception as e:
            print(f"Error generating summary: {e}")
            return None
    
    def _summary_loop(self):
        """Background thread that generates summaries at regular intervals."""
        while self.running:
            time.sleep(self.summary_interval)
            
            if not self.running:
                break
            
            summary = self._generate_summary()
            
            if summary:
                timestamp = datetime.now().isoformat()
                print(f"\n[{timestamp}] Generated Summary:")
                print("-" * 60)
                print(summary)
                print("-" * 60)
                
                # Call callback if set (for n8n integration)
                if self.summary_callback:
                    try:
                        self.summary_callback(summary)
                    except Exception as e:
                        print(f"Error in summary callback: {e}")
    
    def start(self):
        """Start the periodic summarization thread."""
        if self.running:
            return
        
        self.running = True
        self.summary_thread = threading.Thread(target=self._summary_loop, daemon=True)
        self.summary_thread.start()
        print(f"Transcript summarizer started (summary interval: {self.summary_interval}s)")
    
    def stop(self):
        """Stop the periodic summarization thread."""
        self.running = False
        if self.summary_thread:
            self.summary_thread.join(timeout=5)
        print("Transcript summarizer stopped")
    
    def get_current_transcript(self) -> str:
        """
        Get the current accumulated transcript text.
        
        Returns:
            All transcript text accumulated so far
        """
        with self.buffer_lock:
            return " ".join(self.transcript_buffer)
    
    def force_summary(self) -> Optional[str]:
        """
        Force immediate summary generation from current buffer.
        
        Returns:
            Summary text or None if buffer is empty
        """
        return self._generate_summary()


# Example usage and testing
def example_callback(summary: str):
    """Example callback function for n8n integration."""
    print(f"\n[Callback] Summary received: {summary}")
    # Here you would send to n8n webhook
    # import requests
    # requests.post("https://your-n8n-webhook-url", json={"summary": summary})


def main():
    """Test the transcript summarizer."""
    print("Initializing Transcript Summarizer...")
    
    # Create summarizer with 30-second interval for testing
    summarizer = TranscriptSummarizer(summary_interval=30)
    summarizer.set_summary_callback(example_callback)
    
    # Start the summarizer
    summarizer.start()
    
    # Simulate adding transcript chunks
    print("\nSimulating transcript input...")
    test_transcripts = [
        "Good morning everyone, welcome to today's meeting.",
        "We're going to discuss the quarterly results and our plans.",
        "I'm excited to share our progress on the new product launch.",
        "We've made significant strides in the past month.",
        "We've completed the initial design phase and finished user testing.",
        "We're now ready to begin production.",
        "The feedback has been overwhelmingly positive.",
        "We've partnered with three major influencers.",
        "Our social media campaign is already generating buzz.",
    ]
    
    for i, transcript in enumerate(test_transcripts, 1):
        print(f"Adding transcript chunk {i}...")
        summarizer.add_transcript(transcript)
        time.sleep(5)  # Simulate real-time input
    
    # Wait for summary
    time.sleep(35)
    
    # Force a summary
    print("\nForcing immediate summary...")
    summary = summarizer.force_summary()
    if summary:
        print(f"\nForced Summary:\n{summary}")
    
    # Stop the summarizer
    summarizer.stop()


if __name__ == "__main__":
    main()

