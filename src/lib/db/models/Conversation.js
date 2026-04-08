import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["system", "user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      type: {
        type: String,
        enum: ["opening", "followup", "clarification", "summary", "user_input"],
        default: "user_input",
      },
      gapsIdentified: [String],
      entitiesIdentified: [String],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    messages: [messageSchema],
    decomposition: {
      entities: [String],
      flows: [String],
      boundaries: [String],
      gaps: [String],
    },
    followUpRound: {
      type: Number,
      default: 0,
      max: 3,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
