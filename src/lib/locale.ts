export type SiteLocale = "en" | "he";

/*
  ROUTE PREFIX STRATEGY:
    - English stays at root: /, /automations, /websites, /campaigns
    - Hebrew is prefixed:    /he, /he/automations, ...
*/
const HE_PREFIX = "/he";

/* Detect locale based on the current pathname. */
export function localeFromPath(pathname: string): SiteLocale {
  return pathname === HE_PREFIX || pathname.startsWith(`${HE_PREFIX}/`) ? "he" : "en";
}

/* Remove /he prefix so we can map EN <-> HE without duplicating logic. */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === HE_PREFIX) {
    return "/";
  }

  if (pathname.startsWith(`${HE_PREFIX}/`)) {
    return pathname.slice(HE_PREFIX.length);
  }

  return pathname;
}

/*
  Attach the locale prefix to a route.
  Useful for links in nav/footer so all links remain in the selected language.
*/
export function withLocale(pathname: string, locale: SiteLocale): string {
  const normalized = stripLocalePrefix(pathname.startsWith("/") ? pathname : `/${pathname}`);

  if (locale === "he") {
    return normalized === "/" ? HE_PREFIX : `${HE_PREFIX}${normalized}`;
  }

  return normalized;
}

/*
  Switch current route between languages while preserving the same page path.
  Query/hash are preserved by the click handler in Navigation.astro.
*/
export function switchLocalePath(pathname: string): string {
  return localeFromPath(pathname) === "he"
    ? stripLocalePrefix(pathname)
    : withLocale(pathname, "he");
}
