import mongoose from 'mongoose'

const Schema = mongoose.Schema

const apiKeySchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        key: {
            type: String,
            required: true,
            unique: true
        },
        permissions: [{
            type: String,
            enum: ['read', 'write'],
            default: ['read']
        }],
        isActive: {
            type: Boolean,
            default: true
        },
        lastUsed: {
            type: Date,
            required: false
        },
        scope: {
            type: String,
            enum: ['workspace', 'table'],
            default: 'table' // Default to table for backward compatibility
        },
        accessType: {
            type: String,
            enum: ['all', 'specific'],
            default: 'all'
        },
        selectedResources: [{
            type: Schema.Types.ObjectId,
            refPath: 'scope'
        }]
    },
    { 
        timestamps: true 
    }
)
export default mongoose.model('ApiKey', apiKeySchema)