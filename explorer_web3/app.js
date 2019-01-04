var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require("fs")

app.set('views', __dirname + '/views');
console.log(__dirname);
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

var server = app.listen(9000,'1.223.21.115', function(){
  console.log("Express server has started on port 9000")
});

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var router = require('./routes/index')(app, fs);  
