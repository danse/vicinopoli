import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";

import {
  ApiError,
  createPost,
  presignMedia,
  registerMedia,
  type PostScope,
  uploadPhotoToUrl,
  updateMe,
} from "@/api/client";
import { Button } from "@/components/ui/button";
import { hashAddress } from "@/lib/utils";

interface ComposerProps {
  address: string;
  onAddressChange: (address: string) => void;
  pseudonym: string;
  onPseudonymChange: (pseudonym: string) => void;
  onPosted: () => void;
}

const SCOPE_OPTIONS: PostScope[] = ["building", "500m", "1km", "5km"];

function scopeLabel(scope: PostScope): string {
  const key: Record<PostScope, string> = {
    building: "composer.scopeBuilding",
    "500m": "composer.scope500m",
    "1km": "composer.scope1km",
    "5km": "composer.scope5km",
  };
  return key[scope];
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;

interface Recording {
  blob: Blob;
  duration_s: number;
}

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
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

export function Composer({
  address,
  onAddressChange,
  pseudonym,
  onPseudonymChange,
  onPosted,
}: ComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<PostScope>("1km");
  const [photo, setPhoto] = useState<File | null>(null);
  const [voice, setVoice] = useState<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const tracksRef = useRef<MediaStreamTrack[]>([]);
  const startTimeRef = useRef<number>(0);

  const canSubmit =
    address.trim() !== "" && body.trim() !== "" && !submitting;

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
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
      if (pseudonym.trim() !== "") {
        await updateMe({ pseudonym: pseudonym.trim() });
      }

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

      await createPost({
        address: address.trim(),
        body: body.trim(),
        scope,
        media_ids: mediaIds,
      });
      setBody("");
      setPhoto(null);
      setVoice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onPosted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAddressError(true);
        Sentry.captureException(err, {
          extra: { addressHash: await hashAddress(address) },
        });
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
      <div className="grid gap-2">
        <label
          htmlFor="composer-address"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.addressLabel")}
        </label>
        <input
          id="composer-address"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={address}
          placeholder={t("composer.addressPlaceholder")}
          onChange={(e) => onAddressChange(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-pseudonym"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.pseudonymLabel")}
        </label>
        <input
          id="composer-pseudonym"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={pseudonym}
          placeholder={t("composer.pseudonymPlaceholder")}
          onChange={(e) => onPseudonymChange(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-message"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.messageLabel")}
        </label>
        <textarea
          id="composer-message"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={body}
          placeholder={t("composer.messagePlaceholder")}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("composer.scopeLabel")}
        </span>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((option) => (
            <label
              key={option}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm text-foreground has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="scope"
                value={option}
                checked={scope === option}
                onChange={() => setScope(option)}
                className="h-4 w-4"
              />
              {t(scopeLabel(option))}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-photo"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.photoLabel")}
        </label>
        <input
          id="composer-photo"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" variant="outline" onClick={stopRecording}>
            {t("composer.voiceStop")}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={startRecording}>
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
            {t("composer.voiceReady", { duration: voice.duration_s.toFixed(1) })}
          </span>
        )}
        {recordingError && (
          <span className="text-sm text-destructive">
            {t("composer.voiceError")}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive">{t("composer.error")}</p>
      )}
      {addressError && (
        <p className="mt-2 text-sm text-destructive">
          {t("composer.addressNotFound")}
        </p>
      )}
      <Button className="mt-4" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? t("composer.publishing") : t("composer.publish")}
      </Button>
    </section>
  );
}