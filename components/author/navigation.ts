import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Folder,
  CheckCircle2,
  CreditCard,
  Package,
} from "lucide-react";
export const AUTHOR_SECTIONS = [
  { id: "overview", name: "Panoramica", icon: LayoutDashboard },
  { id: "project", name: "Il mio libro", icon: BookOpen },
  { id: "messages", name: "Messaggi", icon: MessageSquare },
  { id: "files", name: "File e revisioni", icon: Folder },
  { id: "approvals", name: "Approvazioni", icon: CheckCircle2 },
  { id: "payments", name: "Pagamenti", icon: CreditCard },
  { id: "deliveries", name: "Consegne", icon: Package },
] as const;
export type AuthorSection = (typeof AUTHOR_SECTIONS)[number]["id"];
export function authorSection(value: string | null): AuthorSection {
  return AUTHOR_SECTIONS.find((section) => section.id === value)?.id ?? "overview";
}
