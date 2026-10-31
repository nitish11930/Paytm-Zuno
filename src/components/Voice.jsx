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
  onSaved,
}) {
  const [ledgerMode, setLedgerMode] = useState(true),
    [ledger, setLedger] = useState(null),
    [pendingTurn, setPendingTurn] = useState(null),
    [owner, setOwner] = useState(null),
    [enrolling, setEnrolling] = useState(false),
    [consent, setConsent] = useState(false);
  const pendingAudio = useRef(null);
  const ledgerRef = useRef(null);
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
    alive.current = true;
    api("/voice/owner")
      .then((r) => {
        if (alive.current) setOwner(r);
      })
      .catch(() => {});
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
      if (pendingAudio.current) {
        await upload(pendingAudio.current.blob);
        return;
      }
      const turn = ledgerMode
        ? pendingTurn || {
            text: utterance,
            language: lang,
            requestKey: crypto.randomUUID(),
            ...(ledgerRef.current
              ? {
                  draftId: ledgerRef.current.draftId,
                  version: ledgerRef.current.version,
                }
              : {}),
          }
        : null;
      if (turn) setPendingTurn(turn);
      const result = ledgerMode
        ? await api("/voice/ledger", {
            method: "POST",
            body: turn,
            signal: controller.current.signal,
          })
        : await api("/voice/intent", {
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
      if (ledgerMode) {
        ledgerRef.current = result;
        setLedger(result);
        setPendingTurn(null);
        setText("");
        if (result.stage === "saved") await onSaved?.();
      }
      if (result.answer) {
        topic.current = result.type;
        setReply(result);
        setStatus("ready");
        if (autoSpeak) await playAnswer(result.answer);
      } else onReview({ ...result, transcript: utterance });
    } catch (e) {
      if (alive.current) {
        if (e.status && e.status < 500 && e.status !== 429)
          setPendingTurn(null);
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
    let endpoint = "/voice/transcribe";
    if (ledgerMode) {
      if (enrolling) {
        endpoint = "/voice/owner/enroll";
        f.append("consent", String(consent));
      } else {
        endpoint = "/voice/ledger/audio";
        if (!pendingAudio.current)
          pendingAudio.current = {
            blob,
            requestKey: crypto.randomUUID(),
            draftId: ledgerRef.current?.draftId,
            version: ledgerRef.current?.version,
            language: lang,
          };
        const turn = pendingAudio.current;
        f.set("language", turn.language);
        f.append("requestKey", turn.requestKey);
        if (turn.draftId) {
          f.append("draftId", turn.draftId);
          f.append("version", String(turn.version));
        }
        setPendingTurn({ audio: true });
      }
    }
    controller.current = new AbortController();
    try {
      const r = await api(endpoint, {
        method: "POST",
        body: f,
        signal: controller.current.signal,
      });
      if (!alive.current) return;
      if (ledgerMode && enrolling) {
        setOwner(r);
        setEnrolling(false);
        setConsent(false);
        setStatus("ready");
        return;
      }
      if (ledgerMode) {
        ledgerRef.current = r;
        setLedger(r);
        setPendingTurn(null);
        pendingAudio.current = null;
        setText(r.transcript || "");
        setReply(r);
        setStatus("ready");
        if (r.stage === "saved") await onSaved?.();
        await playAnswer(r.answer);
      } else {
        setText(r.transcript);
        setReply(null);
        await analyze(r.transcript, true);
      }
    } catch (e) {
      if (alive.current) {
        if (e.status && e.status < 500 && e.status !== 429) {
          pendingAudio.current = null;
          setPendingTurn(null);
        }
        if (enrolling)
          api("/voice/owner")
            .then(setOwner)
            .catch(() => {});
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
      <div className="filters">
        <button
          disabled={status !== "ready" || !!pendingTurn}
          className={ledgerMode ? "active" : ""}
          onClick={() => {
            setLedgerMode(true);
            setReply(null);
          }}
        >
          {t("voiceLedger")}
        </button>
        <button
          disabled={status !== "ready" || !!pendingTurn}
          className={!ledgerMode ? "active" : ""}
          onClick={() => {
            setLedgerMode(false);
            setReply(null);
          }}
        >
          {t("businessQuestions")}
        </button>
      </div>
      {ledgerMode && (
        <p className="notice">
          {t(owner?.enrolled ? "ownerVoicePrototype" : "ownerVoicePending")}
        </p>
      )}
      {ledgerMode && owner?.enrolled && (
        <button
          className="text-button"
          disabled={status !== "ready" || !!pendingTurn}
          onClick={async () => {
            if (!window.confirm(t("removeOwnerVoiceConfirm"))) return;
            try {
              setOwner(
                await api("/voice/owner/delete", {
                  method: "POST",
                  body: { confirm: true },
                }),
              );
            } catch (e) {
              onError(e.message);
            }
          }}
        >
          {t("removeOwnerVoice")}
        </button>
      )}
      {ledgerMode && !owner?.enrolled && (
        <div className="notice owner-enrollment">
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={status !== "ready"}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (!e.target.checked) setEnrolling(false);
              }}
            />
            {t("ownerVoiceConsent")}
          </label>
          <button
            className="secondary"
            disabled={!consent || status !== "ready"}
            onClick={() => setEnrolling(true)}
          >
            {t("enrollOwnerVoice")}
          </button>
          {enrolling && <p>{t("ownerEnrollmentGuide")}</p>}
        </div>
      )}
      {ledgerMode && ledger && (
        <div className="notice" aria-live="polite">
          {ledger.draft.name || "—"} ·{" "}
          {ledger.draft.amount ? money(ledger.draft.amount) : "—"} ·{" "}
          {ledger.stage === "saved" ? t("saved") : t("draftOnly")}
        </div>
      )}
      {ledgerMode && ledger?.stage === "manual" && (
        <button className="secondary" onClick={() => onReview(ledger.draft)}>
          {t("correct")}
        </button>
      )}
      {ledgerMode && pendingTurn && status === "ready" && (
        <p className="notice">{t("retryVoiceTurn")}</p>
      )}
      {ledgerMode && ledger && !pendingTurn && (
        <button
          className="secondary"
          disabled={status !== "ready"}
          onClick={() => {
            ledgerRef.current = null;
            setLedger(null);
            setReply(null);
            setText("");
          }}
        >
          {t("newVoiceEntry")}
        </button>
      )}

      <div
        className={
          "voice-record " + (status === "listening" ? "recording" : "")
        }
      >
        <div className="voice-orbits">
          <button
            className="record-button"
            disabled={
              (ledgerMode && !(owner?.enrolled || (enrolling && consent))) ||
              (!configured && !enrolling) ||
              !["ready", "listening"].includes(status) ||
              (!!pendingTurn && status !== "listening") ||
              (ledgerMode && ["saved", "cancelled"].includes(ledger?.stage))
            }
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
          disabled={
            (ledgerMode && !owner?.enrolled) ||
            !configured ||
            status !== "ready" ||
            !!pendingTurn
          }
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
          disabled={
            status !== "ready" ||
            !!pendingTurn ||
            (ledgerMode && ["saved", "cancelled"].includes(ledger?.stage))
          }
        />
      </label>
      <button
        className="primary"
        disabled={
          (!text.trim() && !pendingTurn) ||
          status !== "ready" ||
          (ledgerMode && ["saved", "cancelled"].includes(ledger?.stage))
        }
        onClick={() => analyze(text)}
      >
        {pendingTurn && status === "ready" ? t("retry") : t("parse")}
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
