// site/src/lib/csrf.ts
export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/csrf.php');
  if (!res.ok) {
    throw new Error(`CSRF endpoint returned ${res.status}`);
  }
  const data = await res.json();
  if (typeof data?.csrf_token !== 'string') {
    throw new Error('CSRF response has no csrf_token field');
  }
  return data.csrf_token;
}
