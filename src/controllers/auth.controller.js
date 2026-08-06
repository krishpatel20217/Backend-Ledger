const userModel = require("../models/user.model")
const jwt = require('jsonwebtoken')
const emailServices = require('../services/email.service')
const tokenBlackListModel = require("../models/blackList.model")
const refreshTokenModel = require("../models/refreshToken.model")
const catchAsync = require('../utils/catchAsync')
const { generateAccessToken, generateRefreshToken } = require('../utils/token.util')

async function issueTokens(res, userId) {
    const accessToken = generateAccessToken(userId)
    const refreshToken = generateRefreshToken(userId)

    await refreshTokenModel.create({ user: userId, token: refreshToken })

    res.cookie("token", accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 })
    res.cookie("refreshToken", refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })

    return accessToken
}
/**
 * - user register controller
 * - POST /api/auth/register  
 */
async function userRegisterController(req,res){

    const {email,password,name}= req.body

    const isExist = await userModel.findOne({
        email:email
    })

    if(isExist){
        return res.status(422).json({
            message:"User already exists with this email.",
            status:"failed"
        })
    }

    const user = await userModel.create({
        email,password,name
    })

    const token = await issueTokens(res, user._id)


    res.status(201).json({
        user: {
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })

    try {
        await emailServices.sendRegistrationEmail(user.email, user.name)
    } catch (err) {
        console.error("Registration email failed:", err)
    }
}

/**
 * -User Login Controller
 * -POST /api/auth/login
 */
async function userLoginController(req,res) {
 const {email,password} = req.body
 
 const user = await userModel.findOne({email}).select('+password')

 if(!user){
    return res.status(401).json({
        message:"Email or password is INVALID"
    })
 }
 const isValidPassword = await user.comparePassword(password)

 if(!isValidPassword){
    return res.status(401).json({
        message:"Email or password is INVALID"
    })
 }

 const token = await issueTokens(res, user._id)

    res.status(200).json({
        user:{
            _id:user._id,
            email:user.email,
            name:user.name
        },
        token
    })

}


/**
 * -User Refresh Controller
 * -POST /api/auth/refresh
 */
async function userRefreshController(req,res){
    const incomingRefreshToken = req.cookies.refreshToken

    if(!incomingRefreshToken){
        return res.status(401).json({ message: "Refresh token is missing" })
    }

    const storedToken = await refreshTokenModel.findOne({ token: incomingRefreshToken })
    if(!storedToken){
        return res.status(401).json({ message: "Refresh token is invalid or expired" })
    }

    let decoded
    try {
        decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET)
    } catch (err) {
        await refreshTokenModel.deleteOne({ token: incomingRefreshToken })
        return res.status(401).json({ message: "Refresh token is invalid or expired" })
    }

    // rotate: delete old, issue new
    await refreshTokenModel.deleteOne({ token: incomingRefreshToken })
    const newAccessToken = await issueTokens(res, decoded.userId)

    return res.status(200).json({
        message: "Token refreshed successfully",
        token: newAccessToken
    })
}

/**
 * -User Logout Controller
 * -POST /api/auth/logout
 */
async function userLogoutController(req,res){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]
    const refreshToken = req.cookies.refreshToken

    if(refreshToken){
        await refreshTokenModel.deleteOne({ token: refreshToken })
        res.clearCookie("refreshToken")
    }

    if(!token){
        return res.status(200).json({
            message:"User logged out successfully"
        })
    }

    

    const isAlreadyBlacklisted = await tokenBlackListModel.findOne({ token })
    if (!isAlreadyBlacklisted) {
        await tokenBlackListModel.create({ token })
    }
    res.clearCookie("token")
    return res.status(200).json({
         message: "User logged out successfully" 
        })


}

module.exports = {
        userRegisterController: catchAsync(userRegisterController),
    userLoginController: catchAsync(userLoginController),
    userRefreshController: catchAsync(userRefreshController),
    userLogoutController: catchAsync(userLogoutController)
}