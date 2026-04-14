export const contractorsModule = {
  name: "contractors",
  routeBasePath: "/contractors",
} as const;

export {
  CONTRACTOR_STATUSES,
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_VALUES,
  type ContractorStatus,
} from "./domain/constants.ts";
export { isContractorAssignable } from "./domain/is-contractor-assignable.ts";
export {
  contractorListQuerySchema,
  contractorStatusSchema,
  createContractorSchema,
  updateContractorSchema,
} from "./domain/schemas.ts";
export { filterContractors } from "./domain/filter-contractors.ts";
