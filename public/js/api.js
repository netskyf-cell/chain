// The only place the front end talks to the server. It never calls GitHub directly
// and never holds a token: /api/demo does that server side.

export async function loadRepo(repo) {
  const res = await fetch(`/api/demo?repo=${encodeURIComponent(repo)}`);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message = (body && body.error) || `Something went wrong (${res.status}). Try again later.`;
    throw new Error(message);
  }
  return body;
}
