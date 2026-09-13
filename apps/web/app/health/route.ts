/** Liveness for the container health check. Deliberately does not call the API. */
export function GET(): Response {
  return Response.json({ status: 'ok' });
}
