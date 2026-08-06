const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")


const app = express()

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))

app.use(express.json())
app.use(cookieParser())


/**
 * - Routes required
 */
const authRouter = require('./routes/auth.routes')
const accountRouter = require("./routes/account.routes")
const transactionRouter = require("./routes/transaction.routes")

/**
 * - Use Routes
 */
app.use("/api/auth",authRouter)
app.use("/api/accounts",accountRouter)
app.use("/api/transaction",transactionRouter)


app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ message: "Something went wrong" })
})

module.exports = app