import NextLink from "next/link";
import type { Route } from "next";
import type { ComponentProps } from "react";
export default function EditorialLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  // Lo spazio demo ha una shell indipendente: aprila con un documento completo.
  if (["/", "/accedi", "/area-autore"].includes(href))
    return <a href={href} {...(props as ComponentProps<"a">)} />;
  return <NextLink href={href as Route} {...props} />;
}
