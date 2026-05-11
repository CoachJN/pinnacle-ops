import test from "node:test";
import assert from "node:assert/strict";
import { validateQuoteWorkflowPayload } from "@/components/work-orders/quote-workflow-validation";

test("quote workflow validation identifies the first invalid line item", () => {
  const result = validateQuoteWorkflowPayload([
    {
      description: "",
      quantity: 1,
      unitPrice: 25,
      lineTotal: 25,
    },
  ]);

  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /line 1: description is required/i);
});

test("quote workflow validation accepts valid quote payloads", () => {
  const result = validateQuoteWorkflowPayload([
    {
      description: "Labor",
      quantity: 2,
      unitPrice: 125,
      lineTotal: 250,
    },
  ]);

  assert.equal(result.ok, true);
});
