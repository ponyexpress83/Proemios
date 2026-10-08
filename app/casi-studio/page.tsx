import { redirect } from "next/navigation";
export const metadata={title:"Il percorso editoriale",robots:{index:false,follow:false}};
export default function Page(){redirect("/come-funziona");}
