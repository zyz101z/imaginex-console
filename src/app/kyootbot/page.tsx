import type { Metadata } from "next";
import BuzzwordClient from "./BuzzwordClient";

export const metadata: Metadata = {
  title: "Chat Buzzword",
  robots: { index: false, follow: false },
};

export default function KyootbotPage() {
  return <BuzzwordClient />;
}
