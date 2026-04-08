import { withErrorHandler } from "@/lib/middleware/errorHandler";
import { loginUser } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validators/auth";
import { successResponse, validationErrorResponse } from "@/lib/utils/apiResponse";

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();

  // Validate input
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return validationErrorResponse(result.error.flatten().fieldErrors);
  }

  const { user, token } = await loginUser(result.data);

  return successResponse({ user, token });
});
