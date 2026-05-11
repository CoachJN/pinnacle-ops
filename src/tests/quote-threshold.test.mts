import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCurrencyThresholdInput,
  parseQuoteThresholdDollarsToCents,
} from "@/components/work-orders/create/quote-threshold";

test("quote threshold accepts dollars and cents input", () => {
  assert.equal(isValidCurrencyThresholdInput("250.00"), true);
  assert.equal(parseQuoteThresholdDollarsToCents("250.00"), 25000);
  assert.equal(parseQuoteThresholdDollarsToCents("250"), 25000);
  assert.equal(parseQuoteThresholdDollarsToCents("0.99"), 99);
});

test("quote threshold rejects invalid currency precision", () => {
  assert.equal(isValidCurrencyThresholdInput("12.345"), false);
  assert.equal(parseQuoteThresholdDollarsToCents("12.345"), undefined);
});
