const mongoose = require('mongoose');
const bigNumber = require('big-number');

const Block = mongoose.model('Block');
const Transaction = mongoose.model('Transaction');
const TransactionReceipt = mongoose.model('TransactionReceipt');

const config = {
    "forkBlock" : 1170700,
    "bfReward" : '2500000000000000',
    "afReward" : '1340000000000000000',
    "bfUncleReward" : '1875000000000000',
    "afUncleReward" : '1005000000000000000'
};

const getBlockByDb = (query) => {
    return new Promise((resolve, reject) => {
        Block.find(query).lean(true).sort('-number').then(blockInfo => {
            resolve(blockInfo);
        }).catch(e => {
            reject(e.message);
        });
    });
}

const getTransactionByDb = (query) => {
    return new Promise((resolve, reject) => {
        Transaction.find(query).lean(true).sort('-blockNumber').then(txInfo => {
            resolve(txInfo);
        }).catch(e => {
            reject(e.message);
        });
    });
}

const getTransactionReceiptByDb = (query) => {
    return new Promise((resolve, reject) => {
        TransactionReceipt.find(query).lean(true).sort('-blockNumber').then(txInfo => {
            resolve(txInfo);
        }).catch(e => {
            reject(e.message);
        });
    });
}

const getBlockRewardCalc = (blockNum) => {
    return new Promise(async (resolve, reject) => {
        let rewardVal
        if(blockNum < config.forkBlock) {
            rewardVal = config.bfReward;
        } else {
            rewardVal = config.afReward;
        }

        let txByDb = await getTransactionByDb({blockNumber : blockNum});
        let txReceiptByDb = await getTransactionReceiptByDb({blockNumber : blockNum});
        
        for(let i=0; i<txByDb.length; i++) {
            let multVal = await new bigNumber(txByDb[i].gasPrice).multiply(txReceiptByDb[i].gasUsed);
            rewardVal = await new bigNumber(rewardVal).plus(multVal);
        }
        resolve(rewardVal);
    });
}

module.exports = (app, fs) => {
    app.get('/getTransactionsByAddr/:addr', (req, res) => {
        let addr = req.params.addr;
    
        Transaction.find({ $or : [{from:addr}, {to:addr}] }).lean(true).sort('-blockNumber').then(docs => {
            res.end(JSON.stringify(docs));
        }).catch(e => {
            res.end(e.message);
        });
    });

    app.get('/getMinerBlocks/:addr', async (req, res) => {
        let addr = req.params.addr;
        let returnData = [];

        let minerBlock = await Block.find({miner : addr}).lean(true).sort('-number').then(async minerBlockInfo => {
            let docs = [];
            for(let i=0; i<minerBlockInfo.length; i++) {
                let blockInfo = {
                    blockNumber : minerBlockInfo[i].number,
                    timeStamp : minerBlockInfo[i].timestamp,
                    transactions : minerBlockInfo[i].transactions
                }
                docs.push(blockInfo);
            }
            return docs;
        }).catch(e => {
            return e.message;
        });
        
        
        for(let i=0; i<minerBlock.length; i++) {
            let minerBlockInfo = {
                blockNumber : minerBlock[i].blockNumber,
                timeStamp : minerBlock[i].timeStamp
            }

            if(minerBlock[i].transactions.length == 0) {
                if(minerBlock[i].blockNumber < config.forkBlock) {
                    minerBlockInfo.reward = config.bfReward;
                } else {
                    minerBlockInfo.reward = config.afReward;
                }
                await returnData.push(minerBlockInfo);
            } else {
                let _rewardVal = await getBlockRewardCalc(minerBlock[i].number);
                minerBlockInfo.reward = _rewardVal;
                await returnData.push(minerBlockInfo);
            }
        }
        res.end(JSON.stringify(returnData));
    });

    app.get('/getBlockReward/:blockNum', async (req, res) => {
        let blockNum = req.params.blockNum;
        
        let i = 0;
        let tempArr = [];
        let tempObj = {};
        let returnData = {
            blockNumber : Number,
            timeStamp : Number,
            blockMiner : String,
            blockReward : String
        };

        let blockInfo = await getBlockByDb({number : blockNum});
        returnData.blockNumber = blockInfo[0].number;
        returnData.timeStamp = blockInfo[0].timestamp;
        returnData.blockMiner = blockInfo[0].miner;
        returnData.blockReward = (await getBlockRewardCalc(blockInfo[0].number)).toString();

        while(blockInfo[0].uncles.length>0 && blockInfo[0].uncles.length>i) {
            tempObj.miner = blockInfo[0].uncles[i];
            tempObj.unclePosition = i;
            if(blockInfo[0].number < config.forkBlock) {
                tempObj.blockReward = config.bfUncleReward;
            } else {
                tempObj.blockReward = config.afUncleReward;
            }
            await tempArr.push(tempObj);
            i++
        }
        returnData.uncles = tempArr;
        
        res.end(JSON.stringify(returnData));
    });

    app.get('/checkTransaction/:txId', async (req, res) => {
        let txId = req.params.txId;
        let returnData = {};
        let txStatusInfo = await getTransactionReceiptByDb({transactionHash : txId});

        if(txStatusInfo[0].status == "0x1") {
            returnData.status = Number(txStatusInfo[0].status);
            returnData.message = 'success';
        } else {
            returnData.status = Number(txStatusInfo[0].status);;
            returnData.message = 'fail';
        }
        
        res.end(JSON.stringify(returnData));
    });

    app.get('/totalSupply', async (req, res) => {
        let uncleReward = await Block.find({uncleYN:"Y"}, 'uncles').then(docs => {
            return docs;
        }).catch(e => {
            return e;
        });

        let uncleCount = 0;
        for(let i=0; i<uncleReward.length; i++) {
            uncleCount += uncleReward[i].uncles.length;
        }

        let uncleSupply = bigNumber(uncleCount).multiply(config.afUncleReward)

        let txData = await Transaction.find({},'blockNumber').lean(true);

        let transactionReward = 0;
        for(let i=0; i<txData.length; i++) {
            let kk = await getBlockRewardCalc(txData[i].blockNumber)
            transactionReward = bigNumber(transactionReward).plus(kk);
        }

        
        console.log(uncleSupply.toString())
        console.log(transactionReward.toString())
    });
}