export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Keep this in sync with the Cloud Function's supported extensions/encodings.
export const ALLOWED_AUDIO_MIME_TYPES = new Set<string>([
  "audio/mpeg", // .mp3
  "audio/wav", // .wav
  "audio/x-wav",
  "audio/mp4", // often used for .m4a
  "audio/aac",
  "audio/3gpp",
  "audio/ogg", // .ogg (opus)
  "audio/webm", // .webm (opus)
]);

export const UI_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".webm"] as const;
