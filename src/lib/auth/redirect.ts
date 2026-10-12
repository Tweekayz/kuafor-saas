const DEFAULT_PATH = "/panel";

/** Yalnızca site içi yollara yönlendir (açık yönlendirme engeli). */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PATH;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : DEFAULT_PATH;
}
