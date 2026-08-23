"use client";

import Link from "next/link";
import { Fragment } from "react";
import { detailCrumbFor, isNavItemActive, type AppSection } from "./nav-config";

type AppBreadcrumbsProps = {
  section: AppSection;
  pathname: string;
  tabParam: string | null;
  hash: string;
};

export function AppBreadcrumbs({ section, pathname, tabParam, hash }: AppBreadcrumbsProps) {
  const activeItem = section.items.find((item) =>
    isNavItemActive(item, pathname, tabParam, hash),
  );
  const leaf = activeItem?.label ?? detailCrumbFor(pathname);

  const trail: Array<{ label: string; href?: string }> = [
    { label: section.label, href: leaf ? section.href : undefined },
  ];
  if (leaf) {
    trail.push({ label: leaf });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="sticky top-14 z-10 flex h-11 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-4 text-sm md:px-6"
    >
      {trail.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {index > 0 ? (
            <span className="text-muted/60" aria-hidden>
              /
            </span>
          ) : null}
          {crumb.href ? (
            <Link href={crumb.href} className="text-muted transition-colors hover:text-foreground">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
