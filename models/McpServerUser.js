import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const mcpServerUserSchema = new Schema(
    {
        serverId: {
            type: Schema.Types.ObjectId,
            ref: 'McpServer',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        apiKey: {
            type: String,
            required: true,
        },
        rateLimit: {
            type: Schema.Types.Mixed,
            required: false,
        },
        enabled: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    { timestamps: true }
);

// Index for efficient API key lookups
mcpServerUserSchema.index({ apiKey: 1, enabled: 1 });
mcpServerUserSchema.index({ userId: 1, serverId: 1 }, { unique: true });

export default mongoose.model('McpServerUser', mcpServerUserSchema);