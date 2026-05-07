import { ContactEditorPage } from "@/components/contacts/contact-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

interface EditContactPageProps {
  params: Promise<{
    contactId: string;
  }>;
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const { contactId } = await params;

  return <ContactEditorPage contactId={contactId} mode="edit" />;
}
