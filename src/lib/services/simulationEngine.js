import connectDB from "@/lib/db/connect";
import Simulation from "@/lib/db/models/Simulation";
import Blueprint from "@/lib/db/models/Blueprint";
import Project from "@/lib/db/models/Project";
import Agent from "@/lib/db/models/Agent";
import Vulnerability from "@/lib/db/models/Vulnerability";
import { getLLMProviderWithFallback } from "@/lib/llm/factory";
import { getUserApiKey } from "@/lib/services/auth";
import { generateAgentPopulation } from "@/lib/services/agentGenerator";
import { runGeneration } from "@/lib/services/generationRunner";
import { DEFAULT_SIMULATION_CONFIG } from "@/lib/config/defaults";
import {
  INTENSITY_PRESETS,
  SIMULATION_STATUS,
  BLUEPRINT_STATUS,
} from "@/lib/config/constants";
import {
  NotFoundError,
  ValidationError,
  SimulationError,
} from "@/lib/utils/errors";

/**
 * Configure a new simulation
 */
export async function configureSimulation(projectId, config, userId) {
  await connectDB();

  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.userId.toString() !== userId) throw new ValidationError("Not authorized");

  const blueprint = await Blueprint.findById(project.blueprintId);
  if (!blueprint || blueprint.status !== BLUEPRINT_STATUS.LOCKED) {
    throw new ValidationError("Blueprint must be locked before simulation can start");
  }

  const intensity = config.intensity || "standard";
  const preset = INTENSITY_PRESETS[intensity];

  const simulation = await Simulation.create({
    projectId,
    blueprintId: project.blueprintId,
    config: {
      intensity,
      totalAgents: config.totalAgents || preset.totalAgents,
      totalGenerations: config.totalGenerations || preset.totalGenerations,
      estimatedLlmCalls: preset.estimatedLlmCalls,
      estimatedDuration: preset.estimatedDuration,
      focusAreas: config.focusAreas || DEFAULT_SIMULATION_CONFIG.focusAreas,
      agentComposition: config.agentComposition || DEFAULT_SIMULATION_CONFIG.agentComposition,
      customAgents: config.customAgents || [],
    },
    status: SIMULATION_STATUS.CONFIGURING,
  });

  project.simulationIds.push(simulation._id);
  await project.save();

  return simulation.toJSON();
}

/**
 * Start a simulation run (the main orchestrator)
 */
export async function startSimulation(simulationId, userId) {
  await connectDB();

  const simulation = await Simulation.findById(simulationId);
  if (!simulation) throw new NotFoundError("Simulation");

  const project = await Project.findById(simulation.projectId);
  if (!project || project.userId.toString() !== userId) {
    throw new ValidationError("Not authorized");
  }

  if (simulation.status === SIMULATION_STATUS.RUNNING) {
    throw new ValidationError("Simulation is already running");
  }

  const blueprint = await Blueprint.findById(simulation.blueprintId);
  if (!blueprint) throw new NotFoundError("Blueprint");

  // Update status
  simulation.status = SIMULATION_STATUS.GENERATING_AGENTS;
  simulation.progress.startedAt = new Date();
  await simulation.save();

  project.status = "simulating";
  await project.save();

  const llmProvider = project.llmProvider;
  const apiKey = await getUserApiKey(userId, llmProvider);
  const llm = getLLMProviderWithFallback(llmProvider, apiKey);

  try {
    // Step 1: Generate agents
    const agentResult = await generateAgentPopulation(
      simulationId,
      simulation.blueprintId,
      simulation.config,
      userId,
      llmProvider
    );

    simulation.agentIds = agentResult.agents.map((a) => a._id);
    simulation.progress.agentsGenerated = agentResult.agents.length;
    simulation.status = SIMULATION_STATUS.RUNNING;
    await simulation.save();

    // Step 2: Run evolutionary generations
    let parentFindings = [];
    const allAgents = agentResult.agents;
    const blueprintObj = blueprint.toJSON();

    for (let gen = 1; gen <= simulation.config.totalGenerations; gen++) {
      // Check if simulation was stopped
      const currentSim = await Simulation.findById(simulationId);
      if (currentSim.status === SIMULATION_STATUS.PAUSED) {
        break;
      }

      simulation.currentGeneration = gen;
      await simulation.save();

      // Select subset of agents for this generation
      const agentsForGen = selectAgentsForGeneration(allAgents, gen, simulation.config.totalAgents);

      // Run generation
      const genResult = await runGeneration(
        simulationId,
        gen,
        agentsForGen,
        parentFindings,
        blueprintObj,
        llm
      );

      // Update simulation progress
      simulation.generationIds.push(genResult.generation._id);
      simulation.progress.generationsCompleted = gen;
      simulation.progress.totalVulnerabilitiesFound += genResult.findings.length;
      simulation.progress.llmCallsMade += genResult.stats.llmCalls;
      await simulation.save();

      // Feed selected findings to next generation
      parentFindings = [...parentFindings, ...genResult.selectedForNextGen];
    }

    // Step 3: Mark as completed
    simulation.status = SIMULATION_STATUS.COMPLETED;
    simulation.completedAt = new Date();
    await simulation.save();

    project.status = "completed";
    await project.save();

    return simulation.toJSON();
  } catch (error) {
    simulation.status = SIMULATION_STATUS.FAILED;
    simulation.errorLog.push({
      timestamp: new Date(),
      message: error.message,
      generation: simulation.currentGeneration,
    });
    await simulation.save();

    project.status = "ready"; // Allow retry
    await project.save();

    throw new SimulationError(error.message);
  }
}

/**
 * Stop a running simulation
 */
export async function stopSimulation(simulationId, userId) {
  await connectDB();

  const simulation = await Simulation.findById(simulationId);
  if (!simulation) throw new NotFoundError("Simulation");

  const project = await Project.findById(simulation.projectId);
  if (!project || project.userId.toString() !== userId) {
    throw new ValidationError("Not authorized");
  }

  simulation.status = SIMULATION_STATUS.PAUSED;
  await simulation.save();

  return simulation.toJSON();
}

/**
 * Get simulation status with progress
 */
export async function getSimulationStatus(simulationId, userId) {
  await connectDB();

  const simulation = await Simulation.findById(simulationId);
  if (!simulation) throw new NotFoundError("Simulation");

  const project = await Project.findById(simulation.projectId);
  if (!project || project.userId.toString() !== userId) {
    throw new NotFoundError("Simulation");
  }

  // Count vulnerabilities by generation
  const vulnsByGen = await Vulnerability.aggregate([
    { $match: { simulationId: simulation._id, isDuplicate: false } },
    { $group: { _id: "$generationNumber", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    simulation: simulation.toJSON(),
    vulnerabilitiesByGeneration: vulnsByGen,
  };
}

/**
 * Select agents for a specific generation.
 * Different generations may use different subsets of agents.
 */
function selectAgentsForGeneration(allAgents, genNumber, totalAgents) {
  // For now, use all agents for Gen 1, and a smart subset for later generations
  if (genNumber === 1) {
    return allAgents;
  }

  // For later generations, prioritize agents that found interesting things
  // or agents whose archetype is particularly relevant
  const maxForGen = Math.ceil(allAgents.length * 0.6);
  
  // Shuffle and take a subset
  const shuffled = [...allAgents].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxForGen);
}
