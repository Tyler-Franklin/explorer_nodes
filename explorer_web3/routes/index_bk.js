var mongoose = require('mongoose');

var Block = mongoose.model('Block');
var Transaction = mongoose.model('Transaction');
var filters = require('./filters');
var http = require('http');
var fs = require('fs');
var CONSTS = require('../const/accetInfoConst');

var async = require('async');
var Web3 = require('web3');
var web3;
var net = require('net');

var config = {
    "nodeAddr":     "1.223.21.115",
    "gethPort":     8545,
    "startBlock":   3288280,
    "quiet":        true,
    "syncAll":      true,
    "patch":        true,
    "patchBlocks":  100,
    "bulkSize":     100,
    "settings": {
        "symbol": "ETC",
        "name": "Ethereum Classic",
        "title": "Ethereum Classic Block Explorer",
        "author": "Elaine, Cody, Hackmod, Bakon",
        "contact": "mailto:ethereumclassicanthony@gmail.com",
        "about": "This is an open source Blockchain Explorer.",
        "rss": "http://ethereumclassic.org",
        "reddit": "https://www.reddit.com/r/EthereumClassic",
        "twitter": "https://twitter.com/ethereumclassic",
        "linkedin": "https://www.linkedin.com/company/ethereum-classic",
        "github": "https://github.com/ethereumproject",
        "logo": "/img/explorer-logo.png",
        "customCss": "green-haze.min.css",
        "copyright": "2018 &copy; Ethereum Classic.",
        "miners": {
            "0xdf7d7e053933b5cc24372f878c90e62dadad5d42": "EtherMine",
            "0xc91716199ccde49dc4fafaeb68925127ac80443f": "F2Pool",
            "0x9eab4b0fc468a7f5d46228bf5a76cb52370d068d": "NanoPool",
            "0x8c5535afdbdeea80adedc955420f684931bf91e0": "MiningPoolHub",
            "0x4750e296949b747df1585aa67beee8be903dd560": "UUPool",
            "0xef224fa5fad302b51f38898f4df499d7af127af0": "91pool",
            "0x00d29bfdf5f8d2d0466da4b948f37692ca50867a": "2miners",
            "0x4c2b4e716883a2c3f6b980b70b577e54b9441060": "ETCPool PL",
            "0xd144e30a0571aaf0d0c050070ac435deba461fab": "Clona Network"
                 }
        }
  };


module.exports = function(app, fs) {
  var web3relay = require('./web3relay');

  var DAO = require('./dao');
  var Token = require('./token');

  var compile = require('./compiler');
  var fiat = require('./fiat');
  var stats = require('./stats');

  app.get('/getAddr/:address/:lim/:pageNum', getAddr);
  app.get('/getTransaction/:tx', getTransaction);
  app.get('/getTransactions/:lim/:pageNum', getTransactions);
  app.get('/getBlock/:number', getBlock);
  app.get('/latestBlock', latestBlock);
  app.get('/sendBlocks/:lim/:pageNum', sendBlocks);
  app.get('/blockTransactions/:blockNum/:lim/:pageNum', blockTransactions);
  app.get('/getEthfBalance/:addr', getEthfBalance);
  app.get('/getBalance/:addr', getBalance);
  app.get('/blockCount', blockCount);
  app.get('/transactionCount', transactionCount);
  app.get('/newAccount/:account', newAccount);
  app.post('/sendTransaction', sendTransaction);
}

//getIp
function fnGetIP(req) {
  var IPFromRequest=req.connection.remoteAddress;
  var indexOfColon = IPFromRequest.lastIndexOf(`:`);
  var ipv4 = IPFromRequest.substring(indexOfColon+1,IPFromRequest.length);
  return ipv4;
}


//ipCheck
function fnAcceptIPCHK(ip) {
  if(CONSTS.ACCEPT_IP.API1 == ip ||
    CONSTS.ACCEPT_IP.API2 == ip ||
    CONSTS.ACCEPT_IP.API3 == ip ||
    CONSTS.ACCEPT_IP.LAPI1 == ip ||
    CONSTS.ACCEPT_IP.LAPI2 == ip ||
    CONSTS.ACCEPT_IP.LAPI3 == ip ||
    CONSTS.ACCEPT_IP.CME == ip) {
      return true;
  } else {
    return false;
  }
};



//timestamp parsing
var getDuration = function(timestamp){
    var millis = Date.now() - timestamp*1000;
    var dur = [];
    var units = [
        {label:"millis",    mod:1000},
        {label:"seconds",   mod:60},
        {label:"mins",   mod:60},
        {label:"hours",     mod:24},
        {label:"days",      mod:365},
        {label:"years",      mod:1000}
    ];
    // calculate the individual unit values
    units.forEach(function(u){
        var val = millis % u.mod;
        millis = (millis - val) / u.mod;
        if (u.label == "millis")
            return;
        if (val > 0)
            dur.push({"label": u.label, "val": val});
    });
    // convert object to string representation
    dur.toString = function(){
        return dur.reverse().slice(0,2).map(function(d){
            return d.val + " " + (d.val==1?d.label.slice(0,-1):d.label);
        }).join(', ');
    };
    return dur;
};

//getAddr addr에 따른 Transaction값 추출
var getAddr = function(req, res){
  var addr = req.params.address.toLowerCase();
  var count = parseInt(req.body.count);
  var limit = parseInt(req.params.lim);
  var start = parseInt(req.params.pageNum);

  var data = {
    draw: parseInt(req.body.draw),
    recordsFiltered: count,
    recordsTotal: count,
    mined: 0
  };

  var addrFind = Transaction.find({ $or: [{"to": addr}, { "from": addr}] })
  var sortOrder = '-blockNumber';
  if (req.body.order && req.body.order[0] && req.body.order[0].column) {
    // date or blockNumber column
    if (req.body.order[0].column == 1 || req.body.order[0].column == 6) {
      if (req.body.order[0].dir == 'asc') {
        sortOrder = 'blockNumber';
      }
    }
  }

  Transaction.aggregate([
    { $match: { $or: [{"to": addr}, {"from": addr}] }},
    { $group: { _id: null, count: { $sum: 1 } }}
  ]).exec(function(err, results) {
    if (!err && results && results.length > 0) {
      // fix recordsTotal
      data.recordsTotal = results[0].count;
      data.recordsFiltered = results[0].count;
    }
  });

  Block.aggregate([
    { $match: { "miner": addr } },
    { $group: { _id: '$miner', count: { $sum: 1 } }
    }]).exec(function(err, results) {
    if (!err && results && results.length > 0) {
      data.mined = results[0].count;
    }
    addrFind.lean(true).sort(sortOrder).skip(start).limit(limit)
      .exec("find", function(err, docs) {
        if (docs)
          data.data = filters.filterTX(docs, addr);
        else
          data.data = [];
        res.write(JSON.stringify(data));
        res.end();
      });
  });

};

//getTransaction
var getTransaction = function(req, res){
  var tx = req.params.tx.toLowerCase();
  var txFind = Transaction.find( { "hash" : tx }).lean(true);
  var time = "";
  txFind.exec(function (err, doc) {
    if (!doc){
      console.log("missing: " +tx)
      res.write(JSON.stringify({}));
      res.end();
    } else {
      doc[0].timestamp = getDuration(doc[0].timestamp);
      for(var i = doc[0].timestamp.length-1; i>=0; i--){
        time += doc[0].timestamp[i].val +" "+ doc[0].timestamp[i].label + " ";
      };
      doc[0].timestamp = time;
      doc[0].gasPrice = doc[0].gasPrice.c;
      res.write(JSON.stringify(doc));
      res.end();
    }
  });
};


//getTransactions
var getTransactions = function(req, res) {
  var lim = parseInt(req.params.lim);
  var pageNum = parseInt(req.params.pageNum);
  var time = "";
  Transaction.find({}).lean(true).sort('-blockNumber').skip((pageNum-1)*lim).limit(lim)
        .exec(function (err, txs) {
          //timestamp값 parsing
          for(var i=0; i<lim; i++){
            txs[i].timestamp = getDuration(txs[i].timestamp);
            for(var k = txs[i].timestamp.length-1; k >= 0; k--){
              time = "";
              time += txs[i].timestamp[k].val + " " + txs[i].timestamp[k].label + " ";
            }
            txs[i].timestamp = time;
            txs[i].gasPrice = txs[i].gasPrice.c;
          }
          res.write(JSON.stringify({"txs": txs}));
          res.end();
        });
}


//getBlock
var getBlock = function(req, res){
  var blockNumber = req.params.number.toLowerCase();
  var blockInfo = Block.find({"number":blockNumber}).lean(true);
  var time = "";
  blockInfo.exec(function(err, doc){
    if(!doc){
      console.log("blockNumber missing" + blockNumber);
      res.write(JSON.stringify({}));
      res.end();
    }else {
      doc[0].timestamp = getDuration(doc[0].timestamp);
      for(var i = doc[0].timestamp.length-1; i>=0; i--){
        time += doc[0].timestamp[i].val +" "+ doc[0].timestamp[i].label + " ";
      };
      doc[0].timestamp = time;
      res.write(JSON.stringify(doc));
      res.end();
    }
  });
};


//latestBlock
var latestBlock = function(req, res) {
  var block = Block.findOne({}, "totalDifficulty")
                      .lean(true).sort('-number');
  block.exec(function (err, doc) {
    res.write(JSON.stringify(doc));
    res.end();
  });
};


//blockTransactions
var blockTransactions = function(req, res) {
  var blockNum = parseInt(req.params.blockNum);
  var lim = parseInt(req.params.lim);
  var pageNum = parseInt(req.params.pageNum);
  Transaction.find({"blockNumber": blockNum}, "blockNumber hash").lean(true).sort('-blockNumber').skip((pageNum-1)*lim).limit(lim)
        .exec(function (err, txs) {
          res.write(JSON.stringify({"txs": txs}));
          res.end();
        });
}


//sendBlocks
var sendBlocks = function(req, res) {
  var lim = parseInt(req.params.lim);
  var pageNum = parseInt(req.params.pageNum);
  var kk = "";
  var blockFind = Block.find({}, "number timestamp miner gasUsed gasLimit extraData")
                      .lean(true).sort('-number').skip((pageNum-1)*lim).limit(lim);
  blockFind.exec(function (err, docs) {
    if(!err && docs) {
      var blockNumber = docs[docs.length - 1].number;
      // aggregate transaction counters
      // timestamp값 parsing
      for(var i=0; i<lim; i++){
        docs[i].timestamp = getDuration(docs[i].timestamp);
        for(var k = docs[i].timestamp.length-1; k>=0; k--){
          time = "";
          time += docs[i].timestamp[k].val +" "+ docs[i].timestamp[k].label + " ";
        };
        docs[i].timestamp = time;
      }
      Transaction.aggregate([
        {$match: { blockNumber: { $gte: blockNumber } }},
        {$group: { _id: '$blockNumber', count: { $sum: 1 } }}
      ]).exec(function(err, results) {
        var txns = {}; //객체 Object txns= new Object();
        var time = {};
        if (!err && results) {
          // set transaction counters
          results.forEach(function(txn) {
            txns[txn._id] = txn.count;
            //txns.a= txn.count
          });
          docs.forEach(function(doc) {
            doc.txn = txns[doc.number] || 0;
          });
        }
        res.write(JSON.stringify({"blocks": filters.filterBlocks(docs)}));
        res.end();
      });
    } else {
      console.log("blockFind error:" + err);
      res.write(JSON.stringify({"error": true}));
      res.end();
    }
  });
};


//blockCount
var blockCount = function(req, res){
  var blockCount2 = Block.count({}).then(number => {
                        console.log("blockCount number:"+number);
                        var count = number;
                        parseInt(count);
                        res.write("" + count);
                        res.end();
                });
};


//transactionCount
var transactionCount = function(req, res){
  var transactionCount2 = Transaction.count({}).then(number => {
                        console.log("transactionCount number:"+number);
                        var count = number;
                        parseInt(count);
                        res.write(""+count);
                        res.end();
                });
};


//getEthfBalance
var etherUnits = require(__lib + "etherUnits.js")

var getEthfBalance = function(req, res) {
console.log(req)
console.log(req.params)
  var addr = req.params.addr;
  if (typeof addr !== "undefined")
    addr = addr.toLowerCase();
  else
    res.sendStatus(400);

  var options = {
    host: 'api.blockcypher.com',
    port: '80',
    path: '/v1/eth/main/addrs/' + addr + '/balance',
    method: 'GET'
  };

  var balance = 0;
  http.request(options, function(bcRes) {
    bcRes.on('data', function (data) {
      try {
        balance = JSON.parse(data).balance;
        balance = etherUnits.toEther( balance, "wei");

      } catch (e) {
        console.error("BC err, probably invalid addr");
      }
      res.write(JSON.stringify({"balance": balance}));
      res.end();
    })
  }).end();

};


//getBalance
var getBalance = function(req, res){
  //Create Web3 connection
  if (typeof web3 !== "undefined") {
    web3 = new Web3(web3.currentProvider);
  } else {
    web3 = new Web3(new Web3.providers.HttpProvider('http://'+config.nodeAddr+':'+config.gethPort));
  }
  if (web3.isConnected()){
    console.log("Web3 connection established");
  }else{
    throw "No connection, please specify web3host in conf.json";
  }
  var addr = req.params.addr;
  web3.eth.getBalance(addr, function(error, result) {
    console.log("result::::::"+result);
    res.send(web3._extend.utils.fromWei(result, `ether`));
    res.end();
  });
};



//newAccount
var newAccount = function(req, res){

  if (typeof web3 !== "undefined") {
    web3 = new Web3(web3.currentProvider);
  } else {
    web3 = new Web3(new Web3.providers.HttpProvider('http://'+config.nodeAddr+':'+config.gethPort));
  }
  if (web3.isConnected()){
    console.log("Web3 connection established");
  }else{
    throw "No connection, please specify web3host in conf.json";
  }

  var account = req.params.account
  console.log("account :: " + account);

//  if(!Boolean(fnAcceptIPCHK(fnGetIP(req)))) {
//    res.end(JSON.stringify("비정상적인 접근입니다."));
//  }
//  var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc',net);
  var web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/ethereum_db/geth.ipc', net));
  web3.personal.newAccount(account, function(err, result){
  res.end(result);
  });
};


//ethUnlock
const ethUnlock = async function ethUnlock(_from, passwd) {
	consolog("aaaaaaaaaaaaa");
    var web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/ethereum_db/geth.ipc', net));
console.log("*******"+web3.eth.personal.unlockAccount);
    var passChk = web3.eth.personal.unlockAccount(_from,passwd, 1500);
    console.log("@@@@@@@@@@@"+passChk);
    return passChk;
};


//isAccount
const isAccount = async function isAccount(_to) {
    var web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/ethereum_db/geth.ipc', net));

    var _isAccount = web3._extend.utils.isAddress(_to);
    return _isAccount;
};


//sendTransaction
var sendTransaction = function(req, res){
//  if(!Boolean(fnAcceptIPCHK(fnGetIP(req)))) {
//            res.end(JSON.stringify("비정상적인 접근입니다."));
//        }

  var web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/ethereum_db/geth.ipc', net));

  var passwd = req.body["passwd"];
  var _from = req.body["from"];
  var _to = req.body["to"];
  var _amt = web3._extend.utils.toWei((req.body["amt"]), 'ether');

  console.log("passwd ::"+passwd);
  if(!passwd) {
    console.log("error ----------");
    res.end("{\"result\":\"\", \"code\" :\"-4\", \"message\":\"passwd is null\" }");
    return true;
  }
console.log("from!!!! : "+_from);
  console.log("isAccount start~~");
  isAccount(_to).then(_isAccount => {
    console.log("!@!@!@!@!@!@!@!"+_isAccount)
    if(_isAccount == true) {
console.log('111111111111111111111');
console.log("######"+_from);
console.log("$$$$$$$"+passwd);
      ethUnlock(_from, passwd).then(passChk => {
      console.log("!!!!!!!!!!!! "+passChk);
      if(passChk == true) {
        console.log("password decrypt success");
        console.log("_amt",_amt);
        web3.eth.sendTransaction({
                gasPrice: '0x1c67c44400', //122000000000
                gasLimit: '0xafc8', //45000
                from: _from,
                to: _to,
                value:_amt
              },function (err, txhash) {
                console.log('error: ' + err);
                console.log('txhash: ' + txhash);
                if(err != null) {
                  console.log("result\":\"\", \"code\" :\"-1\", \"message\":\""+err.message.replace(":", "")+"\"" );
                  res.end("{\"result\":\"\", \"code\" :\"-1\", \"message\":\""+err.message.replace(":", "")+"\" }");
                  return true;
                } else {
                  console.log("send success " );
                  res.end("{\"result\":\""+txhash+"\", \"code\" :\"0\", \"message\":\""+txhash+"\" }");
                  return true;
                }
             })
            } else {
              console.log("passwd authentication needed: password or unlockr");
              res.end("{\"result\":\"\", \"code\" :\"-3\", \"message\":\"authentication needed password or unlock\" }");
              return true;
            }

          }).catch(function (err) {
              console.log("{\"result\":\"\", \"code\" :\"-3\", \"message\":\"authentication needed password or unlock\"}");
              res.end("{\"result\":\"\", \"code\" :\"-3\", \"message\":\"authentication needed password or unlock\" }");
              return true;

         });

        } else {
             console.log("\"result\":\"\", \"code\" :\"-2\", \"message\":\"account not vaild\"");
             res.end("{\"result\":\"\", \"code\" :\"-2\", \"message\":\"account not vaild \" }");
             return true;
        }
      });
       console.log("async end");
};

