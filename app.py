import os
import uuid
import json
import time
import os
from flask import jsonify
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, render_template

app = Flask(__name__)

UPLOAD_FOLDER = Path("static/uploads")
OUTPUT_FOLDER = Path("static/outputs")
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"wav", "mp3", "ogg", "flac", "m4a", "webm"}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

tts_model = None
tts_available = False

def load_tts_model():
    global tts_model, tts_available
    try:
        from TTS.api import TTS
        print("Loading XTTS v2 model (this may take a minute on first run)...")
        tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
        tts_available = True
        print("✅ XTTS v2 model loaded successfully!")
    except ImportError:
        print("❌ Coqui TTS not installed. Run: pip install TTS")
        tts_available = False
    except Exception as e:
        print(f"❌ Error loading TTS model: {e}")
        tts_available = False

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/status")
def status():
    return jsonify({
        "tts_available": tts_available,
        "model": "XTTS v2" if tts_available else None,
        "message": "Ready for voice cloning!" if tts_available else "TTS model not loaded. See setup instructions."
    })

@app.route("/api/upload", methods=["POST"])
def upload_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    file = request.files["audio"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"reference_{uuid.uuid4().hex}.{ext}"
    filepath = UPLOAD_FOLDER / filename
    file.save(filepath)

    # Convert to wav if needed using ffmpeg
    wav_filename = filename.rsplit(".", 1)[0] + ".wav"
    wav_filepath = UPLOAD_FOLDER / wav_filename
    if ext != "wav":
        result = os.system(f'ffmpeg -y -i "{filepath}" -ar 22050 -ac 1 "{wav_filepath}" -loglevel quiet 2>/dev/null')
        if result == 0:
            os.remove(filepath)
            final_filename = wav_filename
        else:
            final_filename = filename
    else:
        # Still normalize the wav
        os.system(f'ffmpeg -y -i "{filepath}" -ar 22050 -ac 1 "{wav_filepath}" -loglevel quiet 2>/dev/null')
        if wav_filepath.exists():
            final_filename = wav_filename

    return jsonify({
        "success": True,
        "filename": final_filename,
        "path": f"/static/uploads/{final_filename}",
        "message": "Reference audio uploaded and processed successfully!"
    })

@app.route("/api/synthesize", methods=["POST"])
def synthesize():
    if not tts_available:
        return jsonify({"error": "TTS model not available. Please install Coqui TTS."}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    text = data.get("text", "").strip()
    reference_audio = data.get("reference_audio", "")
    language = data.get("language", "en")

    if not text:
        return jsonify({"error": "No text provided"}), 400
    if not reference_audio:
        return jsonify({"error": "No reference audio provided"}), 400
    if len(text) > 500:
        return jsonify({"error": "Text too long. Maximum 500 characters per synthesis."}), 400

    ref_path = UPLOAD_FOLDER / reference_audio
    if not ref_path.exists():
        return jsonify({"error": "Reference audio file not found"}), 404

    output_filename = f"output_{uuid.uuid4().hex}.wav"
    output_path = OUTPUT_FOLDER / output_filename

    try:
        start_time = time.time()
        tts_model.tts_to_file(
            text=text,
            speaker_wav=str(ref_path),
            language=language,
            file_path=str(output_path)
        )
        elapsed = round(time.time() - start_time, 2)

        return jsonify({
            "success": True,
            "output_filename": output_filename,
            "output_path": f"/static/outputs/{output_filename}",
            "text": text,
            "language": language,
            "synthesis_time": elapsed,
            "message": f"Audio synthesized in {elapsed}s"
        })
    except Exception as e:
        return jsonify({"error": f"Synthesis failed: {str(e)}"}), 500
        
@app.route("/list-voices", methods=["GET"])
def list_voices():
    files = []
    for file in os.listdir(UPLOAD_FOLDER):
        if file.endswith(".wav"):
            files.append(file)
    return jsonify(files)

@app.route("/api/outputs", methods=["GET"])
def list_outputs():
    outputs = []
    for f in sorted(OUTPUT_FOLDER.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.suffix == ".wav":
            meta_file = f.with_suffix(".json")
            meta = {}
            if meta_file.exists():
                with open(meta_file) as mf:
                    meta = json.load(mf)
            outputs.append({
                "filename": f.name,
                "path": f"/static/outputs/{f.name}",
                "created": f.stat().st_mtime,
                **meta
            })
    return jsonify(outputs)

@app.route("/api/delete/<filename>", methods=["DELETE"])
def delete_output(filename):
    filepath = OUTPUT_FOLDER / filename
    if filepath.exists():
        filepath.unlink()
        meta = filepath.with_suffix(".json")
        if meta.exists():
            meta.unlink()
        return jsonify({"success": True})
    return jsonify({"error": "File not found"}), 404

@app.route("/static/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/static/outputs/<path:filename>")
def serve_output(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

if __name__ == "__main__":
    load_tts_model()
    print("\n🎙️  Voice Clone Studio running at http://localhost:5000\n")
    app.run(debug=False, host="0.0.0.0", port=5000)
