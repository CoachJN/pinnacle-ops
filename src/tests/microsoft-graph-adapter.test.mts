import assert from "node:assert/strict";
import test from "node:test";

import { MicrosoftGraphAdapter } from "../modules/providers/microsoft/graph-adapter.ts";

test("MicrosoftGraphAdapter normalizes Graph message payloads into canonical email structures", () => {
  const adapter = new MicrosoftGraphAdapter();
  const normalized = adapter.normalizeMessage({
    id: "graph-message-1",
    subject: "Freezer leak",
    body: {
      contentType: "html",
      content: "<div>Walk-in freezer leaking <b>water</b>.</div>",
    },
    bodyPreview: "Walk-in freezer leaking water.",
    conversationId: "conversation-1",
    conversationIndex: "AAE=",
    sentDateTime: "2026-05-06T10:00:00.000Z",
    receivedDateTime: "2026-05-06T10:01:00.000Z",
    internetMessageId: "<message-1@example.com>",
    inReplyTo: "<message-0@example.com>",
    internetMessageHeaders: [
      { name: "References", value: "<message-0@example.com> <message-1@example.com>" },
    ],
    from: {
      emailAddress: {
        address: "store101@example.com",
        name: "Store 101",
      },
    },
    toRecipients: [
      {
        emailAddress: {
          address: "dispatch@example.com",
          name: "Dispatch",
        },
      },
    ],
    ccRecipients: [
      {
        emailAddress: {
          address: "manager@example.com",
          name: "Manager",
        },
      },
    ],
    attachments: [
      {
        id: "attachment-1",
        name: "photo.jpg",
        contentType: "image/jpeg",
        size: 2048,
      },
    ],
  });

  assert.equal(normalized.emailMessage.subject, "Freezer leak");
  assert.equal(normalized.emailMessage.plainTextBody, "Walk-in freezer leaking water.");
  assert.equal(normalized.emailMessage.sender?.email, "store101@example.com");
  assert.equal(normalized.emailMessage.recipients[0]?.email, "dispatch@example.com");
  assert.equal(normalized.emailMessage.cc[0]?.email, "manager@example.com");
  assert.equal(normalized.emailMessage.internetMessageId, "<message-1@example.com>");
  assert.deepEqual(normalized.emailMessage.replyReferences, [
    "<message-0@example.com>",
    "<message-1@example.com>",
  ]);
  assert.equal(normalized.emailThread.providerThreadId, "conversation-1");
  assert.equal(normalized.emailThread.parentInternetMessageId, "<message-0@example.com>");
  assert.equal(normalized.emailMessage.attachments[0]?.providerAttachmentId, "attachment-1");
});
