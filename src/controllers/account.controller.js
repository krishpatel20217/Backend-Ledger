const accountModel = require("../models/account.model");
const transactionModel = require("../models/transaction.model");
const catchAsync = require('../utils/catchAsync')




async function createAccountController(req,res) {
    const user = req.user;

    const account = await accountModel.create({
        user:user._id
    })

    res.status(201).json({
        account
    })
}

async function getUserAccountsController(req,res){
    const accounts = await accountModel.find({
        user:req.user._id
    })

    res.status(200).json({
        accounts
    })
}

async function getAccountBalanceController(req,res){
    const {accountId}= req.params;

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if(!account){
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const balance = await account.getBalance();
    res.status(200).json({
        accountId: account._id,
        balance:balance
    })
}

async function getAccountTransactionsController(req, res) {
    const { accountId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const filter = {
        $or: [
            { fromAccount: account._id },
            { toAccount: account._id }
        ]
    }

    const [transactions, total] = await Promise.all([
        transactionModel.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        transactionModel.countDocuments(filter)
    ])

    res.status(200).json({
        accountId: account._id,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        transactions
    })
}

module.exports = {
    createAccountController: catchAsync(createAccountController),
    getUserAccountsController: catchAsync(getUserAccountsController),
    getAccountBalanceController: catchAsync(getAccountBalanceController),
    getAccountTransactionsController: catchAsync(getAccountTransactionsController)
}