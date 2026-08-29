import type { Metadata } from "next";
import { AuthCard } from "@/components/layout/auth-card";
import { authHero } from "@/features/auth/banners";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthCard hero={authHero}>{children}</AuthCard>;
}
