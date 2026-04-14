import { redirect } from "next/navigation";
import { APP_CONSTANTS } from "@/config/app";

export default function Home() {
  redirect(APP_CONSTANTS.defaultProtectedPath);
}
