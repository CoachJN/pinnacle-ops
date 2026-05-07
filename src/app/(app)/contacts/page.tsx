import { ContactListPage } from "@/components/contacts/contact-list-page";
import { requireUserWithRole } from "@/lib/auth/guards";
import { INTERNAL_APP_ROLES } from "@/lib/rbac/roles";

export default async function ContactsPage() {
  await requireUserWithRole(INTERNAL_APP_ROLES);

  return <ContactListPage />;
}
