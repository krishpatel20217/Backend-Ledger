const express = require('express')
const authMiddleware = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")


const router = express.Router()



/**
 * - POST /api/accounts/
 * - Create a new account
 * - Protected Route
 */
router.post("/",authMiddleware.authMiddleware,accountController.createAccountController)


/**
 * - GET /api/accounts/
 * - Get all accounts for the logged-in user
 * - Protected Route
 */
router.get("/",authMiddleware.authMiddleware,accountController.getUserAccountsController)

/**
 * - GET /api/balance/:accountId
 */
router.get("/balance/:accountId",authMiddleware.authMiddleware,accountController.getAccountBalanceController)

/**
 * - GET /api/accounts/:accountId/transactions
 * - Get paginated transaction history for an account
 * - Protected Route
 */
router.get("/:accountId/transactions", authMiddleware.authMiddleware, accountController.getAccountTransactionsController)

module.exports = router;