"""Local prototype only: encrypted speaker template, no raw audio persistence.
JSON-lines over parent-process pipes; no listening network port.
Speaker similarity is not liveness or production authentication.
"""
import base64
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "privacy" / "voiceprints"
STORE.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(STORE, 0o700)
MODEL = None
THRESHOLD = float(os.getenv("OWNER_VOICE_THRESHOLD", "0.70"))
if not 0.5 <= THRESHOLD <= 0.95:
    raise ValueError("Invalid prototype threshold")


def key():
    path = STORE / "encryption.key"
    if not path.exists():
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(secrets.token_bytes(32))
    return path.read_bytes()


def profile(merchant):
    return STORE / (hashlib.sha256(merchant.encode()).hexdigest() + ".enc")


def embedding(audio, enrolling=False):
    global MODEL
    import imageio_ffmpeg
    import numpy as np
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    with tempfile.TemporaryDirectory(prefix="zuno-audio-") as folder:
        source = Path(folder) / "input.audio"
        source.write_bytes(audio)
        os.chmod(source, 0o600)
        result = subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-nostdin",
            "-i", str(source), "-t", "26", "-ac", "1", "-ar", "16000",
            "-f", "f32le", "pipe:1",
        ], capture_output=True, timeout=20, check=False)
        if result.returncode:
            raise ValueError("AUDIO_DECODE_FAILED")
        values = np.frombuffer(result.stdout, dtype="<f4").copy()
    duration = len(values) / 16000
    if duration < (10 if enrolling else 1) or duration > 25.5:
        raise ValueError("VOICE_SAMPLE_DURATION")
    frames = values[:len(values)//1600*1600].reshape(-1, 1600)
    active = int((np.sqrt(np.mean(frames**2, axis=1)) > 0.008).sum()) / 10
    if not np.isfinite(values).all() or active < (4 if enrolling else 0.6):
        raise ValueError("VOICE_SAMPLE_TOO_QUIET")
    if MODEL is None:
        with contextlib.redirect_stdout(sys.stderr):
            MODEL = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=str(ROOT / "privacy" / "voice-model"),
                run_opts={"device": "cpu"},
            )
    torch.set_num_threads(2)
    with torch.inference_mode(), contextlib.redirect_stdout(sys.stderr):
        vector = MODEL.encode_batch(torch.from_numpy(values).unsqueeze(0)).flatten()
        vector = torch.nn.functional.normalize(vector, dim=0)
    return vector.numpy(), duration


def handle(message):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import numpy as np
    path = profile(message["merchant"])
    operation = message["operation"]
    if operation == "status":
        return {"enrolled": path.exists(), "prototype": True, "liveness": False}
    if operation == "delete":
        path.unlink(missing_ok=True)
        return {"enrolled": False}
    audio = base64.b64decode(message["audio"], validate=True)
    if len(audio) > 5 * 1024 * 1024:
        raise ValueError("AUDIO_TOO_LARGE")
    if operation == "enroll":
        if path.exists():
            raise ValueError("OWNER_ALREADY_ENROLLED")
        vector, duration = embedding(audio, True)
        nonce = secrets.token_bytes(12)
        ciphertext = AESGCM(key()).encrypt(nonce, vector.astype("<f4").tobytes(), message["merchant"].encode())
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(nonce + ciphertext)
        return {"enrolled": True, "prototype": True, "duration": duration}
    if operation != "verify" or not path.exists():
        raise ValueError("OWNER_VOICE_NOT_CONFIGURED")
    vector, duration = embedding(audio)
    encrypted = path.read_bytes()
    reference = np.frombuffer(AESGCM(key()).decrypt(encrypted[:12], encrypted[12:], message["merchant"].encode()), dtype="<f4")
    score = float(np.dot(vector, reference))
    if not np.isfinite(score) or score < THRESHOLD:
        raise ValueError("OWNER_VOICE_MISMATCH")
    return {"verified": True, "prototype": True, "liveness": False}


if __name__ == "__main__":
    for line in sys.stdin:
        try:
            message = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr):
                result = handle(message)
            response = {"id": message["id"], "result": result}
        except Exception as error:
            safe = str(error)
            if safe not in {"AUDIO_TOO_LARGE", "AUDIO_DECODE_FAILED", "VOICE_SAMPLE_DURATION", "VOICE_SAMPLE_TOO_QUIET", "OWNER_ALREADY_ENROLLED", "OWNER_VOICE_NOT_CONFIGURED", "OWNER_VOICE_MISMATCH"}:
                safe = "OWNER_VOICE_UNAVAILABLE"
            response = {"id": message.get("id") if isinstance(message, dict) else None, "error": safe}
        print(json.dumps(response), flush=True)
