/** Small JSON fetch helper for the admin API routes. Throws with the server's message. */
export async function adminApi<T = unknown>(path: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}
