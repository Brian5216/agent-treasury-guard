export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

export function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function getRequestOrigin(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = forwardedProto ? String(forwardedProto) : "http";
  const host = request.headers.host || "127.0.0.1";
  return `${protocol}://${host}`;
}
