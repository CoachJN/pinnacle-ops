import type {
  NormalizedEmailAddress,
  NormalizedEmailMessage,
  NormalizedEmailThread,
  ProviderAttachmentReference,
} from "@/modules/providers";

export interface MicrosoftGraphEmailAddress {
  address?: string | null;
  name?: string | null;
}

export interface MicrosoftGraphRecipient {
  emailAddress?: MicrosoftGraphEmailAddress | null;
}

export interface MicrosoftGraphBody {
  contentType?: "text" | "html" | string | null;
  content?: string | null;
}

export interface MicrosoftGraphItemBody {
  contentType?: "text" | "html" | string | null;
  content?: string | null;
}

export interface MicrosoftGraphAttachment {
  id?: string | null;
  contentId?: string | null;
  contentType?: string | null;
  isInline?: boolean | null;
  lastModifiedDateTime?: string | null;
  name?: string | null;
  size?: number | null;
}

export interface MicrosoftGraphMessage {
  id?: string | null;
  subject?: string | null;
  body?: MicrosoftGraphBody | null;
  bodyPreview?: string | null;
  conversationId?: string | null;
  conversationIndex?: string | null;
  createdDateTime?: string | null;
  sentDateTime?: string | null;
  receivedDateTime?: string | null;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  internetMessageHeaders?: Array<{
    name?: string | null;
    value?: string | null;
  }> | null;
  from?: MicrosoftGraphRecipient | null;
  sender?: MicrosoftGraphRecipient | null;
  toRecipients?: MicrosoftGraphRecipient[] | null;
  ccRecipients?: MicrosoftGraphRecipient[] | null;
  bccRecipients?: MicrosoftGraphRecipient[] | null;
  replyTo?: MicrosoftGraphRecipient[] | null;
  hasAttachments?: boolean | null;
  attachments?: MicrosoftGraphAttachment[] | null;
}

export interface NormalizeMicrosoftGraphMessageResult {
  emailMessage: NormalizedEmailMessage;
  emailThread: NormalizedEmailThread;
}

export class MicrosoftGraphAdapter {
  normalizeMessage(message: MicrosoftGraphMessage): NormalizeMicrosoftGraphMessageResult {
    const sender = toAddress(message.from ?? message.sender ?? null);
    const recipients = toAddresses(message.toRecipients);
    const cc = toAddresses(message.ccRecipients);
    const bcc = toAddresses(message.bccRecipients);
    const plainTextBody = toPlainText(message.body?.contentType, message.body?.content ?? "");
    const normalizedText = normalizeText(plainTextBody);
    const replyReferences = extractReferences(message.internetMessageHeaders ?? []);
    const attachments = (message.attachments ?? []).map(toAttachmentReference);
    const conversationPath = buildConversationPath(
      message.conversationId ?? null,
      message.id ?? null,
      message.internetMessageId ?? null,
      message.inReplyTo ?? null,
    );

    return {
      emailMessage: {
        subject: normalizeNullableText(message.subject),
        body: message.body?.content?.trim() || plainTextBody,
        plainTextBody,
        normalizedText,
        preview: normalizeNullableText(message.bodyPreview) ?? previewText(plainTextBody),
        sender,
        recipients,
        cc,
        bcc,
        messageId: normalizeNullableText(message.id),
        internetMessageId: normalizeNullableText(message.internetMessageId),
        conversationId: normalizeNullableText(message.conversationId),
        inReplyTo: normalizeNullableText(message.inReplyTo),
        replyReferences,
        receivedAt: normalizeDateTime(message.receivedDateTime, message.createdDateTime),
        sentAt: normalizeNullableDateTime(message.sentDateTime),
        attachments,
        metadata: {
          replyTo: toAddresses(message.replyTo),
          hasAttachments: Boolean(message.hasAttachments ?? attachments.length > 0),
        },
      },
      emailThread: {
        providerThreadId: normalizeNullableText(message.conversationId),
        providerConversationId: normalizeNullableText(message.conversationId),
        parentProviderMessageId: null,
        parentInternetMessageId: normalizeNullableText(message.inReplyTo),
        conversationIndex: normalizeNullableText(message.conversationIndex),
        conversationPath,
        threadFingerprint: buildThreadFingerprint(
          normalizeNullableText(message.conversationId),
          normalizeNullableText(message.subject),
          sender?.email ?? null,
        ),
        metadata: {},
      },
    };
  }
}

function toAddresses(
  recipients: readonly MicrosoftGraphRecipient[] | null | undefined,
): NormalizedEmailAddress[] {
  return (recipients ?? [])
    .map((recipient) => toAddress(recipient))
    .filter((recipient): recipient is NormalizedEmailAddress => recipient !== null);
}

function toAddress(
  recipient: MicrosoftGraphRecipient | null | undefined,
): NormalizedEmailAddress | null {
  const email = normalizeNullableText(recipient?.emailAddress?.address);
  const displayName = normalizeNullableText(recipient?.emailAddress?.name);
  if (!email && !displayName) {
    return null;
  }

  return {
    displayName,
    email,
    externalParticipantId: email,
    metadata: {},
  };
}

function toAttachmentReference(
  attachment: MicrosoftGraphAttachment,
): ProviderAttachmentReference {
  return {
    id: normalizeNullableText(attachment.id) ?? buildAttachmentIdentity(attachment),
    providerAttachmentId: normalizeNullableText(attachment.id),
    fileName: normalizeNullableText(attachment.name) ?? "attachment",
    mimeType: normalizeNullableText(attachment.contentType),
    sizeBytes: attachment.size ?? null,
    storagePath: null,
    contentId: normalizeNullableText(attachment.contentId),
    isInline: Boolean(attachment.isInline),
    uploadedAt: normalizeNullableDateTime(attachment.lastModifiedDateTime),
    checksum: null,
    hydrationStatus: "pending",
    hydratedAt: null,
    hydrationError: null,
    metadata: {},
  };
}

function buildAttachmentIdentity(attachment: MicrosoftGraphAttachment): string {
  return [
    normalizeNullableText(attachment.name) ?? "attachment",
    normalizeNullableText(attachment.contentType) ?? "unknown",
    String(attachment.size ?? 0),
  ].join(":");
}

function toPlainText(contentType: string | null | undefined, content: string): string {
  if (contentType?.toLowerCase() === "html") {
    return normalizeWhitespace(decodeHtml(stripHtml(content)));
  }
  return normalizeWhitespace(content);
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function normalizeText(input: string): string {
  return normalizeWhitespace(input).toLowerCase();
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function previewText(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function extractReferences(
  headers: readonly { name?: string | null; value?: string | null }[],
): string[] {
  const referencesHeader = headers.find((header) => header.name?.toLowerCase() === "references");
  if (!referencesHeader?.value) {
    return [];
  }

  return referencesHeader.value
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildConversationPath(
  conversationId: string | null,
  providerMessageId: string | null,
  internetMessageId: string | null,
  inReplyTo: string | null,
): string[] {
  return [conversationId, inReplyTo, internetMessageId, providerMessageId].filter(
    (value): value is string => Boolean(value?.trim()),
  );
}

function buildThreadFingerprint(
  conversationId: string | null,
  subject: string | null,
  senderEmail: string | null,
): string {
  return [conversationId ?? "no-conversation", subject ?? "no-subject", senderEmail ?? "no-sender"]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function normalizeDateTime(primary: string | null | undefined, fallback: string | null | undefined): string {
  return primary?.trim() || fallback?.trim() || new Date(0).toISOString();
}

function normalizeNullableDateTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
