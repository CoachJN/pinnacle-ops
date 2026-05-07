import type { DeliveryReceipt } from "./delivery-receipt";

export type TransportResult =
  | {
      outcome: "accepted" | "queued";
      message: string;
      providerType: string;
      providerEventType: string;
      rawStatus: string | null;
      receipt: DeliveryReceipt;
      metadata?: Record<string, unknown>;
    }
  | {
      outcome: "succeeded";
      message: string;
      receipt: DeliveryReceipt;
      metadata?: Record<string, unknown>;
    }
  | {
      outcome: "failed";
      message: string;
      retryable: boolean;
      failureCode: string;
      failureReason: string;
      receipt?: Partial<DeliveryReceipt>;
      metadata?: Record<string, unknown>;
    }
  | {
      outcome: "cancelled";
      message: string;
      cancellationReason: string;
      receipt?: Partial<DeliveryReceipt>;
      metadata?: Record<string, unknown>;
    }
  | {
      outcome: "suppressed";
      message: string;
      suppressionReason: string;
      receipt?: Partial<DeliveryReceipt>;
      metadata?: Record<string, unknown>;
    };
