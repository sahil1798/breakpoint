/**
 * Product decomposition prompt — extracts structured understanding from conversation.
 */

export function getDecompositionPrompt(conversationHistory) {
  return `You are analyzing a product description conversation to extract a structured decomposition.

CONVERSATION SO FAR:
${conversationHistory}

Extract the following from the conversation. For each category, list what has been EXPLICITLY stated and what is IMPLIED but not confirmed.

Respond in JSON format:

{
  "entities": {
    "stated": ["List of explicitly mentioned entities — users, roles, content types, resources"],
    "implied": ["Entities implied but not explicitly confirmed"]
  },
  "flows": {
    "stated": ["User journeys explicitly described — signup, onboarding, core loop, payment, etc."],
    "implied": ["Flows that probably exist but weren't described"]
  },
  "boundaries": {
    "stated": ["Explicit transitions — free/paid boundary, public/private, auth/unauth, individual/group"],
    "implied": ["Boundaries that probably exist based on what was described"]
  },
  "gaps": [
    "Specific questions about the product that the founder DIDN'T answer but SHOULD have. These are things that are ambiguous, undefined, or assumed. Each gap should be a specific, answerable question — not vague. Focus on mechanics, edge cases, and boundary conditions."
  ],
  "keyFeatures": ["List of main product features identified"],
  "riskSignals": [
    "Any early indicators of potential vulnerabilities you noticed. Keep these brief."
  ]
}

IMPORTANT:
- Gaps should be SPECIFIC questions like "What happens to room content when the creator deletes their account?" — not vague ones like "Need more info about rooms"
- Focus on mechanics (how things work at the edge), not surface features
- Identify at least 5-10 gaps if possible
- Risk signals should note exploitation opportunities you've already spotted`;
}
