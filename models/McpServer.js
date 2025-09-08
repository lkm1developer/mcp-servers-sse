import mongoose from 'mongoose'
const Schema = mongoose.Schema

const mcpServerSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: false
        },
        icon: {
            type: String,
            required: false
        },
        disabled: {
            type: Boolean,
            required: false,
            default: false
        },
        sseUrl: {
            type: String,
            required: false
        },
        tools: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Tool',
                required: false
            }
        ],
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: false
        },
        credit: {
            type: Number,
            required: false,
            default: 1
        },
        creditEnabled: {
            type: Boolean,
            required: false,
            default: false
        },
        assistantCanUse: {
            type: Boolean,
            required: false,
            default: false
        },
        isCustom: {
            type: Boolean,
            required: false,
            default: false
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        }
    },
    { timestamps: true }
)

export default mongoose.model('McpServer', mcpServerSchema)
