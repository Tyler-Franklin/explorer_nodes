require('./db');

const Web3 = require('web3');
const mongoose = require( 'mongoose' );
const bigNumber = require('bignumber.js');

const Block = mongoose.model( 'Block' );
const Transaction = mongoose.model( 'Transaction' );
const TransactionReceipt = mongoose.model( 'TransactionReceipt' );

const util = require('./util/utils');
const config = require('./config');

const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:9545'));

const confirmBlock = function(blockHash){
    return new Promise((resolve, reject) => {
        web3.eth.getBlock(blockHash, (err, docs) => {
            resolve(docs.number-10);
        });
    });
}

const getBlock = function(blockNum) {
    return new Promise(async (resolve, reject) => {
        web3.eth.getBlock(blockNum, (err, docs) => {
            if(err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
}

const getTransaction = function(txId) {
    return new Promise((resolve, reject) => {
        web3.eth.getTransaction(txId, async (err, docs) => {
            if(err) {
                reject(err);
            } else {
                docs.gasPrice = await (new bigNumber(docs.gasPrice)).toString();
                docs.value = await (web3._extend.utils.fromWei(new bigNumber(docs.value))).toString();
                resolve(docs);
            }
        });
    });
}

const getTransactionReceipt = function(txId) {
    return new Promise((resolve, reject) => {
        web3.eth.getTransactionReceipt(txId, (err, docs) => {
            if(err) {
                reject(err);
            } else {
                resolve(docs);
            }
        });
    });
}

const listenBlocks = () => {
    let newBlocks = web3.eth.filter('latest');
    newBlocks.watch( async (err, latestBlock) => {
        if(err) {
            console.log('!!! error !!!\n' + err);
        } else if(latestBlock == null) {
            console.log('latestBlock is null');
        } else {
            let confirmBlockNum = await confirmBlock(latestBlock);
            console.log(confirmBlockNum)

            if(confirmBlockNum%2000 == 0) {
                checkBlock(confirmBlockNum);
            }
    
            getBlock(confirmBlockNum).then( async blockInfo => {
                blockInsert(blockInfo);
                if(blockInfo.transactions.length !=0) {
                    for(let i=0; i<blockInfo.transactions.length; i++) {
                        await getTransactionReceipt(blockInfo.transactions[i]).then( txReceiptInfo => {
                            txReceiptInsert(txReceiptInfo);
                            return true;
                        });
                        await getTransaction(blockInfo.transactions[i]).then( txInfo => {
                            txInsert(txInfo);
                            return true;
                        });
                    }
                }
            }).catch(e => {
                console.log(e);
            });
        }
    });
}

const blockInsert = (blockInfo) => {
    return new Promise(async (resolve, reject) => {
        if(blockInfo.uncles.length > 0) {
            blockInfo.uncleYN = 'Y';
        } else {
            blockInfo.uncleYN = 'N';
        }
        Block.collection.insert(blockInfo).then(docs => {
            console.log("*** block data insert succcess ***");
            resolve(true);
        }).catch(e => {
            console.log("!!! block data insert fail !!!");
            reject(e.message);
        });
    }); 
}

const txInsert = (txInfo) => {
    return new Promise((resolve, reject) => {
        Transaction.collection.insert(txInfo).then(docs => {
            console.log("*** transaction data insert succcess ***");
            resolve(true);
        }).catch(e => {
            console.log("!!! transaction data insert fail !!!");
            reject(e.message);
        });
    });
}

const txReceiptInsert = (txReceiptInfo) => {
    return new Promise((resolve, reject) => {
        TransactionReceipt.collection.insert(txReceiptInfo).then(docs => {
            console.log("*** transactionReceipt data insert succcess ***");
            resolve(true);
        }).catch(e => {
            console.log("!!! transactionReceipt data insert fail !!!");
            reject(e.message);
        });
    });
}


const checkBlock = async (confirmBlockNum) => {

    if(confirmBlockNum == undefined) {
        console.log('*** Node is started and check db blocks ***');
        let currentBlockNum = await web3.eth.blockNumber;
        confirmBlockNum = currentBlockNum-10;
    }

    console.log(confirmBlockNum);

    let nextSector;
    let checkingBlockNum = confirmBlockNum;
    let count = 0;

    let checkBlockNum = await Block.find({number:{"$gte":confirmBlockNum-100, "$lt": confirmBlockNum}}, 'number').lean(true).count().then(docs => {
        return docs;
    }).catch(e => {
        console.log(e.message);
    });

    if(confirmBlockNum < 100) {
        if(checkBlockNum == confirmBlockNum) {
            console.log((checkBlockNum)+" :: "+confirmBlockNum);
            return true;
        } else if(checkBlockNum > confirmBlockNum) {
            console.log((checkBlockNum)+" :: "+confirmBlockNum);
            console.log("!!! wrong in calc !!!");
        } else if(checkBlockNum < confirmBlockNum) {
            console.log((checkBlockNum)+" :: "+confirmBlockNum);
            console.log("### last check sector ###");

            while(confirmBlockNum >= 0) {
                await getBlock(checkingBlockNum).then(async blockInfo => {
                    blockInsert(blockInfo);
                    if(blockInfo.transactions.length != 0) {
                        for(let i=0; i<blockInfo.transactions.length; i++) {
                            console.log('checkBlock transactionFind')
                            console.log(blockInfo.transactions.length + " :: "+i)
                            await getTransactionReceipt(blockInfo.transactions[i]).then(txReceiptInfo => {
                                txReceiptInsert(txReceiptInfo).catch(e => {
                                    console.log(e);
                                });
                                return true;
                            });
                            await getTransaction(blockInfo.transactions[i]).then( txInfo => {
                                txInsert(txInfo);
                                return true;
                            });
                        }
                    }
                });
                checkingBlockNum--;
            }
            return true;
        }
    } else {
        if(checkBlockNum == 100) {
            console.log("*** 100 different block is all clear ***");
            checkBlock(confirmBlockNum-100);
        } else {
            while(checkBlockNum < 100 && count < 100) {
                console.log("checking to blockNum is :: "+checkingBlockNum);
                await getBlock(checkingBlockNum).then(async blockInfo => {
                    blockInsert(blockInfo);
                    if(blockInfo.transactions.length != 0) {
                        for(let i=0; i<blockInfo.transactions.length; i++) {
                            console.log('checkBlock transactionFind')
                            console.log(blockInfo.transactions.length + " :: "+i)
                            await getTransactionReceipt(blockInfo.transactions[i]).then(txReceiptInfo => {
                                txReceiptInsert(txReceiptInfo).catch(e => {
                                    console.log(e);
                                });
                                return true;
                            });
                            await getTransaction(blockInfo.transactions[i]).then( txInfo => {
                                txInsert(txInfo);
                                return true;
                            });
                        }
                    }
                });
                nextSector = checkingBlockNum-1;
                checkingBlockNum--;
                count++;
            }
            setTimeout(() => {
                console.log("### check next sector Block "+ nextSector +" ###");
                checkBlock(nextSector);
            }, 1000);
        }
    }
}

checkBlock();
listenBlocks();