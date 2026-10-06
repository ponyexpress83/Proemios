import NextLink from "next/link";
import type { Route } from "next";
import type { ComponentProps } from "react";
export default function EditorialLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  return <NextLink href={href as Route} {...props} />;
}
