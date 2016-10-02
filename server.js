
var express = require('express');

var app = express();

app.use(express.static(__dirname + ''));

const pg = require('pg');

var conString = "postgres://cjifxbukmqsnwd:KKtKvBLNxHopLgmjzR5XFqGhmU@ec2-54-83-205-164.compute-1.amazonaws.com:5432/ddshvknkjjo1pe?ssl=true";
//var conString = "postgres://chatme:L37sCH47@localhost:5432/chatme";

var server = app.listen(process.env.PORT || 8080, function () {
    console.log('listening on PORT:',server.address().port,'...');
});

app.post('/register', function (req, res) {
    var login = req.query.login;
    var password = req.query.password;
    var confirm = req.query.confirm;

    if (password != confirm){
        res.send({result : false, message: 'password and confirm do not match'});
        return;
    }

    if (!login || !password || !confirm){
        res.send({result : false, message: 'must fill all fields'});
        return;
    }

    var userExists = false;

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login from ddshvknkjjo1pe.public.chatmeusr where login = $1",
        values: [login]
    })
    
    checkUserquery.on('row', function (row){
        userExists = true;
    })

    checkUserquery.on('end', function() {
        if (!userExists){
            var query = client.query({
                name: 'insert user',
                text: "INSERT INTO ddshvknkjjo1pe.public.chatmeusr(login, password) values($1,$2)",
                values: [login,password]
            })

            query.on('end', function() {
                client.end();
                res.send({ result : true });
            });
        }
        else{
            client.end();
            res.send({result : false, message: 'user already exists' });
        }
    });
});

app.post('/login', function (req, res) {
    var login = req.query.login;
    var password = req.query.password;

    if (!login || !password){
        res.send({result : false, message: 'must fill all fields'});
        return;
    }

    var userExists = false;
    var passwordIsCorrect = false;

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login, password from ddshvknkjjo1pe.public.chatmeusr where login = $1",
        values: [login]
    })
    
    checkUserquery.on('row', function (row){
        userExists = true;
        
        if (row.password == password){
            passwordIsCorrect = true;
        }
    })

    checkUserquery.on('end', function() {
        client.end();
        
        if (!userExists){
            res.send({result : false, message: 'user not found' });
        }
        else{
            if(!passwordIsCorrect){
                res.send({result : false, message: 'wrong password' });
            }
            else{
                res.send({result : true });
            }
        }
    });
});

app.post('/search', function (req, res) {
    var login = req.query.login;

    if (!login){
        res.send({result : false, message: 'must fill all fields'});
        return;
    }

    var results = [];

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login from ddshvknkjjo1pe.public.chatmeusr where login like $1",
        values: ['%' + login + '%']
    })
    
    checkUserquery.on('row', function (row){
        results.push(row);
    })

    checkUserquery.on('end', function() {
        client.end();
        
        res.send(results);
    });
});
