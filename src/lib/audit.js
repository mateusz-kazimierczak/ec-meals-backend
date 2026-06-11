import { getHeader, requestPath } from "./http.js";

export const auditContext = (request) => ({
  actorUserId: request.user?.id,
  actorRole: request.user?.role,
  requestPath: requestPath(request),
  userAgent: getHeader(request, "user-agent"),
});
