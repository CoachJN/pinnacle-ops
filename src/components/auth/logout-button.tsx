"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getExistingFirebaseClientApp, getFirebaseClientAuth } from "@/lib/firebase";
import { APP_PATHS, AUTH_API_PATHS } from "@/lib/utils/constants";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await fetch(AUTH_API_PATHS.logout, { method: "POST" });

      if (getExistingFirebaseClientApp()) {
        await signOut(getFirebaseClientAuth());
      }
    } finally {
      router.replace(APP_PATHS.signIn);
      router.refresh();
    }
  }

  return (
    <button
      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500 disabled:cursor-not-allowed disabled:text-neutral-400"
      disabled={isSigningOut}
      onClick={handleLogout}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
