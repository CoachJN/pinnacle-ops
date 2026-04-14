import type { SafeParseResult, UnknownRecord } from "@/lib/validation/common";
import { safeParse } from "@/lib/validation/common";
import { ValidationError } from "@/lib/utils/errors";

export interface ValidationSchema<TInput, TOutput> {
  parse(input: TInput): TOutput;
  safeParse(input: TInput): SafeParseResult<TOutput>;
}

export type InferSchemaInput<TSchema> =
  TSchema extends ValidationSchema<infer TInput, unknown> ? TInput : never;

export type InferSchemaOutput<TSchema> =
  TSchema extends ValidationSchema<unknown, infer TOutput> ? TOutput : never;

export function createValidationSchema<TInput, TOutput>(
  parser: (input: TInput) => TOutput,
): ValidationSchema<TInput, TOutput> {
  return {
    parse(input: TInput): TOutput {
      return parser(input);
    },
    safeParse(input: TInput): SafeParseResult<TOutput> {
      return safeParse(input, (value: unknown) => parser(value as TInput));
    },
  };
}

export function assertNoUnknownFields(
  payload: UnknownRecord,
  allowedFields: readonly string[],
  scope: string,
): void {
  const allowedFieldSet = new Set(allowedFields);
  const unknownFields = Object.keys(payload).filter(
    (field) => !allowedFieldSet.has(field),
  );

  if (unknownFields.length > 0) {
    throw new ValidationError(
      `${scope} contains unsupported field(s): ${unknownFields.join(", ")}.`,
    );
  }
}
