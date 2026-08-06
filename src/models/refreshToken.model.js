const mongoose = require('mongoose')

const refreshTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Refresh token must be associated with a user"],
        index: true
    },
    token: {
        type: String,
        required: [true, "Token is required"],
        unique: true
    }
}, {
    timestamps: true
})

refreshTokenSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 60 * 60 * 24 * 7 // 7 days
})

const refreshTokenModel = mongoose.model("refreshToken", refreshTokenSchema)

module.exports = refreshTokenModel