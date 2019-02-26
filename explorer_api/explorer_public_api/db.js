var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;

var Block = new Schema(
{
    "number": {type: Number, index: {unique: true}},
    "hash": String,
    "parentHash": String,
    "nonce": String,
    "sha3Uncles": String,
    "logsBloom": String,
    "transactionsRoot": String,
    "transactions": [String],
    "stateRoot": String,
    "receiptRoot": String,
    "miner": String,
    "difficulty": String,
    "totalDifficulty": String,
    "size": Number,
    "extraData": String,
    "gasLimit": Number,
    "gasUsed": Number,
    "timestamp": Number,
    "blockTime": Number,
    "uncles": [String]
});

var Transaction = new Schema(
    {
        "hash": {type: String, index: {unique: true}},
        "nonce": Number,
        "blockHash": String,
        "blockNumber": Number,
        "transactionIndex": Number,
        "from": String,
        "to": String,
        "value": String,
        "gas": Number,
        "gasPrice": String,
        "timestamp": Number,
        "input": String
    }, {collection: "Transaction"});

var TransactionReceipt = new Schema(
{
    "transactionHash" : {type: String, index: {unique: true}},
    "blockHash": String,
    "blockNumber": Number,
    "contractAddress": String,
    "transactionIndex": Number,
    "cumulativeGasUsed" : Number,
    "from": String,
    "gasUsed" : Number,
    "logs": [String],
    "status": String, 
    "to": String,
    "transactionIndex": Number
}, {collection: "TransactionReceipt"});


// create indices
TransactionReceipt.index({blockNumber:-1});
TransactionReceipt.index({from:1, blockNumber:-1});
TransactionReceipt.index({to:1, blockNumber:-1});
Transaction.index({blockNumber:-1});
Transaction.index({from:1, blockNumber:-1});
Transaction.index({to:1, blockNumber:-1});
Block.index({miner:1});

mongoose.model('Block', Block);
mongoose.model('Transaction', Transaction);
mongoose.model('TransactionReceipt', TransactionReceipt);

module.exports.Block = mongoose.model('Block');
module.exports.Transaction = mongoose.model('Transaction');
module.exports.TransactionReceipt = mongoose.model('TransactionReceipt');


mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/tocApiDB');

// mongoose.set('debug', true);
