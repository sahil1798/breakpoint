import { withErrorHandler } from "@/lib/middleware/errorHandler";
import { registerUser } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validators/auth";
import { successResponse, validationErrorResponse } from "@/lib/utils/apiResponse";

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();

  // Validate input
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    return validationErrorResponse(result.error.flatten().fieldErrors);
  }

  const { user, token } = await registerUser(result.data);

  return successResponse({ user, token }, {}, 201);
});
