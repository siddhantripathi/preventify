"""
Summarization module using SmolLM2 Docker model.
This module loads and uses the ai/smollm2:135M-Q4_K_M Docker model
for generating concise summaries (max 3 sentences) from transcripts.
"""

import subprocess
import json
import re
from typing import Optional


class SmolLM2Summarizer:
    """Wrapper for the SmolLM2 Docker model for text summarization."""
    
    def __init__(self, model_name: str = "ai/smollm2:135M-Q4_K_M"):
        """
        Initialize the summarizer with a Docker model.
        
        Args:
            model_name: Docker model identifier
        """
        self.model_name = model_name
        self._verify_model_available()
    
    def _verify_model_available(self):
        """Verify that the Docker model is available."""
        try:
            result = subprocess.run(
                ["docker", "model", "ls"],
                capture_output=True,
                text=True,
                check=True
            )
            if self.model_name not in result.stdout:
                raise RuntimeError(
                    f"Model {self.model_name} not found. "
                    "Please pull it using: docker model pull ai/smollm2:135M-Q4_K_M"
                )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to verify Docker model: {e}")
        except FileNotFoundError:
            raise RuntimeError("Docker is not installed or not in PATH")
    
    def summarize(self, text: str, max_sentences: int = 3) -> str:
        """
        Generate a summary of the input text.
        
        Args:
            text: The text to summarize
            max_sentences: Maximum number of sentences in the summary (default: 3)
            
        Returns:
            A summarized version of the input text
        """
        if not text or not text.strip():
            return ""
        
        # Create a prompt that enforces the sentence limit
        # Use a direct instruction format that works well with SmolLM2
        prompt = (
            f"{text}\n\nSummarize the above in {max_sentences} sentences."
        )
        
        try:
            # Run the Docker model
            result = subprocess.run(
                ["docker", "model", "run", self.model_name, prompt],
                capture_output=True,
                text=True,
                check=True,
                timeout=30  # 30 second timeout
            )
            
            summary = result.stdout.strip()
            
            # Enforce sentence limit by truncating if necessary
            summary = self._enforce_sentence_limit(summary, max_sentences)
            
            return summary
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("Model inference timed out after 30 seconds")
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Model inference failed: {e.stderr}")
    
    def _enforce_sentence_limit(self, text: str, max_sentences: int) -> str:
        """
        Enforce sentence limit by truncating text if it exceeds max_sentences.
        
        Args:
            text: The text to process
            max_sentences: Maximum number of sentences allowed
            
        Returns:
            Text truncated to max_sentences sentences
        """
        # Split by sentence endings (period, exclamation, question mark)
        sentences = re.split(r'[.!?]+\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) <= max_sentences:
            return text
        
        # Take first max_sentences and join them
        truncated = sentences[:max_sentences]
        result = '. '.join(truncated)
        
        # Ensure it ends with proper punctuation
        if not result.endswith(('.', '!', '?')):
            result += '.'
        
        return result
    
    def summarize_transcript(self, transcript_text: str) -> str:
        """
        Summarize transcript text with a 3-sentence limit.
        
        Args:
            transcript_text: The transcript text to summarize
            
        Returns:
            A 3-sentence summary
        """
        return self.summarize(transcript_text, max_sentences=3)


def main():
    """Test the summarizer with sample text."""
    print("Loading SmolLM2 model...")
    summarizer = SmolLM2Summarizer()
    
    # Test with sample transcript
    sample_transcript = """
    Speaker 1: Good morning everyone, welcome to today's meeting. We're going to discuss 
    the quarterly results and our plans for the next quarter.
    
    Speaker 2: Thank you for having me. I'm excited to share our progress on the new product 
    launch. We've made significant strides in the past month.
    
    Speaker 1: That's great to hear. Can you walk us through the key milestones?
    
    Speaker 2: Absolutely. We've completed the initial design phase, finished user testing, 
    and we're now ready to begin production. The feedback has been overwhelmingly positive.
    
    Speaker 1: Excellent work. What about the marketing strategy?
    
    Speaker 2: We've partnered with three major influencers and scheduled a launch event 
    for next month. Our social media campaign is already generating buzz.
    """
    
    print("\nGenerating summary...")
    summary = summarizer.summarize_transcript(sample_transcript)
    
    print("\n" + "="*60)
    print("SUMMARY (3 sentences max):")
    print("="*60)
    print(summary)
    print("="*60)


if __name__ == "__main__":
    main()

