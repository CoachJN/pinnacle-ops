import { readEnv } from "@/config/env";

export const FEATURE_FLAGS = {
  enableFirebaseAuth: readFlag("NEXT_PUBLIC_ENABLE_FIREBASE_AUTH", false),
  enableContractorPortal: readFlag("NEXT_PUBLIC_ENABLE_CONTRACTOR_PORTAL", true),
  enableFinanceModule: readFlag("NEXT_PUBLIC_ENABLE_FINANCE_MODULE", true),
  enableWorkflowAutomation: readFlag(
    "NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION",
    false,
  ),
} as const;

function readFlag(name: string, fallback: boolean): boolean {
  const value = readEnv(name);

  if (!value) {
    return fallback;
  }

  return value === "true" || value === "1";
}

