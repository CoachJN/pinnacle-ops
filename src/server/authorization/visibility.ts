import "server-only";

// Keep `src/server/authorization` as the runtime entry point while projection
// ownership finishes moving out of transitional `lib/` helpers.
export {
  canReadClientSellPrice,
  canReadContractorRawPricing,
  canReadFinancialLayer,
  canReadMarginMarkup,
  canReadUserProfile,
  exposeActivityLogs,
  exposeAssignments,
  exposeBillingRecords,
  exposeClientOrganization,
  exposeClientQuotes,
  exposeContractorOrganizations,
  exposeContractorQuotes,
  exposeInternalNotes,
  exposeInvoices,
  exposeLocation,
  exposeMarginMarkup,
  exposePaymentStatus,
  exposeUsersWithinScope,
  exposeWorkOrder,
  exposeWorkOrderDataBundle,
  exposeWorkOrderHistory,
  type VisibleAssignment,
  type VisibleClientQuote,
  type VisibleContractorQuote,
  type VisibleInvoice,
  type VisibleWorkOrder,
  type VisibleWorkOrderDataBundle,
  type WorkOrderDataVisibilityBundle,
} from "@/lib/data-visibility";
