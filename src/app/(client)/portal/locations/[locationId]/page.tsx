import { LocationDetailPage } from "@/components/locations/location-detail-page";

interface ClientPortalLocationDetailPageProps {
  params: Promise<{ locationId: string }>;
}

export default async function ClientPortalLocationDetailPage({
  params,
}: ClientPortalLocationDetailPageProps) {
  const { locationId } = await params;
  return <LocationDetailPage locationId={locationId} portalMode />;
}
