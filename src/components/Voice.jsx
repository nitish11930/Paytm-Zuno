import React, { useState, useRef, useEffect } from "react";
import {
  LoaderCircle,
  Mic,
  Square,
  ArrowRight,
  Leaf,
  Volume2,
  Upload,
  Send,
} from "lucide-react";
import { api, money } from "../lib";
export default function Voice({
  t,
  lang,
  configured,
  scenario,
  onError,
  onReview,
  onAction,
  onEvidence,
}) {
  const [text, setText] = useState(""),
    [status, setStatus] = useState("ready"),
    [reply, setReply] = useState(null),
    [audioUrl, setAudioUrl] = useState("");
  const recorder = useRef(null),
    stream = useRef(null),
    timer = useRef(null),
    alive = useRef(true),
    controller = useRef(null),
    player = useRef(null),
    lastPlayer = useRef(null),
    topic = useRef(undefined),
    locking = useRef(false);
  useEffect(() => {
    const release = () => {
      clearTimeout(timer.current);
      controller.current?.abort();
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      if (lastPlayer.current) {
        lastPlayer.current.pause();
        lastPlayer.current.src = "";
      }
      locking.current = false;
    };
    const pause = () => {
      release();
      if (alive.current) setStatus("ready");
    };
    window.addEventListener("munim:native-pause", pause);
    return () => {
      alive.current = false;
      window.removeEventListener("munim:native-pause", pause);
      release();
    };
  }, []);
  async function playAnswer(answer) {
    if (!configured) return;
    setStatus("processing");
    controller.current = new AbortController();
    try {
      const r = await api("/voice/speak", {
        method: "POST",
        body: { text: answer, language: lang },
        signal: controller.current.signal,
      });
      if (!alive.current) return;
      const url = "data:audio/wav;base64," + r.audio;
      setAudioUrl(url);
      if (player.current) {
        player.current.src = url;
        try {
          await player.current.play();
          setStatus("speaking");
        } catch (e) {
          if (e.name !== "NotAllowedError") throw e;
          setStatus("ready");
        }
      }
    } catch (e) {
      if (alive.current) {
        onError(e.message);
        setStatus("ready");
      }
    }
  }
  async function analyze(utterance, autoSpeak = false) {
    setStatus("processing");
    controller.current = new AbortController();
    try {
      const result = await api("/voice/intent", {
        method: "POST",
        body: {
          text: utterance,
          language: lang,
          previousTopic: topic.current,
          scenario,
        },
        signal: controller.current.signal,
      });
      if (!alive.current) return;
      if (result.answer) {
        topic.current = result.type;
        setReply(result);
        setStatus("ready");
        if (autoSpeak) await playAnswer(result.answer);
      } else onReview({ ...result, transcript: utterance });
    } catch (e) {
      if (alive.current) {
        onError(e.message);
        setStatus("ready");
      }
    }
  }
  async function upload(blob) {
    if (blob.size > 5 * 1024 * 1024) {
      onError("AUDIO_TOO_LARGE");
      return;
    }
    setStatus("processing");
    const f = new FormData();
    f.append("audio", blob, "voice-note");
    f.append("language", lang);
    controller.current = new AbortController();
    try {
      const r = await api("/voice/transcribe", {
        method: "POST",
        body: f,
        signal: controller.current.signal,
      });
      if (!alive.current) return;
      setText(r.transcript);
      setReply(null);
      await analyze(r.transcript, true);
    } catch (e) {
      if (alive.current) {
        onError(e.message);
        setStatus("ready");
      }
    }
  }
  async function record() {
    if (status === "listening") {
      recorder.current?.stop();
      return;
    }
    if (locking.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError("VOICE_UNAVAILABLE");
      return;
    }
    locking.current = true;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!alive.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : undefined,
      );
      recorder.current = r;
      const chunks = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        clearTimeout(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        locking.current = false;
        if (alive.current)
          await upload(new Blob(chunks, { type: type || "audio/webm" }));
      };
      r.start();
      setStatus("listening");
      setReply(null);
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 25000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      locking.current = false;
      setStatus("ready");
      onError(
        e.name === "NotAllowedError"
          ? "MIC_PERMISSION_DENIED"
          : "VOICE_UNAVAILABLE",
      );
    }
  }
  return (
    <div className="voice-panel">
      <div
        className={
          "voice-record " + (status === "listening" ? "recording" : "")
        }
      >
        <div className="voice-orbits">
          <button
            className="record-button"
            disabled={!configured || !["ready", "listening"].includes(status)}
            onClick={record}
            aria-label={status === "listening" ? t("listening") : t("listen")}
          >
            {status === "processing" ? (
              <LoaderCircle size={35} className="spin" />
            ) : status === "listening" ? (
              <Square size={30} />
            ) : (
              <Mic size={38} />
            )}
          </button>
        </div>
        <strong aria-live="polite">
          {status === "processing"
            ? t("processing")
            : status === "listening"
              ? t("listening")
              : status === "speaking"
                ? t("speaking")
                : t("listen")}
        </strong>
        <div className={"waveform " + (status === "listening" ? "moving" : "")}>
          {Array.from({ length: 17 }, (_, i) => (
            <span
              key={i}
              style={{
                height: 8 + (Math.sin(i * 1.9) + 1) * 13,
                animationDelay: i * 0.07 + "s",
              }}
            />
          ))}
        </div>
      </div>
      {!configured && <p className="notice">{t("voiceOff")}</p>}
      <p className="microcopy">{t("voicePrivacy")}</p>
      <label className="voice-upload">
        <Upload size={17} />
        {t("uploadVoice")}
        <input
          type="file"
          aria-label={t("uploadVoice")}
          accept="audio/wav,audio/webm,audio/mp4,audio/ogg"
          disabled={!configured || status !== "ready"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </label>
      <label>
        {t("transcript")}
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReply(null);
          }}
          maxLength={1000}
          rows={3}
          placeholder={t("voiceExample")}
          disabled={status !== "ready"}
        />
      </label>
      <button
        className="primary"
        disabled={!text.trim() || status !== "ready"}
        onClick={() => analyze(text)}
      >
        {t("parse")}
        <ArrowRight size={18} />
      </button>
      {reply && (
        <div className="answer-card" aria-live="polite">
          <Leaf size={22} />
          <span className="badge">
            {t(
              reply.engine === "sarvam"
                ? "aiUnderstanding"
                : "localUnderstanding",
            )}
          </span>
          <p>{reply.answer}</p>
          {reply.evidence && (
            <details className="answer-evidence">
              <summary>{t("viewEvidence")}</summary>
              <p>
                {t("cash")}: {money(reply.evidence.cash)} · {t("pending")}:{" "}
                {money(reply.evidence.pending)}
              </p>
              {reply.evidence.drivers?.map((d) => (
                <p key={d.id}>
                  {d.label}: {money(d.amount)} · {d.date}
                </p>
              ))}
              <button className="text-button" onClick={onEvidence}>
                {t("planningInputs")}
                <ArrowRight size={16} />
              </button>
            </details>
          )}
          <div className="assistant-actions">
            <button
              className="secondary"
              disabled={!configured || status !== "ready"}
              onClick={() => playAnswer(reply.answer)}
            >
              <Volume2 size={18} />
              {t("hear")}
            </button>
            {reply.suggestedAction && (
              <button
                className="primary"
                disabled={status !== "ready"}
                onClick={onAction}
              >
                <Send size={18} />
                {t("reviewReminderAction")}
              </button>
            )}
          </div>
        </div>
      )}
      <audio
        ref={(el) => {
          player.current = el;
          if (el) lastPlayer.current = el;
        }}
        controls={!!audioUrl}
        className={audioUrl ? "reply-audio" : "hidden-audio"}
        onPlay={() => setStatus("speaking")}
        onPause={() => {
          if (alive.current) setStatus("ready");
        }}
        onEnded={() => {
          if (alive.current) setStatus("ready");
        }}
      />
    </div>
  );
}
