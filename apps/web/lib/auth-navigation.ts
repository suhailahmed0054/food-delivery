const DEFAULT_POST_LOGIN_PATH = "/profile";
const CHECKOUT_PATH = "/checkout";

function isLoopingLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export function getSafeReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_POST_LOGIN_PATH
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://al-arab.local");
    const target = new URL(value, base);
    if (target.origin !== base.origin || isLoopingLoginPath(target.pathname)) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function getCheckoutLoginPath(returnTo = CHECKOUT_PATH) {
  const safeReturnTo = getSafeReturnTo(returnTo, CHECKOUT_PATH);
  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function isCheckoutReturnPath(value: string | null | undefined) {
  const safeReturnTo = getSafeReturnTo(value, "");
  return (
    safeReturnTo === CHECKOUT_PATH ||
    safeReturnTo.startsWith(`${CHECKOUT_PATH}?`) ||
    safeReturnTo.startsWith(`${CHECKOUT_PATH}#`)
  );
}
