require('./db');

const Web3 = require('web3');
const mongoose = require( 'mongoose' );
const bigNumber = require('big-number');

const totalSupply = mongoose.model('totalSupply');
const totalSupplyRecord = mongoose.model('totalSupplyRecord');

const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:9545'));

const config = {
    "forkBlock" : 1170700,
    "initSupply" : '756000000000000000000000000',
    "bfReward" : '2500000000000000',
    "afReward" : '1340000000000000000',
    "bfUncleReward" : '1875000000000000',
    "afUncleReward" : '1005000000000000000'
};

const confirmBlock = function(blockHash){
    return new Promise((resolve, reject) => {
        web3.eth.getBlock(blockHash, (err, docs) => {
            resolve(docs.number-10);
        });
    });
}

const getBlock = function(blockNum){
    return new Promise((resolve, reject) => {
        web3.eth.getBlock(blockNum, (err, docs) => {
            resolve(docs);
        });
    });
}

const supplyInsert = (blockInfo) => {
    return new Promise(async (resolve, reject) => {
        if(blockInfo.uncles.length > 0) {
            blockInfo.uncleYN = 'Y';
        } else {
            blockInfo.uncleYN = 'N';
        }
        totalSupplyRecord.collection.insert(blockInfo).then(docs => {
            console.log("*** block data insert succcess ***");
            resolve(true);
        }).catch(e => {
            console.log("!!! block data insert fail !!!");
            reject(e.message);
        });
    });
}

const getTransaction = (txid) => {
    return new Promise(async (resolve, reject) => {
        web3.eth.getTransaction(txid, async (err, docs) => {
            if(err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
}

const getTransactionReceipt = (txid) => {
    return new Promise(async (resolve, reject) => {
        web3.eth.getTransactionReceipt(txid, async (err, docs) => {
            if(err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
}

const getBlockRewardCalc = (blockObj) => {
    return new Promise(async (resolve, reject) => {
        let blockReward = config.afReward;
        let txReward = 0;
        let uncleReward = 0;
        let totalReward = 0;
        
        // blockReward = bigNumber(config.forkBlock).mult(config.bfReward);
        // blockReward = bigNumber(blockReward).plus(bigNumber(blockObj.number-config.forkBlock+1).mult(config.afReward));
        
        for(let i=0; i<blockObj.transactions.length; i++) {
            let tx = await getTransaction(blockObj.transactions[i]);
            let txGasPrice = tx.gasPrice;
            let txReceipt = await getTransactionReceipt(blockObj.transactions[i]);
            let txGasUsed = txReceipt.gesUsed;
            
            txReward = txReward + bigNumber(txGasPrice).mult(txGasUsed);
        }
        
        uncleReward = bigNumber(config.afUncleReward).mult(blockObj.uncles.length);

        let tempReward = bigNumber(blockReward).plus(txReward);
        totalReward = bigNumber(tempReward).plus(uncleReward);
        resolve(totalReward.toString());
    });
}


const listenTotalSupply = () => {
    let newBlocks = web3.eth.filter('latest');
    newBlocks.watch( async (err, latestBlock) => {
        if(err) {
            console.log('!!! error !!!\n' + err);
        } else if(latestBlock == null) {
            console.log('latestBlock is null');
        } else {
            let confirmBlockNum = await confirmBlock(latestBlock);
            console.log(confirmBlockNum)

            getBlock(confirmBlockNum).then( async blockInfo => {
                supplyInsert(blockInfo);

                getBlockRewardCalc(blockInfo).then(async reward => {
                    totalSupply.find().then(async docs => {
                        let convertReward = await web3._extend.utils.fromWei(reward);
                        let supply = await bigNumber(docs[0].supply).plus(convertReward);
                        
                        totalSupply.updateOne({},{blockNumber:blockInfo.number, supply:supply}).then(()=>{
                            console.log("*** update success ***");
                        }).catch(e3 => {
                            console.log("!!! update fail !!!");
                        })
                    }).catch(e2 => {
                        console.log(e2);
                    })
                })
            }).catch(e => {
                console.log(e);
            });
        }
    });
}

listenTotalSupply();

var test = () => {
    let kk = web3._extend.utils.fromWei('756000000000000000000000000');
    console.log(kk)

    let blockReward = 0;
    blockReward = bigNumber(config.forkBlock).mult(config.bfReward);
    blockReward = bigNumber(blockReward).plus(bigNumber(1450610-config.forkBlock+1).mult(config.afReward));

    let qq = web3._extend.utils.fromWei(blockReward.toString())
    let pp = web3._extend.utils.fromWei("4015980000000000000000")
    let oo = web3._extend.utils.fromWei("5352344772000000000000")
    
    console.log(kk)
    console.log(qq)
    console.log(pp)
    console.log(oo)
}

// test()

