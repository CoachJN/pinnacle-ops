import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { getFirebaseAdminStorage } from "@/server/firebase";

const ATTACHMENT_URL_TTL_MS = 5 * 60 * 1000;

export async function createWorkOrderAttachmentReadUrl(input: {
  fileName: string;
  storagePath: string;
}): Promise<string> {
  const storagePath = input.storagePath.trim();
  if (!storagePath) {
    throw new AppError({
      code: ERROR_CODES.ValidationFailed,
      message: "Attachment storage path is required.",
    });
  }

  try {
    const bucket = getFirebaseAdminStorage().bucket();
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + ATTACHMENT_URL_TTL_MS,
      version: "v4",
      responseDisposition: buildAttachmentDisposition(input.fileName),
    });

    return signedUrl;
  } catch (error) {
    throw new AppError({
      code: ERROR_CODES.ExternalServiceUnavailable,
      message: "Unable to create an attachment access URL.",
      cause: error,
      safeMessage: "Attachment access is temporarily unavailable.",
    });
  }
}

function buildAttachmentDisposition(fileName: string): string {
  const escapedFileName = fileName.trim().replace(/"/g, "");
  return `attachment; filename="${escapedFileName || "attachment"}"`;
}
