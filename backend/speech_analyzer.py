import os
import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt
from IPython.display import Audio, display
import whisper
import pyaudio
import wave
import time
from datetime import datetime
import re
import threading
import cv2 as cv
import mediapipe as mp
import math
import socket
import argparse
import csv
from collections import deque
import soundfile as sf

# ============ CONFIGURATION ============
# Speech Analysis
SAVE_VIS_DIR = "comprehensive_analysis"
os.makedirs(SAVE_VIS_DIR, exist_ok=True)

# Recording Control
IS_RECORDING = False
RECORDING_START_TIME = None

# ============ GLOBAL STATE ============
# Speech Analysis
current_audio_file = None
speech_results = None
audio_recorder = None
recording_thread = None

# Real-time Data Buffers
speech_buffer = deque(maxlen=100)  # Store recent speech analysis

# ============ SPEECH ANALYSIS CLASSES & FUNCTIONS ============

class VoiceRecorder:
    def __init__(self):
        self.CHUNK = 1024
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 16000
        self.frames = []
        self.recording = False
        self.stream = None
        self.p = None

    def start_recording(self):
        """Start recording ENGLISH audio"""
        self.recording = True
        self.frames = []

        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK
        )

        print("🎤 ENGLISH Recording started... Speak in ENGLISH only")

        def record():
            while self.recording:
                data = self.stream.read(self.CHUNK, exception_on_overflow=False)
                self.frames.append(data)

        self.record_thread = threading.Thread(target=record)
        self.record_thread.start()

    def stop_recording(self):
        """Stop recording audio"""
        if self.recording:
            self.recording = False
            if hasattr(self, 'record_thread'):
                self.record_thread.join()

            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
            if self.p:
                self.p.terminate()

            print("⏹️ Recording stopped")
            return True
        return False

    def save_recording(self):
        """Save the recorded audio"""
        if not self.frames:
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = f"english_speech_{timestamp}.wav"

        wf = wave.open(file_path, 'wb')
        wf.setnchannels(self.CHANNELS)
        wf.setsampwidth(self.p.get_sample_size(self.FORMAT))
        wf.setframerate(self.RATE)
        wf.writeframes(b''.join(self.frames))
        wf.close()

        print(f"💾 Saved ENGLISH recording: {file_path}")
        return file_path

def transcribe_english_only(file_path):
    """Force English-only transcription"""
    print("[+] Transcribing ENGLISH audio using Whisper...")
    model = whisper.load_model("base")

    y, sr = librosa.load(file_path, sr=16000, mono=True)
    audio = whisper.pad_or_trim(y.astype(np.float32))
    mel = whisper.log_mel_spectrogram(audio).to(model.device)

    options = whisper.DecodingOptions(language='en')
    result = whisper.decode(model, mel, options)
    text = result.text.strip()

    if not text:
        print("❌ No English speech detected. Please speak in English.")
        return ""

    print("[+] ENGLISH transcription complete.")
    return text

def check_english_grammar_spelling(text):
    """English-only grammar and spelling check"""
    if not text or text.strip() == "":
        return {
            "grammar_errors": 0,
            "spelling_errors": 0,
            "total_errors": 0,
            "accuracy_score": 100,
            "error_details": []
        }

    english_spelling_errors = {
        'recieve': 'receive', 'acheive': 'achieve', 'definately': 'definitely',
        'seperate': 'separate', 'occured': 'occurred', 'untill': 'until',
        'wich': 'which', 'teh': 'the', 'adn': 'and', 'thier': 'their',
    }

    english_verb_errors = {
        'buyed': 'bought', 'goed': 'went', 'runned': 'ran', 'eated': 'ate',
        'drinked': 'drank', 'sleeped': 'slept', 'thinked': 'thought',
    }

    all_english_errors = {**english_spelling_errors, **english_verb_errors}

    english_grammar_rules = [
        (r'\b(I|he|she|it) (go|do|have|am)\b', 'Use "goes/does/has/is" for third person singular'),
        (r'\b(you|we|they) (goes|does|has|is)\b', 'Use "go/do/have/are" for plural subjects'),
        (r'\b(I) (are)\b', 'Use "am" with "I"'),
        (r'\b(he|she|it) (are)\b', 'Use "is" with he/she/it'),
    ]

    words = text.split()
    spelling_errors = 0
    grammar_errors = 0
    error_details = []

    for i, word in enumerate(words):
        clean_word = re.sub(r'[^\w]', '', word.lower())

        if len(clean_word) <= 2 or clean_word.isdigit():
            continue

        if clean_word in all_english_errors:
            spelling_errors += 1
            error_details.append({
                'type': 'Spelling',
                'message': f'English spelling error: "{clean_word}"',
                'suggestion': f'Correct: "{all_english_errors[clean_word]}"',
                'word': clean_word
            })

    for pattern, message in english_grammar_rules:
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            grammar_errors += 1
            error_details.append({
                'type': 'Grammar',
                'message': f'English grammar: {message}',
                'suggestion': f'Check: "{match.group()}"',
                'word': match.group()
            })

    total_errors = grammar_errors + spelling_errors
    word_count = len(words)

    if word_count > 0:
        accuracy_score = max(0, 100 - (total_errors / word_count * 150))
    else:
        accuracy_score = 100

    print(f"[+] English analysis: {spelling_errors} spelling errors, {grammar_errors} grammar errors")

    return {
        "grammar_errors": grammar_errors,
        "spelling_errors": spelling_errors,
        "total_errors": total_errors,
        "accuracy_score": round(accuracy_score, 1),
        "error_details": error_details
    }

def evaluate_english_text(text, duration_seconds):
    word_count = len(text.split())
    wpm = round(word_count / (duration_seconds / 60), 2) if duration_seconds > 0 else 0

    grammar_results = check_english_grammar_spelling(text)

    return {
        "text": text,
        "word_count": word_count,
        "duration_seconds": round(duration_seconds, 2),
        "wpm": wpm,
        "grammar_errors": grammar_results["grammar_errors"],
        "spelling_errors": grammar_results["spelling_errors"],
        "total_errors": grammar_results["total_errors"],
        "accuracy_score": grammar_results["accuracy_score"],
        "error_details": grammar_results["error_details"]
    }

def analyze_speech():
    """Analyze speech in a separate thread"""
    global current_audio_file, speech_results

    if current_audio_file and os.path.exists(current_audio_file):
        try:
            y, sr, duration = visualize_audio(current_audio_file)
            text = transcribe_english_only(current_audio_file)

            if text:
                results = evaluate_english_text(text, duration)
                speech_results = results
                speech_buffer.append(results)

                print(f"\n🎯 REAL-TIME SPEECH ANALYSIS:")
                print(f"Text: {text}")
                print(f"Accuracy: {results['accuracy_score']}%")
                print(f"WPM: {results['wpm']}")
                print(f"Errors: {results['total_errors']}")
        except Exception as e:
            print(f"Speech analysis error: {e}")

def visualize_audio(file_path):
    y, sr = librosa.load(file_path, sr=16000, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    return y, sr, duration

# ============ REAL-TIME INTEGRATION FUNCTIONS ============

def start_speech_recording():
    """Start speech recording in background"""
    global audio_recorder, current_audio_file
    audio_recorder = VoiceRecorder()
    audio_recorder.start_recording()

def stop_speech_recording():
    """Stop speech recording and analyze"""
    global audio_recorder, current_audio_file
    if audio_recorder and audio_recorder.recording:
        audio_recorder.stop_recording()
        current_audio_file = audio_recorder.save_recording()

        # Analyze speech in background thread
        analysis_thread = threading.Thread(target=analyze_speech)
        analysis_thread.start()

def calculate_engagement_score(eye_contact_ratio, speech_accuracy, speaking_rate, voice_factor=0):
    """Calculate overall engagement score"""
    eye_weight = 0.35
    speech_weight = 0.35
    rate_weight = 0.15
    voice_weight = 0.15

    # Normalize speaking rate (ideal range: 120-150 WPM)
    rate_score = max(0, min(100, 100 - abs(speaking_rate - 135) * 2))

    engagement = (eye_contact_ratio * eye_weight * 100 +
                 speech_accuracy * speech_weight +
                 rate_score * rate_weight +
                 voice_factor * voice_weight * 100)

    return min(100, max(0, engagement))

# ============ WEB INTEGRATION FUNCTIONS ============

def process_audio_from_web(audio_data, filename="web_audio.wav"):
    """Process audio data received from web client"""
    try:
        # Save the audio data to a temporary file
        with open(filename, 'wb') as f:
            f.write(audio_data)

        # Analyze the audio
        y, sr, duration = visualize_audio(filename)
        text = transcribe_english_only(filename)

        if text:
            results = evaluate_english_text(text, duration)
            return results
        else:
            return {
                "text": "",
                "word_count": 0,
                "duration_seconds": duration,
                "wpm": 0,
                "grammar_errors": 0,
                "spelling_errors": 0,
                "total_errors": 0,
                "accuracy_score": 0,
                "error_details": []
            }
    except Exception as e:
        print(f"Error processing web audio: {e}")
        return None
    finally:
        # Clean up temporary file
        if os.path.exists(filename):
            os.remove(filename)
