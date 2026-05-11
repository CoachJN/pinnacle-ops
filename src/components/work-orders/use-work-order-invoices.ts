"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientInvoice } from "@/types/invoice";

interface InvoiceListResponse {
  invoices?: ClientInvoice[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function useWorkOrderInvoices(workOrderId: string) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshInvoices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/invoices`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as InvoiceListResponse | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          (payload as ApiErrorResponse).error?.message ?? "Unable to load invoice history.",
        );
      }

      setInvoices((payload as InvoiceListResponse).invoices ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load invoice history.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    void refreshInvoices();
  }, [refreshInvoices]);

  return {
    errorMessage,
    invoices,
    isLoading,
    refreshInvoices,
    setInvoices,
  };
}
