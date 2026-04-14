import { WorkOrderCreatePage } from "@/components/work-orders/create/work-order-create-page";

interface NewDashboardWorkOrderPageProps {
  searchParams: Promise<{
    clientOrganizationId?: string;
  }>;
}

export default async function NewDashboardWorkOrderPage({
  searchParams,
}: NewDashboardWorkOrderPageProps) {
  const { clientOrganizationId } = await searchParams;

  return (
    <WorkOrderCreatePage defaultClientOrganizationId={clientOrganizationId} />
  );
}
