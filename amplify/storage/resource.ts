import { defineStorage } from "@aws-amplify/backend";

/**
 * Amplify Storage (S3) configuration
 * Task 1: Audio file storage for veterinary voice recordings
 */
export const storage = defineStorage({
  name: "vetVoiceAudio",
  access: (allow) => ({
    // Authenticated users can upload/read/delete their audio files
    "audio/*": [
      allow.authenticated.to(["read", "write", "delete"]),
    ],
    // Transcribe output (Lambda writes, authenticated users read)
    "transcripts/*": [
      allow.authenticated.to(["read", "write", "delete"]),
    ],
  }),
});
