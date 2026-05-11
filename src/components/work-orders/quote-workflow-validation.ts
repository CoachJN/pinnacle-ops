interface QuoteLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuotePayloadValidationResult {
  ok: boolean;
  message?: string;
}

export function validateQuoteWorkflowPayload(
  items: QuoteLineItemInput[],
): QuotePayloadValidationResult {
  if (items.length < 1) {
    return {
      ok: false,
      message: "Add at least one line item before creating or submitting a quote.",
    };
  }

  for (const [index, item] of items.entries()) {
    const lineNumber = index + 1;
    if (!item.description.trim()) {
      return {
        ok: false,
        message: `Line ${lineNumber}: description is required.`,
      };
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return {
        ok: false,
        message: `Line ${lineNumber}: quantity must be greater than 0.`,
      };
    }

    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return {
        ok: false,
        message: `Line ${lineNumber}: unit price must be 0 or greater.`,
      };
    }

    const expectedLineTotal = roundMoney(item.quantity * item.unitPrice);
    if (roundMoney(item.lineTotal) !== expectedLineTotal) {
      return {
        ok: false,
        message: `Line ${lineNumber}: line total must equal quantity multiplied by unit price.`,
      };
    }
  }

  return { ok: true };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
