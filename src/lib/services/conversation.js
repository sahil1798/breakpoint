import connectDB from "@/lib/db/connect";
import Conversation from "@/lib/db/models/Conversation";
import Project from "@/lib/db/models/Project";
import { getLLMProviderWithFallback } from "@/lib/llm/factory";
import { getUserApiKey } from "@/lib/services/auth";
import { getOpeningPrompt, SYSTEM_PROMPT } from "@/lib/prompts/intake/openingPrompt";
import { getDecompositionPrompt } from "@/lib/prompts/intake/decomposition";
import { getFollowUpPrompt } from "@/lib/prompts/intake/followUp";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { MAX_FOLLOWUP_ROUNDS } from "@/lib/config/constants";

/**
 * Start a new conversational product interrogation
 */
export async function startConversation(projectId, userId) {
  await connectDB();

  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.userId.toString() !== userId) {
    throw new ValidationError("Not authorized");
  }

  // Create conversation with opening message
  const { openingMessage } = getOpeningPrompt();

  const conversation = await Conversation.create({
    projectId,
    messages: [
      {
        role: "assistant",
        content: openingMessage,
        metadata: { type: "opening" },
      },
    ],
    status: "active",
  });

  // Link conversation to project
  project.conversationId = conversation._id;
  project.intakeMode = "conversation";
  project.status = "intake";
  await project.save();

  return conversation.toJSON();
}

/**
 * Process a user message and generate follow-up questions
 */
export async function processMessage(conversationId, userMessage, userId) {
  await connectDB();

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new NotFoundError("Conversation");

  const project = await Project.findById(conversation.projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.userId.toString() !== userId) {
    throw new ValidationError("Not authorized");
  }

  if (conversation.status === "completed") {
    throw new ValidationError("Conversation is already completed. Generate a blueprint or start a new conversation.");
  }

  // Add user message
  conversation.messages.push({
    role: "user",
    content: userMessage,
    metadata: { type: "user_input" },
  });

  // Get LLM provider
  const apiKey = await getUserApiKey(userId, project.llmProvider);
  const llm = getLLMProviderWithFallback(project.llmProvider, apiKey);

  // Step 1: Run decomposition on accumulated conversation
  const conversationHistory = formatConversationHistory(conversation.messages);
  const decompositionPrompt = getDecompositionPrompt(conversationHistory);

  const decompositionResult = await llm.chatJSON([
    { role: "user", content: decompositionPrompt },
  ]);

  // Update decomposition
  const decomp = decompositionResult.data;
  conversation.decomposition = {
    entities: [
      ...(decomp.entities?.stated || []),
      ...(decomp.entities?.implied || []),
    ],
    flows: [
      ...(decomp.flows?.stated || []),
      ...(decomp.flows?.implied || []),
    ],
    boundaries: [
      ...(decomp.boundaries?.stated || []),
      ...(decomp.boundaries?.implied || []),
    ],
    gaps: decomp.gaps || [],
  };

  // Step 2: Determine if more follow-ups are needed
  const shouldContinue = shouldAskMore(conversation, decomp);

  if (shouldContinue) {
    conversation.followUpRound += 1;

    // Generate follow-up questions
    const followUpPrompt = getFollowUpPrompt(
      conversation.decomposition,
      conversationHistory,
      conversation.followUpRound
    );

    const followUpResult = await llm.chat([
      { role: "system", content: SYSTEM_PROMPT },
      ...conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user",
        content: followUpPrompt,
      },
    ]);

    // Add assistant follow-up
    conversation.messages.push({
      role: "assistant",
      content: followUpResult.content,
      metadata: {
        type: "followup",
        gapsIdentified: decomp.gaps?.slice(0, 5) || [],
      },
    });
  } else {
    // Conversation is complete enough
    conversation.status = "completed";

    // Add completion message
    conversation.messages.push({
      role: "assistant",
      content:
        "Great, I think I have a solid understanding of your product now! 🎯\n\nI've captured the key features, user flows, boundaries, and some interesting edge cases. I'm ready to generate your Product Blueprint — this will be a structured document that I'll present back to you for review before we start the simulation.\n\nWould you like me to generate the blueprint now?",
      metadata: { type: "summary" },
    });
  }

  await conversation.save();

  return {
    conversation: conversation.toJSON(),
    decomposition: decomp,
    isComplete: conversation.status === "completed",
    followUpRound: conversation.followUpRound,
    maxRounds: MAX_FOLLOWUP_ROUNDS,
  };
}

/**
 * Determine if more follow-up questions should be asked
 */
function shouldAskMore(conversation, decomposition) {
  // Max rounds reached
  if (conversation.followUpRound >= MAX_FOLLOWUP_ROUNDS) {
    return false;
  }

  // Check if enough gaps remain to justify another round
  const gaps = decomposition.gaps || [];
  if (gaps.length < 2) {
    return false; // Few enough gaps that we can proceed
  }

  // Check if we have minimum viable product understanding
  const hasEntities =
    (decomposition.entities?.stated?.length || 0) >= 2;
  const hasFlows =
    (decomposition.flows?.stated?.length || 0) >= 1;
  const hasBoundaries =
    (decomposition.boundaries?.stated?.length || 0) >= 1;

  // If we don't have basics, we MUST ask more
  if (!hasEntities || !hasFlows || !hasBoundaries) {
    return true;
  }

  // If we have basics and this is round 2+, allow completion
  if (conversation.followUpRound >= 2) {
    return false;
  }

  // Otherwise, keep asking if there are significant gaps
  return gaps.length >= 3;
}

/**
 * Format conversation messages into a readable history string
 */
function formatConversationHistory(messages) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role = m.role === "assistant" ? "BREAKPOINT" : "USER";
      return `${role}: ${m.content}`;
    })
    .join("\n\n");
}

/**
 * Get conversation and check ownership
 */
export async function getConversation(conversationId, userId) {
  await connectDB();

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new NotFoundError("Conversation");

  const project = await Project.findById(conversation.projectId);
  if (!project || project.userId.toString() !== userId) {
    throw new NotFoundError("Conversation");
  }

  return conversation.toJSON();
}
