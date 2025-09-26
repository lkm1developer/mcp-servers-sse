import mongoose from 'mongoose'
const Schema = mongoose.Schema

const mcpServerSchema = new Schema(
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
        },
        isOAuth:{
             type: Boolean,
            required: true,
        },
        oAuthData:{
            type:Schema.Types.Mixed
        }
    },
    { timestamps: true }
)

export default mongoose.model('McpServerUser', mcpServerSchema)
