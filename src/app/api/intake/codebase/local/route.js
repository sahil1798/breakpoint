import { withErrorHandler } from "@/lib/middleware/errorHandler";
import { withAuth } from "@/lib/middleware/auth";
import { successResponse, errorResponse } from "@/lib/utils/apiResponse";
import connectDB from "@/lib/db/connect";
import Project from "@/lib/db/models/Project";
import Blueprint from "@/lib/db/models/Blueprint";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";

const PYTHON_ENGINE_URL =
  process.env.PYTHON_ENGINE_URL || "http://localhost:8000";

/**
 * POST /api/intake/codebase/local
 * Calls the Python backend to scan a local directory path and generate a blueprint.
 * Body: { projectId, localPath }
 */
export const POST = withErrorHandler(
  withAuth(async (request) => {
    const { projectId, localPath } = await request.json();
    if (!projectId) return errorResponse("projectId is required", 400);
    if (!localPath) return errorResponse("localPath is required", 400);

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError("Project");
    if (project.userId.toString() !== request.userId)
      throw new ValidationError("Not authorized");

    // Check Python engine is reachable
    const healthCheck = await fetch(`${PYTHON_ENGINE_URL}/health`).catch(
      () => null
    );
    if (!healthCheck || !healthCheck.ok) {
      return errorResponse(
        `Python engine is not running at ${PYTHON_ENGINE_URL}. Start it with: python server.py`,
        503
      );
    }

    // Call Python engine's codebase scan endpoint
    const scanResponse = await fetch(`${PYTHON_ENGINE_URL}/scan-codebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: localPath,
        project_id: projectId,
      }),
    });

    if (!scanResponse.ok) {
      const err = await scanResponse.text();
      return errorResponse(`Python engine scan failed: ${err}`, 502);
    }

    const scanData = await scanResponse.json();

    // Store the scanned blueprint in MongoDB
    // First delete any existing blueprint for this project
    if (project.blueprintId) {
      await Blueprint.findByIdAndDelete(project.blueprintId);
    }

    // Create new blueprint from scanned data
    const blueprintData = scanData.blueprint || scanData;
    const blueprint = await Blueprint.create({
      projectId,
      userId: request.userId,
      intakeMode: "codebase",
      status: "draft",
      productOverview: blueprintData.productOverview || `Codebase at ${localPath}`,
      coreFunctionalAreas: blueprintData.coreFunctionalAreas || [],
      userRoles: blueprintData.userRoles || [],
      apiSurface: blueprintData.apiSurface || [],
      dataModels: blueprintData.dataModels || [],
      authSystem: blueprintData.authSystem || {},
      paymentIntegration: blueprintData.paymentIntegration || {},
      businessRules: blueprintData.businessRules || [],
      pricingTiers: blueprintData.pricingTiers || [],
      attackSurface: blueprintData.attackSurface || [],
    });

    project.blueprintId = blueprint._id;
    project.intakeMode = "codebase";
    project.codebaseConfig = {
      localPath,
      lastAnalyzedAt: new Date(),
    };
    await project.save();

    // Return scan summary for the UI
    const filesScanned = scanData.filesScanned || Object.keys(scanData.fileContents || {}).length || 0;
    const entitiesFound = (blueprintData.coreFunctionalAreas?.length || 0) +
      (blueprintData.userRoles?.length || 0) +
      (blueprintData.apiSurface?.length || 0);

    return successResponse({
      blueprintId: blueprint._id,
      filesScanned,
      entitiesFound,
      categories: scanData.categories || {},
    });
  })
);
