import { WorkOrderDetailPage } from "@/components/work-orders/work-order-detail-page";

interface DashboardWorkOrderDetailPageProps {
  params: Promise<{
    workOrderId: string;
  }>;
}

export default async function DashboardWorkOrderDetailPage({
  params,
}: DashboardWorkOrderDetailPageProps) {
  const { workOrderId } = await params;

  return <WorkOrderDetailPage workOrderId={workOrderId} />;
}
