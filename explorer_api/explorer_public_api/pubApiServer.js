require( './db' );

var express = require('express');
var path = require('path');
var fs = require('fs');
var logger = require('morgan');
var bodyParser = require('body-parser');
var app = express();

var server = app.listen(3100,'10.10.10.4', function(){
    console.log("Express server has started on port 3100")
});

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var router = require('./router')(app, fs);