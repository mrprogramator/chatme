
var express = require('express');

var app = express();

app.use(express.static(__dirname + ''));

const pg = require('pg');

var conString = "postgres://cjifxbukmqsnwd:KKtKvBLNxHopLgmjzR5XFqGhmU@ec2-54-83-205-164.compute-1.amazonaws.com:5432/ddshvknkjjo1pe?ssl=true";
//var conString = "postgres://chatme:L37sCH47@localhost:5432/chatme";

var bcrypt = require('bcrypt');
const saltRounds = 10;

var http = require('http').Server(app);
var io = require('socket.io')(http);

http.listen(process.env.PORT || 8080, function(){
  console.log('listening on :', process.env.PORT || 8080);
});

io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('register-socket', function(login) {
        console.log(login, socket.id);
        var client = new pg.Client(conString);
        client.connect();
        
        var addSocketquery = client.query({
            name: 'register socket id',
            text: "update ddshvknkjjo1pe.public.chatmeusr set socketid=$2 where login = $1",
            values: [login, socket.id]
        })

        addSocketquery.on('end', function (){
            client.end();
        })
    });
});

app.post('/msg', function (req, res){
    var login = req.query.login;
    login = login.toLowerCase();
    var messages = [];
    
    var client = new pg.Client(conString);
    client.connect();

    var getMsg = client.query({
        name: 'get msg',
        text: "select login, contact, msgtxt from ddshvknkjjo1pe.public.chatmemsg "
                +"where contact = $1",
        values: [login]
    })

    getMsg.on('row', function (row) {
        messages.push({
            login: row.login,
            contact: row.contact,
            text: row.msgtxt
        });
    })

    getMsg.on('end', function () {
        var delMsg = client.query({
            name: 'delete msg',
            text: "delete from ddshvknkjjo1pe.public.chatmemsg "
                    +"where contact = $1",
            values: [login]
        })

        delMsg.on('end', function () {
            client.end();
            res.send(messages);
        })
    })
})

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

    login = login.toLowerCase();

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
            bcrypt.hash(password, saltRounds, function(err, hash) {
                var query = client.query({
                    name: 'insert user',
                    text: "INSERT INTO ddshvknkjjo1pe.public.chatmeusr(login, password) values($1,$2)",
                    values: [login,hash]
                })

                query.on('end', function() {
                    client.end();
                    res.send({ result : true });
                });
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
    var hash = "";

    login = login.toLowerCase();

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login, password from ddshvknkjjo1pe.public.chatmeusr where login = $1",
        values: [login]
    })
    
    checkUserquery.on('row', function (row){
        userExists = true;
        hash = row.password;
        
    })

    checkUserquery.on('end', function() {
        client.end();
        
        if (!userExists){
            res.send({result : false, message: 'user not found' });
        }
        else{
            bcrypt.compare(password, hash, function(err, passwordIsCorrect) {
                if(!passwordIsCorrect){
                    res.send({result : false, message: 'wrong password' });
                }
                else{
                    res.send({result : true });
                }
            });
            
        }
    });
});

app.post('/search', function (req, res) {
    var login = req.query.login;
    var searchText = req.query.searchText;

    login = login.toLowerCase();

    if (!searchText){
        res.send({result : false, message: 'must fill all fields'});
        return;
    }

    var results = [];

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login from ddshvknkjjo1pe.public.chatmeusr where login like $1",
        values: ['%' + searchText + '%']
    })
    
    checkUserquery.on('row', function (row){
        if(row.login != login){
            results.push(row);
        }
    })

    checkUserquery.on('end', function() {

        var getContactsquery = client.query({
            name: 'get contacts',
            text: "SELECT contact from ddshvknkjjo1pe.public.chatmecont where login = $1",
            values: [login]
        })

        getContactsquery.on('row', function (row){
            var contactAdded = results.filter(function (r) { return r.login == row.contact })[0];

            if (contactAdded){
                contactAdded.added = true;
            }
        })

        getContactsquery.on('end', function () {
            client.end();
            res.send(results);
        })
    });
});

app.post('/add', function (req, res) {
    var login = req.query.login;
    var contact = req.query.contact;

    login = login.toLowerCase();

    if (!login || !contact){
        res.send({result : false, message: 'missing fields'});
        return;
    }

    var results = [];
    var userExists = false;

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "SELECT login, contact from ddshvknkjjo1pe.public.chatmecont"
                +" where login = $1 AND contact = $2",
        values: [login, contact]
    })
    
    checkUserquery.on('row', function (row){
        userExists = true;
    })

    checkUserquery.on('end', function() {
        if (!userExists){
            var query = client.query({
                name: 'insert contact',
                text: "INSERT INTO ddshvknkjjo1pe.public.chatmecont(login, contact) values($1,$2)",
                values: [login, contact]
            })

            query.on('end', function() {
                client.end();
                res.send({ result : true });
            });
        }
        else{
            client.end();
            res.send({result : false, message: 'contact already added' });
        }
    });
});

app.post('/remove', function (req, res) {
    var login = req.query.login;
    var contact = req.query.contact;

    login = login.toLowerCase();
    
    if (!login || !contact){
        res.send({result : false, message: 'missing fields'});
        return;
    }

    var results = [];

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "delete from ddshvknkjjo1pe.public.chatmecont"
                +" where (login = $1 AND contact = $2)",
        values: [login, contact]
    })
    
    checkUserquery.on('row', function (row){
    })

    checkUserquery.on('end', function() {
        client.end();
        res.send({result : true });
    });
});

app.post('/contacts', function (req, res) {
    var login = req.query.login;

    login = login.toLowerCase();

    if (!login){
        res.send({result : false, message: 'missing fields'});
        return;
    }

    var results = [];

    var client = new pg.Client(conString);
    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "select contact from ddshvknkjjo1pe.public.chatmecont"
                +" where login = $1",
        values: [login]
    })
    
    checkUserquery.on('row', function (row){
        results.push(row);
    })

    checkUserquery.on('end', function() {
        client.end();
        res.send(results);
    });
});

app.post('/send', function (req, res) {
    var login = req.query.login;
    var contact = req.query.contact;

    var text = req.query.text;

    if (!login || !contact){
        res.send(false);
        return;
    }

    login = login.toLowerCase();
    
    var message = {
        login: login,
        contact: contact,
        text: text
    }

    var client = new pg.Client(conString);

    var socketId = "";

    client.connect();
    
    var checkUserquery = client.query({
        name: 'check user',
        text: "select socketid from ddshvknkjjo1pe.public.chatmeusr"
                +" where login = $1",
        values: [contact]
    })

    checkUserquery.on('row', function (row){
        socketId = row.socketid;
    })

    checkUserquery.on('end', function() {
        var currentClient = io.sockets.connected[socketId];

        if (currentClient){
            currentClient.emit('new-msg', message);
            res.send(true);
        }
        else{
            var saveMsg = client.query({
                name: 'save msg',
                text: "insert into ddshvknkjjo1pe.public.chatmemsg "
                        +"(login, contact, msgtxt) values($1,$2, $3)",
                values: [message.login, message.contact, message.text]
            })

            saveMsg.on('end', function () {
                client.end();
                res.send(false);
            })
        }
    });

    
});
