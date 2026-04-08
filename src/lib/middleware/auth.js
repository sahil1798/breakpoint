import { verifyToken } from "@/lib/services/auth";
import { AuthError } from "@/lib/utils/errors";
import { errorResponse } from "@/lib/utils/apiResponse";

/**
 * Extract user ID from request by verifying JWT token.
 * Returns userId string or throws AuthError.
 */
export async function authenticateRequest(request) {
  const authHeader = request.headers.get("Authorization");
  const cookieToken = request.cookies?.get("token")?.value;
  
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    throw new AuthError("Missing or invalid authorization session");
  }

  const payload = await verifyToken(token);
  return payload.userId;
}

/**
 * HOF: Wraps a handler to require authentication.
 * Injects userId into the handler's context.
 */
export function withAuth(handler) {
  return async function (request, context) {
    try {
      const userId = await authenticateRequest(request);
      // Attach userId to request for downstream use
      request.userId = userId;
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return errorResponse(error.message, 401);
      }
      throw error;
    }
  };
}
