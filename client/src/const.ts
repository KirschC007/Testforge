export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Point to internal login page instead of Manus OAuth portal.
export const getLoginUrl = (returnPath?: string) => {
  const base = `${window.location.origin}/login`;
  return returnPath ? `${base}?return=${encodeURIComponent(returnPath)}` : base;
};
