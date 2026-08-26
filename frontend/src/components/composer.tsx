import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import { Link } from "react-router-dom";

import {
  ApiError,
  createPost,
  presignMedia,
  registerMedia,
  sendAnalyticsEvents,
  type PostVoice,
  uploadPhotoToUrl,
} from "@/api/client";
import {
  EMPTY_DRAFT,
  useApp,
  type ComposerDraft,
  type ComposerMessageType,
} from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { hashAddress } from "@/lib/utils";
import { QuotaHelpModal } from "@/components/quota-help-modal";

interface ComposerProps {
  address: string;
  pseudonym: string;
  onPosted: () => void;
}

type MessageType = ComposerMessageType;

const MESSAGE_TYPE_OPTIONS: MessageType[] = ["text", "photo", "voice"];

function messageTypeLabel(type: MessageType): string {
  const key: Record<MessageType, string> = {
    text: "composer.typeText",
    photo: "composer.typePhoto",
    voice: "composer.typeVoice",
  };
  return key[type];
}

const VOICE_OPTIONS: PostVoice[] = ["street", "some", "area", "city"];

function voiceLabel(voice: PostVoice): string {
  const key: Record<PostVoice, string> = {
    street: "composer.voiceStreet",
    some: "composer.voiceSome",
    area: "composer.voiceArea",
    city: "composer.voiceCity",
  };
  return key[voice];
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

interface Recording {
  blob: Blob;
  duration_s: number;
}

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("resize failed");
  return blob;
}

export function Composer({ address, pseudonym, onPosted }: ComposerProps) {
  const { t } = useTranslation();
  const { postsLeftToday, refreshDevice, analyticsConsented, draft, setDraft } =
    useApp();
  const [type, setType] = useState<MessageType>(draft.type);
  const [body, setBody] = useState(draft.body);
  const [scope, setScope] = useState<PostVoice>(draft.scope);
  const [photo, setPhoto] = useState<File | null>(draft.photo);
  const [voice, setVoice] = useState<Recording | null>(draft.voice);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [quotaHelpOpen, setQuotaHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const tracksRef = useRef<MediaStreamTrack[]>([]);
  const startTimeRef = useRef<number>(0);

  let canSubmit = address.trim() !== "" && !submitting;
  if (type === "text") {
    canSubmit = canSubmit && body.trim() !== "";
  } else if (type === "photo") {
    canSubmit = canSubmit && photo !== null;
  } else {
    canSubmit = canSubmit && voice !== null;
  }

  const updateDraft = (patch: Partial<ComposerDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    updateDraft({ photo: file });
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    updateDraft({ body: value });
  };

  const startRecording = async () => {
    setRecordingError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracksRef.current = stream.getTracks();
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const duration_s = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setVoice({ blob, duration_s });
        updateDraft({ voice: { blob, duration_s } });
        tracksRef.current.forEach((track) => track.stop());
      };
      startTimeRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch {
      setRecordingError(true);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
    recorderRef.current = null;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(false);
    setAddressError(false);
    try {
      const mediaIds: string[] = [];
      if (photo) {
        const resized = await resizeImage(photo);
        const presigned = await presignMedia({
          kind: "image",
          content_type: "image/jpeg",
          size: resized.size,
          filename: photo.name,
        });
        await uploadPhotoToUrl(presigned.url, resized, "image/jpeg");
        const registered = await registerMedia({
          kind: "image",
          object_key: presigned.object_key,
          content_type: "image/jpeg",
          size: resized.size,
        });
        mediaIds.push(registered.id);
      }
      if (voice) {
        const presigned = await presignMedia({
          kind: "voice",
          content_type: "audio/webm",
          size: voice.blob.size,
        });
        await uploadPhotoToUrl(presigned.url, voice.blob, "audio/webm");
        const registered = await registerMedia({
          kind: "voice",
          object_key: presigned.object_key,
          content_type: "audio/webm",
          size: voice.blob.size,
          duration_s: voice.duration_s,
        });
        mediaIds.push(registered.id);
      }

      const created = await createPost({
        address: address.trim(),
        body: body.trim(),
        voice: scope,
        media_ids: mediaIds,
      });
      if (analyticsConsented) {
        void sendAnalyticsEvents([
          {
            name: "post_created",
            post_id: created.id,
            geohash: created.location.geohash,
          },
        ]);
      }
      setBody("");
      setPhoto(null);
      setVoice(null);
      setDraft(EMPTY_DRAFT);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refreshDevice();
      onPosted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAddressError(true);
        Sentry.captureException(err, {
          extra: { addressHash: await hashAddress(address) },
        });
      } else if (
        err instanceof ApiError &&
        err.status === 429 &&
        typeof err.detail === "object" &&
        err.detail !== null &&
        "code" in err.detail &&
        err.detail.code === "daily_quota_exceeded"
      ) {
        setQuotaExhausted(true);
        refreshDevice();
      } else {
        Sentry.captureException(err);
        setError(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label={t("composer.feedTitle")}>
      <div className="mt-4 flex items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground">
        <span>
          {t("composer.postingAs")}{" "}
          <strong>{pseudonym.trim() !== "" ? pseudonym : t("composer.anonymous")}</strong>
        </span>
        <Link
          to="/pseudonym"
          data-testid="composer-change-pseudonym"
          className="text-sm text-primary hover:underline"
        >
          {t("composer.changePseudonym")}
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("composer.typeLabel")}
        </span>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {MESSAGE_TYPE_OPTIONS.map((option) => (
            <label
              key={option}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm text-foreground has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="message-type"
                data-testid={`composer-type-${option}`}
                value={option}
                checked={type === option}
                onChange={() => {
                  setType(option);
                  updateDraft({ type: option });
                }}
                className="h-4 w-4"
              />
              {t(messageTypeLabel(option))}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {type === "text" ? (
          <>
            <label
              htmlFor="composer-message"
              className="text-sm font-medium text-foreground"
            >
              {t("composer.messageLabel")}
            </label>
            <textarea
              id="composer-message"
              data-testid="composer-message"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              placeholder={t("composer.messagePlaceholder")}
              onChange={(e) => handleBodyChange(e.target.value)}
            />
          </>
        ) : (
          <>
            <label
              htmlFor="composer-caption"
              className="text-sm font-medium text-foreground"
            >
              {t("composer.captionLabel")}
            </label>
            <input
              id="composer-caption"
              data-testid="composer-caption"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              placeholder={t("composer.captionPlaceholder")}
              onChange={(e) => handleBodyChange(e.target.value)}
            />
          </>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("composer.scopeLabel")}
        </span>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {VOICE_OPTIONS.map((option) => (
            <label
              key={option}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm text-foreground has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="scope"
                data-testid={`composer-voice-${option}`}
                value={option}
                checked={scope === option}
                onChange={() => {
                  setScope(option);
                  updateDraft({ scope: option });
                }}
                className="h-4 w-4"
              />
              {t(voiceLabel(option))}
            </label>
          ))}
        </div>
      </div>
      {type === "photo" && (
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-photo"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.photoLabel")}
        </label>
        <input
          id="composer-photo"
          data-testid="composer-photo"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
        />
      </div>
      )}
      {type === "voice" && (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {recording ? (
          <Button
            type="button"
            variant="outline"
            data-testid="composer-voice-stop"
            onClick={stopRecording}
          >
            {t("composer.voiceStop")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            data-testid="composer-voice-start"
            onClick={startRecording}
          >
            {t("composer.voiceLabel")}
          </Button>
        )}
        {recording && (
          <span className="text-sm text-muted-foreground">
            {t("composer.voiceRecording")}
          </span>
        )}
        {!recording && voice && (
          <span className="text-sm text-muted-foreground">
            {t("composer.voiceReady", {
              duration: voice.duration_s.toFixed(1),
            })}
          </span>
        )}
        {recordingError && (
          <span className="text-sm text-destructive">
            {t("composer.voiceError")}
          </span>
        )}
      </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive">{t("composer.error")}</p>
      )}
      {addressError && (
        <p className="mt-2 text-sm text-destructive">
          {t("composer.addressNotFound")}
        </p>
      )}
      {quotaExhausted && (
        <p className="mt-2 text-sm text-destructive">
          {t("composer.quotaExhausted")}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-4">
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? t("composer.publishing") : t("composer.publish")}
        </Button>
        {postsLeftToday !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>
              {t("composer.quotaRemaining", { count: postsLeftToday })}
            </span>
            <button
              type="button"
              data-testid="composer-quota-help"
              className="text-primary hover:underline"
              onClick={() => setQuotaHelpOpen(true)}
            >
              {t("composer.quotaHelpLabel")}
            </button>
          </div>
        )}
      </div>
      <QuotaHelpModal
        open={quotaHelpOpen}
        onClose={() => setQuotaHelpOpen(false)}
      />
    </section>
  );
}
