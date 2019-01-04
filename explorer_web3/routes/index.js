var http = require('http');
var fs = require('fs');
//var CONSTS = require('../const/accetInfoConst');

var async = require('async');
var Web3 = require('web3');
var web3;
var net = require('net');

module.exports = function(app, fs) {
  app.get('/newAccount/:account', newAccount);
  app.post('/sendTransaction', sendTransaction);
  app.get('/getBalance/:addr', getBalance);
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


//newAccount
var newAccount = function(req, res){

  var account = req.params.account
  console.log("account :: " + account);

//  if(!Boolean(fnAcceptIPCHK(fnGetIP(req)))) {
//    res.end(JSON.stringify("비정상적인 접근입니다."));
//  }
  var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc',net);
//  var web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/ethereum_db/geth.ipc', net));
  web3.eth.personal.newAccount(account, function(err, result){
     if(err){
	console.log(err);
     }else{
	res.end(result);
     }
  });
};


//ethUnlock
var ethUnlock = async function ethUnlock(_from, passwd) {
    var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc', net);
    var passChk = web3.eth.personal.unlockAccount(_from,passwd, 1500);
    return passChk;
};


//isAccount
var isAccount = async function isAccount(_to) {
    var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc', net);

    var _isAccount = web3.utils.isAddress(_to);
    return _isAccount;
};


//sendTransaction
var sendTransaction = function(req, res){
//  if(!Boolean(fnAcceptIPCHK(fnGetIP(req)))) {
//            res.end(JSON.stringify("비정상적인 접근입니다."));
//        }

  var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc', net);

  var passwd = req.body["passwd"];
  var _from = req.body["from"];
  var _to = req.body["to"];
  var _amt = web3.utils.toWei((req.body["amt"]), 'ether');

  console.log("passwd ::"+passwd);
  if(!passwd) {
    console.log("error ----------");
    res.end("{\"result\":\"\", \"code\" :\"-4\", \"message\":\"passwd is null\" }");
    return true;
  }
console.log("from!!!! : "+_from);
  console.log("isAccount start~~");
  isAccount(_to).then(_isAccount => {
    if(_isAccount == true) {
      ethUnlock(_from, passwd).then(passChk => {
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
	      console.log(err);
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


//getBalance
var getBalance = function(req, res){
  var web3 = new Web3('/home/ethereum/ethereum_db/geth.ipc', net);
  var addr = req.params.addr;
  web3.eth.getBalance(addr, function(error, result) {
    if(error){
	res.end(error);
    }else{
	console.log("balance : "+result);
	res.send(web3.utils.fromWei(result, `ether`));
	res.end();
    }
  });
};

