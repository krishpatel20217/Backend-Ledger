const jwt = require('jsonwebtoken')

function generateAccessToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" })
}

function generateRefreshToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })
}

module.exports = {
    generateAccessToken,
    generateRefreshToken
}