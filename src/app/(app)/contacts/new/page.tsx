import { ContactEditorPage } from "@/components/contacts/contact-editor-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function NewContactPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ContactEditorPage mode="create" />;
}
