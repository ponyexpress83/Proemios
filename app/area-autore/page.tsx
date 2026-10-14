import RoleWorkspace from "@/components/platform/role-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"La tua area autore",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default function Page(){return <RoleWorkspace realm="author"/>;}
