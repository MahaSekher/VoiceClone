# 🎙 VoiceForge — Local Voice Cloning App

Clone any voice from a short audio sample and generate unlimited speech in that voice, accent, and tone — **100% offline, no API keys needed.**

## ✨ Features

- Upload any audio (WAV, MP3, OGG, FLAC, M4A, WEBM)
- Generate speech from any text in the cloned voice
- Supports 12+ languages
- All processing runs locally on your machine
- Beautiful dark-themed UI
- Download all generated audios

## 🤖 Powered By

| Tool | Purpose |
|------|---------|
| **Coqui XTTS v2** | Voice cloning AI model (free, open-source) |
| **Flask** | Python web server |
| **FFmpeg** | Audio format conversion |

---

## 🚀 Quick Setup

### Step 1: Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Windows:**
- Download from https://ffmpeg.org/download.html
- Add to your PATH

### Step 2: Install Python dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ First install of Coqui TTS may take a few minutes (~500MB).

### Step 3: Run the app

```bash
python app.py
```

### Step 4: Open in your browser

Visit: **http://localhost:5000**

> 📦 **First launch note:** XTTS v2 model (~2GB) will auto-download on first run. This only happens once — subsequent launches are instant.

---

## 🎯 Tips for Best Voice Cloning

| Tip | Why |
|-----|-----|
| Use **10–30 seconds** of audio | Enough context for the model |
| Use **clean audio** (no music/noise) | Reduces artifacts |
| **Single speaker** only | Multi-speaker confuses the model |
| **WAV format** works best | Lossless, no conversion needed |
| Speak naturally in the recording | Better prosody capture |

---

## 🌍 Supported Languages

English, Hindi, Spanish, French, German, Italian, Portuguese, Chinese (Mandarin), Japanese, Korean, Arabic, Turkish

---

## 📁 Project Structure

```
voice-clone-app/
├── app.py                 # Flask backend
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html         # Main UI
├── static/
│   ├── css/style.css      # Styling
│   ├── js/app.js          # Frontend logic
│   ├── uploads/           # Reference audio files
│   └── outputs/           # Generated audio files
└── README.md
```

---

## 🛠 Troubleshooting

**"TTS model not loaded"**
```bash
pip install TTS --upgrade
```

**"ffmpeg not found"**
- Make sure ffmpeg is installed and in your PATH

**Slow synthesis**
- CPU-only mode by default. If you have a CUDA GPU, the model will use it automatically for 5–10× speedup.

**Port already in use**
```bash
# Change port in app.py last line:
app.run(port=5001)
```

---

## 📜 License

- **Coqui TTS / XTTS v2**: Mozilla Public License 2.0
- **This application**: MIT License
