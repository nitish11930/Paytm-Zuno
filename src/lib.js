export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n / 100);
export const shortDate = (d, lang) =>
  new Date(d + "T12:00:00").toLocaleDateString(
    lang === "hindi" ? "hi-IN" : "en-IN",
    { day: "numeric", month: "short" },
  );
export async function api(path, { body, ...options } = {}) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(45000),
    ...options,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "NETWORK_ERROR" }));
  if (!res.ok)
    throw Object.assign(new Error(data.error), { status: res.status });
  return data;
}
