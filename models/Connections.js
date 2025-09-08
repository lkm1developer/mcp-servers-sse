import mongoose from 'mongoose'
const Schema = mongoose.Schema
const CellSchema = new Schema(
    {
        type: {
            type: String,
            required: true
        },
        pieceName: {
            type: String,
            required: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        data: {
            type: String,
            required: false
        },
        isSystem: {
            type: Boolean,
            required: true,
            default: false
        },
        userprofile: {
            type: String,
            required: false
        },
        isLoggedIn: {
            type: Boolean,
            required: false,
            default: false
        },
        apiKey: {
            type: String,
            required: false
        }
    },
    { timestamps: true }
)
export default mongoose.model('Connections', CellSchema)
