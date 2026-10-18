import { PublicProposal } from "@/components/platform/public-proposal";
export const metadata = { title: "La tua proposta", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicProposal token={token.slice(0, 80)} />;
}
