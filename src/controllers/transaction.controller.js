const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const accountModel = require('../models/account.model')
const emailService = require("../services/email.service")
const mongoose = require("mongoose")



/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
     * 1. Validate request
     * 2. Validate idempotency key
     * 3. Check account status
     * 4. Derive sender balance from ledger
     * 5. Create transaction (PENDING)
     * 6. Create DEBIT ledger entry
     * 7. Create CREDIT ledger entry
     * 8. Mark transaction COMPLETED
     * 9. Commit MongoDB session
     * 10. Send email notification
 */
async function createTransaction(req,res){

    /**
     * 1. Validate request
     */
    const {fromAccount,toAccount,amount,idempotencyKey} = req.body

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:"FromAccount, ToAccount, Amount and idempotencykey are required"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount,
    })

    const toUserAccount = await accountModel.findOne({
        _id:toAccount,
    })

    if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message:"invalid fromaccount or toaccount"
        })
    }

    if(fromUserAccount._id.toString() === toUserAccount._id.toString()){
        return res.status(400).json({
            message:"fromAccount and toAccount cannot be same"
        })
    }

    /**
     * 2. Validate idempotency key
     */

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey:idempotencyKey
    })

    if(isTransactionAlreadyExists){
        if(isTransactionAlreadyExists.status ==="COMPLETED"){
            return res.status(200).json({
                message:"Transaction already processed",
                transaction: isTransactionAlreadyExists
            })
        }

        if(isTransactionAlreadyExists.status ==="PENDING"){
            return res.status(200).json({
                message:"Transaction is still processing"
            })
        }

        if(isTransactionAlreadyExists.status ==="FAILED"){
            return res.status(500).json({
                message:"Transaction processing failed , please retry"
            })
        }

        if(isTransactionAlreadyExists.status ==="REVERSED"){
            return res.status(500).json({
                message:"Transaction is reversed, please retry"
            })
        }
    }

    /**
     * 3. Check account status
     */

    if(fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE"){
        return res.status(400).json({
            message : "Both fromAccount and toAccount must be ACTIVE to process transaction"
        })
    }

    /**
     * 4. Derive sender balance from ledger
     */

    const balance = await fromUserAccount.getBalance()

    if(balance < amount){
        return res.status(400).json({
            message: `Insufficient balance, Current balance is ${balance}. Requested amount is ${amount}`
        })
    }

    /**
     * 5. Create transaction (PENDING)
     * 6. Create DEBIT ledger entry
     * 7. Create CREDIT ledger entry
     * 8. Mark transaction COMPLETED
     * 9. Commit MongoDB session
     */
    let transaction;
    let session;
    try{
        session = await mongoose.startSession()
        session.startTransaction()

        transaction = (await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }],{ session }))[0]


        const debitLedgerEntry = await ledgerModel.create([{
            account: fromAccount,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }],{ session })


        const creditLedgerEntry = await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }],{ session })


        transaction = await transactionModel.findOneAndUpdate(
            {_id: transaction._id},
            {status: "COMPLETED"},
            {session, new: true}
        )

        await session.commitTransaction()
        session.endSession()
    }catch(error){
        await session.abortTransaction()
        session.endSession()
        return res.status(400).json({
            message:"Transaction is pending due to some issue please try again after some time"
        })
    }
    /**
     * 10. Send email notification
     */

    try {
        await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount)
    } catch (err) {
        console.error("Email failed:", err)
    }

    return res.status(201).json({
        message:"Transaction completed successfully",
        transaction:transaction
    })
    

}

// Note: system account has no balance check — it mints funds by design
async function createInitialFundsTransaction(req,res){

    const {toAccount,amount,idempotencyKey} = req.body

    if( !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:"ToAccount, Amount and idempotencykey are required"
        })
    }

    const toUserAccount = await accountModel.findOne({
        _id:toAccount,
    })

    if(!toUserAccount){
        return res.status(400).json({
            message:"invalid toaccount"
        })
    }


    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    })

    if(!fromUserAccount){
        return res.status(400).json({
            message: "System user account not found"
        })
    }

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey:idempotencyKey
    })

    if(isTransactionAlreadyExists){
        if(isTransactionAlreadyExists.status ==="COMPLETED"){
            return res.status(200).json({
                message:"Transaction already processed",
                transaction: isTransactionAlreadyExists
            })
        }

        if(isTransactionAlreadyExists.status ==="PENDING"){
            return res.status(200).json({
                message:"Transaction is still processing"
            })
        }

        if(isTransactionAlreadyExists.status ==="FAILED"){
            return res.status(500).json({
                message:"Transaction processing failed , please retry"
            })
        }

        if(isTransactionAlreadyExists.status ==="REVERSED"){
            return res.status(500).json({
                message:"Transaction is reversed, please retry"
            })
        }
    }

    if(fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE"){
        return res.status(400).json({
            message : "Both fromAccount and toAccount must be ACTIVE to process transaction"
        })
    }

    let transaction;
    let session;
    try {
        session = await mongoose.startSession()
        session.startTransaction()

        transaction = new transactionModel({
            fromAccount: fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status:"PENDING"
        })

        const debitLedgerEntry = await ledgerModel.create([{
            account: fromUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }],{ session })

        const creditLedgerEntry = await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }],{ session })

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
        session.endSession()
    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        return res.status(400).json({
            message: "Initial funds transaction failed, please try again after some time"
        })
    }

    return res.status(201).json({
        message:"Initial funds transaction completed successfully",
        transaction:transaction
    })

}

module.exports ={
    createTransaction,
    createInitialFundsTransaction
}