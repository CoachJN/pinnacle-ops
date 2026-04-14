import { USER_ROLES, type UserRole } from "@/types/permissions";

export const QUOTE_CONTROL_ACTIONS = {
  View: "view",
  Create: "create",
  Edit: "edit",
  Submit: "submit",
  Approve: "approve",
  Reject: "reject",
  Revise: "revise",
  Reopen: "reopen",
} as const;

export type QuoteControlAction =
  (typeof QUOTE_CONTROL_ACTIONS)[keyof typeof QUOTE_CONTROL_ACTIONS];

export const INVOICE_CONTROL_ACTIONS = {
  View: "view",
  Draft: "draft",
  IssueSend: "issue_send",
  MarkPaid: "mark_paid",
  MarkOverdue: "mark_overdue",
  Dispute: "dispute",
  Resolve: "resolve",
  Edit: "edit",
  Reopen: "reopen",
} as const;

export type InvoiceControlAction =
  (typeof INVOICE_CONTROL_ACTIONS)[keyof typeof INVOICE_CONTROL_ACTIONS];

export const FINANCIAL_VISIBILITY_LAYERS = {
  ContractorRawPricing: "contractor_raw_pricing",
  ClientSellPrice: "client_sell_price",
  MarkupMargin: "markup_margin",
} as const;

export type FinancialVisibilityLayer =
  (typeof FINANCIAL_VISIBILITY_LAYERS)[keyof typeof FINANCIAL_VISIBILITY_LAYERS];

const allInternalRoles = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const quoteControlRoles = [
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const operationsApprovalRoles = [
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];
const financeRoles = [
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly UserRole[];

export const CONTRACTOR_QUOTE_CONTROL_MATRIX = {
  [QUOTE_CONTROL_ACTIONS.View]: [
    ...allInternalRoles,
    USER_ROLES.ContractorUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Create]: [
    USER_ROLES.Coordinator,
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ContractorUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Edit]: [
    USER_ROLES.Coordinator,
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ContractorUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Submit]: [
    USER_ROLES.Coordinator,
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ContractorUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Approve]: operationsApprovalRoles,
  [QUOTE_CONTROL_ACTIONS.Reject]: operationsApprovalRoles,
  [QUOTE_CONTROL_ACTIONS.Revise]: [
    USER_ROLES.Coordinator,
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ContractorUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Reopen]: operationsApprovalRoles,
} as const satisfies Record<QuoteControlAction, readonly UserRole[]>;

export const CLIENT_QUOTE_CONTROL_MATRIX = {
  [QUOTE_CONTROL_ACTIONS.View]: [
    ...allInternalRoles,
    USER_ROLES.ClientUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Create]: quoteControlRoles,
  [QUOTE_CONTROL_ACTIONS.Edit]: quoteControlRoles,
  [QUOTE_CONTROL_ACTIONS.Submit]: quoteControlRoles,
  [QUOTE_CONTROL_ACTIONS.Approve]: [
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ClientUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Reject]: [
    USER_ROLES.Manager,
    USER_ROLES.Owner,
    USER_ROLES.ClientUser,
  ],
  [QUOTE_CONTROL_ACTIONS.Revise]: quoteControlRoles,
  [QUOTE_CONTROL_ACTIONS.Reopen]: operationsApprovalRoles,
} as const satisfies Record<QuoteControlAction, readonly UserRole[]>;

export const INVOICE_CONTROL_MATRIX = {
  [INVOICE_CONTROL_ACTIONS.View]: [
    USER_ROLES.FinanceAdmin,
    USER_ROLES.Owner,
    USER_ROLES.ClientUser,
  ],
  [INVOICE_CONTROL_ACTIONS.Draft]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.IssueSend]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.MarkPaid]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.MarkOverdue]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.Dispute]: [
    USER_ROLES.FinanceAdmin,
    USER_ROLES.Owner,
    USER_ROLES.ClientUser,
  ],
  [INVOICE_CONTROL_ACTIONS.Resolve]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.Edit]: financeRoles,
  [INVOICE_CONTROL_ACTIONS.Reopen]: [USER_ROLES.Owner],
} as const satisfies Record<InvoiceControlAction, readonly UserRole[]>;

export const FINANCIAL_VISIBILITY_MATRIX = {
  [FINANCIAL_VISIBILITY_LAYERS.ContractorRawPricing]: allInternalRoles,
  [FINANCIAL_VISIBILITY_LAYERS.ClientSellPrice]: allInternalRoles,
  [FINANCIAL_VISIBILITY_LAYERS.MarkupMargin]: financeRoles,
} as const satisfies Record<FinancialVisibilityLayer, readonly UserRole[]>;

export function roleCanControlContractorQuote(
  role: UserRole,
  action: QuoteControlAction,
): boolean {
  return (CONTRACTOR_QUOTE_CONTROL_MATRIX[action] as readonly UserRole[]).includes(
    role,
  );
}

export function roleCanControlClientQuote(
  role: UserRole,
  action: QuoteControlAction,
): boolean {
  return (CLIENT_QUOTE_CONTROL_MATRIX[action] as readonly UserRole[]).includes(
    role,
  );
}

export function roleCanControlInvoice(
  role: UserRole,
  action: InvoiceControlAction,
): boolean {
  return (INVOICE_CONTROL_MATRIX[action] as readonly UserRole[]).includes(role);
}

export function roleCanViewFinancialLayer(
  role: UserRole,
  layer: FinancialVisibilityLayer,
): boolean {
  return (FINANCIAL_VISIBILITY_MATRIX[layer] as readonly UserRole[]).includes(
    role,
  );
}

export function getRolesForContractorQuoteAction(
  action: QuoteControlAction,
): readonly UserRole[] {
  return CONTRACTOR_QUOTE_CONTROL_MATRIX[action];
}

export function getRolesForClientQuoteAction(
  action: QuoteControlAction,
): readonly UserRole[] {
  return CLIENT_QUOTE_CONTROL_MATRIX[action];
}

export function getRolesForInvoiceAction(
  action: InvoiceControlAction,
): readonly UserRole[] {
  return INVOICE_CONTROL_MATRIX[action];
}

export function assertFinancialControlInvariants(): void {
  assertRoleCannotControlInvoicePayment();
  assertCoordinatorCannotControlFinancialActions();
  assertExternalUsersCannotViewOpposingPricingLayers();
}

function assertRoleCannotControlInvoicePayment(): void {
  const managerInvoicePaymentActions = [
    INVOICE_CONTROL_ACTIONS.MarkPaid,
    INVOICE_CONTROL_ACTIONS.Resolve,
  ] as const satisfies readonly InvoiceControlAction[];

  const invalidActions = managerInvoicePaymentActions.filter((action) =>
    roleCanControlInvoice(USER_ROLES.Manager, action),
  );

  if (invalidActions.length > 0) {
    throw new Error(
      `Financial invariant violated: manager cannot control invoice payment actions (${invalidActions.join(", ")}).`,
    );
  }
}

function assertCoordinatorCannotControlFinancialActions(): void {
  const invoiceControlActions = Object.values(INVOICE_CONTROL_ACTIONS);
  const clientQuoteControlActions = [
    QUOTE_CONTROL_ACTIONS.Create,
    QUOTE_CONTROL_ACTIONS.Edit,
    QUOTE_CONTROL_ACTIONS.Submit,
    QUOTE_CONTROL_ACTIONS.Revise,
  ] as const satisfies readonly QuoteControlAction[];
  const invalidInvoiceActions = invoiceControlActions.filter((action) =>
    roleCanControlInvoice(USER_ROLES.Coordinator, action),
  );
  const invalidClientQuoteActions = clientQuoteControlActions.filter((action) =>
    roleCanControlClientQuote(USER_ROLES.Coordinator, action),
  );

  if (invalidInvoiceActions.length > 0 || invalidClientQuoteActions.length > 0) {
    throw new Error(
      `Financial invariant violated: coordinator cannot hold financial authority (invoice: ${invalidInvoiceActions.join(", ") || "none"}, client_quote: ${invalidClientQuoteActions.join(", ") || "none"}).`,
    );
  }
}

function assertExternalUsersCannotViewOpposingPricingLayers(): void {
  if (
    roleCanViewFinancialLayer(
      USER_ROLES.ClientUser,
      FINANCIAL_VISIBILITY_LAYERS.ContractorRawPricing,
    )
  ) {
    throw new Error(
      "Financial invariant violated: client users cannot see contractor raw pricing.",
    );
  }

  if (
    roleCanViewFinancialLayer(
      USER_ROLES.ContractorUser,
      FINANCIAL_VISIBILITY_LAYERS.ClientSellPrice,
    )
  ) {
    throw new Error(
      "Financial invariant violated: contractor users cannot see client sell pricing.",
    );
  }
}

assertFinancialControlInvariants();
