import base64
import io
import wave
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location("owner_worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class VoiceStorageTests(unittest.TestCase):
    def test_real_decoder_rejects_short_and_silent_audio(self):
        def silence(seconds):
            output=io.BytesIO()
            with wave.open(output,"wb") as wav:
                wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000)
                wav.writeframes(b"\x00\x00"*int(seconds*16000))
            return output.getvalue()
        with self.assertRaisesRegex(ValueError,"VOICE_SAMPLE_DURATION"):
            worker.embedding(silence(0.4))
        with self.assertRaisesRegex(ValueError,"VOICE_SAMPLE_TOO_QUIET"):
            worker.embedding(silence(3))

    def test_encrypted_profile_isolation_match_mismatch_and_tamper(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(worker, "STORE", Path(folder)):
            sample = {"merchant": "one", "audio": base64.b64encode(b"sample").decode()}
            with patch.object(worker, "embedding", return_value=(np.array([1., 0.], dtype=np.float32), 12.)):
                result = worker.handle({**sample, "operation": "enroll"})
                self.assertTrue(result["enrolled"])
                self.assertFalse(worker.handle({"merchant": "two", "operation": "status"})["enrolled"])
                self.assertTrue(worker.handle({**sample, "operation": "verify"})["verified"])
                raw = worker.profile("one").read_bytes()
                self.assertNotIn(b"sample", raw)
                self.assertEqual(worker.profile("one").stat().st_mode & 0o777, 0o600)
                with self.assertRaisesRegex(ValueError, "OWNER_ALREADY_ENROLLED"):
                    worker.handle({**sample, "operation": "enroll"})
            with patch.object(worker, "embedding", return_value=(np.array([0., 1.], dtype=np.float32), 12.)):
                with self.assertRaisesRegex(ValueError, "OWNER_VOICE_MISMATCH"):
                    worker.handle({**sample, "operation": "verify"})
            worker.profile("one").write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
            with patch.object(worker, "embedding", return_value=(np.array([1., 0.], dtype=np.float32), 12.)):
                with self.assertRaises(Exception):
                    worker.handle({**sample, "operation": "verify"})


if __name__ == "__main__":
    unittest.main()
