export class HttpError extends Error {
  constructor(statusCode, message = "Error") {
    super(message);
    this.statusCode = statusCode;
  }
}

export const getHeader = (request, name) => {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export const ok = (reply, payload, statusCode = 200) => reply.code(statusCode).send(payload);

export const requestPath = (request) => request.url.split("?")[0];

export const parseOptionalJson = (request) => request.body || {};
