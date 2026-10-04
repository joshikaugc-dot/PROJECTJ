import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/server/session";

export default async function Index() {
  redirect((await sessionUserId()) ? "/home" : "/login");
}
