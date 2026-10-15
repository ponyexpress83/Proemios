import RoleWorkspace from "@/components/platform/role-workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Area di lavoro del team",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default function Page(){return <RoleWorkspace realm="staff"/>;}
