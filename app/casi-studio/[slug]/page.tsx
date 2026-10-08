import { notFound } from "next/navigation";
export const metadata={title:"Pagina non trovata",robots:{index:false,follow:false}};
export default function Page(){notFound();}
