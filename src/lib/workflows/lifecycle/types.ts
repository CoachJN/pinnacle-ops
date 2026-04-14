export type LifecycleTransitionMap<TStatus extends string> = Readonly<
  Record<TStatus, readonly TStatus[]>
>;

export interface LifecycleStatusMetadata<
  TStatus extends string,
  TCategory extends string,
> {
  readonly status: TStatus;
  readonly label: string;
  readonly category: TCategory;
  readonly terminal: boolean;
}

export function includesStatus<TStatus extends string>(
  statuses: readonly TStatus[],
  status: TStatus,
): boolean {
  return statuses.includes(status);
}

export function canTransition<TStatus extends string>(
  transitionMap: LifecycleTransitionMap<TStatus>,
  from: TStatus,
  to: TStatus,
): boolean {
  return transitionMap[from].includes(to);
}
