'use strict';

var log4js = require('log4js');
var logger = log4js.getLogger('SampleWebApp');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');
const prometheus = require('prom-client')

require('./config.js');
var hfc = require('fabric-client');
var path = require('path');
var helper = require('./app/helper.js');
var createChannel = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var invoke = require('./app/invoke-transaction.js');
var query = require('./app/query.js');
var host = process.env.HOST || hfc.getConfigSetting('host');
var port = process.env.PORT || hfc.getConfigSetting('port');
var hbs = require('express-handlebars');
var session = require('express-session');
var userHelper = require('./helpers/user-helpers')
var db = require('./config/connection')
const Swal = require('sweetalert2')

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.engine('hbs', hbs({ extname: 'hbs', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layout/', partialsDir: __dirname + '/views/partials' }))

app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(express.static(path.join(__dirname, 'public')));
//set secret variable
app.set('secret', 'thisismysecret');
app.use(session({ secret: "Key", cookie: { maxAge: 600000000 } }))


///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  http://%s:%s  ******************', host, port);
server.timeout = 240000;

function getErrorMessage(field) {
    var response = {
        success: false,
        message: field + ' field is missing or Invalid in the request'
    };
    return response;
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Register and enroll user

//db connection
db.connect((err) => {
    if (err)
        console.log("Connection Error" + err)
    else
        console.log("Database connected.!")


})

//verifylogin
const verifyLogin = (req, res, next) => {
    if (req.session.loggedIn) {
        next()
    } else {
        res.redirect('/newlogin')
    }
}

/* GET users listing. */
app.get('/', function(req, res, next) {
    res.render('index', { title: 'Decentralized Data Valut' });
});
//User login
//app.get('/login', (req, res) => {
//      res.render('user/login')
//})
//User Regisitration
app.get('/newregister', (req, res) => {
    res.render('user/newregister')
})

app.get('/newlogin', (req, res) => {
    res.render('user/newlogin')
})


app.post('/newregister', (req, res) => {
    //console.log(req.body)
    userHelper.doNewRegister(req.body).then((response) => {
        console.log(response)
        req.session.loggedIn = true
        req.session.username = response.username
        res.redirect('/newlogin')

    })
})

app.get('/networkenroll', verifyLogin, (req, res) => {
    res.render('user/networkenroll')
})

app.post('/newlogin', (req, res) => {
    userHelper.doNewLogin(req.body).then((response) => {
        //console.log(response.user.Username)
        if (response.loginStatus) {
            req.session.loggedIn = true
            req.session.user = response.user
            res.render('user/networkenroll', { "Username": response.user.Username, "OrgName": response.user.OrgName, "user": req.session.user })
        } else {
            req.session.loginErr = true
            res.render('user/newlogin', { "loginErr": req.session.loginErr })
        }
    })

})



//View Transactions
app.get('/transaction', verifyLogin, (req, res) => {
    res.render('user/transaction')
})

app.get('/logout', verifyLogin, (req, res) => {
    req.session.destroy()
    res.redirect('/newlogin')
})





app.post('/users', verifyLogin, async function(req, res) {
    var username = req.body.username;
    var orgName = req.body.orgName;
    logger.debug('End point : /users');
    logger.debug('User name : ' + username);
    logger.debug('Org name  : ' + orgName);
    if (!username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!orgName) {
        res.json(getErrorMessage('\'orgName\''));
        return;
    }
    var token = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
        username: username,
        orgName: orgName
    }, app.get('secret'));
    let response = await helper.getRegisteredUser(username, orgName, true);
    logger.debug('-- returned from registering the username %s for organization %s', username, orgName);
    if (response && typeof response !== 'string') {
        logger.debug('Successfully registered the username %s for organization %s', username, orgName);
        response.token = token;
        req.session.username = username;
        req.session.token = response.token;
        req.session.orgName = orgName;



        //logger.debug(req.session.token, "Token Geo")

        //res.json(response);
        //console.log(response)
        //Render to Userhome page !
        //req.session.token=response.token

        res.render('user/userHome', { "user": req.session.username, "token": req.session.token })
    } else {
        logger.debug('Failed to register the username %s for organization %s with::%s', username, orgName, response);
        res.json({ success: false, message: response });
    }

});


//add new data

app.get('/adddatatovalut', verifyLogin, (req, res) => {
    console.log("Add data to Valut .....")
    res.render('user/adddatatovalut', { "user": req.session.username, "token": req.session.token })
})


// app.use(expressJWT({
//     secret: 'thisismysecret'
// }).unless({
//     path: ['/users', '/metrics']
// }));


// app.use(bearerToken());
// app.use(function(req, res, next) {
//     logger.debug(' ------>>>>>> new request for %s', req.originalUrl);
//     if (req.originalUrl.indexOf('/users') >= 0 || req.originalUrl.indexOf('/metrics') >= 0) {
//         return next();
//     }

//     var token = req.token;
//     jwt.verify(token, app.get('secret'), function(err, decoded) {
//         if (err) {
//             res.send({
//                 success: false,
//                 message: 'Failed to authenticate token. Make sure to include the ' +
//                     'token returned from /users call in the authorization header ' +
//                     ' as a Bearer token'
//             });
//             return;
//         } else {
//             // add the decoded user name and org name to the request object
//             // for the downstream code to use
//             req.username = decoded.username;
//             req.orgname = decoded.orgName;
//             logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.username, decoded.orgName));
//             return next();
//         }
//     });
// });


// Swal.fire({
//         position: 'top-end',
//         icon: 'success',
//         title: 'Your work has been saved',
//         showConfirmButton: false,
//         timer: 1500
//     })
// // Create Channel
// app.post('/channels', async function(req, res) {
//     logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
//     logger.debug('End point : /channels');
//     var channelName = req.body.channelName;
//     var channelConfigPath = req.body.channelConfigPath;
//     logger.debug('Channel name : ' + channelName);
//     logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
//     if (!channelName) {
//         res.json(getErrorMessage('\'channelName\''));
//         return;
//     }
//     if (!channelConfigPath) {
//         res.json(getErrorMessage('\'channelConfigPath\''));
//         return;
//     }

//     let message = await createChannel.createChannel(channelName, channelConfigPath, req.username, req.orgname);
//     res.send(message);
// });
// // Join Channel
// app.post('/channels/:channelName/peers', async function(req, res) {
//     logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
//     var channelName = req.params.channelName;
//     var peers = req.body.peers;
//     logger.debug('channelName : ' + channelName);
//     logger.debug('peers : ' + peers);
//     logger.debug('username :' + req.username);
//     logger.debug('orgname:' + req.orgname);

//     if (!channelName) {
//         res.json(getErrorMessage('\'channelName\''));
//         return;
//     }
//     if (!peers || peers.length == 0) {
//         res.json(getErrorMessage('\'peers\''));
//         return;
//     }

//     let message = await join.joinChannel(channelName, peers, req.username, req.orgname);
//     res.send(message);
// });
// // Install chaincode on target peers
// app.post('/chaincodes', async function(req, res) {
//     logger.debug('==================== INSTALL CHAINCODE ==================');
//     var peers = req.body.peers;
//     var chaincodeName = req.body.chaincodeName;
//     var chaincodePath = req.body.chaincodePath;
//     var chaincodeVersion = req.body.chaincodeVersion;
//     var chaincodeType = req.body.chaincodeType;
//     logger.debug('peers : ' + peers); // target peers list
//     logger.debug('chaincodeName : ' + chaincodeName);
//     logger.debug('chaincodePath  : ' + chaincodePath);
//     logger.debug('chaincodeVersion  : ' + chaincodeVersion);
//     logger.debug('chaincodeType  : ' + chaincodeType);
//     if (!peers || peers.length == 0) {
//         res.json(getErrorMessage('\'peers\''));
//         return;
//     }
//     if (!chaincodeName) {
//         res.json(getErrorMessage('\'chaincodeName\''));
//         return;
//     }
//     if (!chaincodePath) {
//         res.json(getErrorMessage('\'chaincodePath\''));
//         return;
//     }
//     if (!chaincodeVersion) {
//         res.json(getErrorMessage('\'chaincodeVersion\''));
//         return;
//     }
//     if (!chaincodeType) {
//         res.json(getErrorMessage('\'chaincodeType\''));
//         return;
//     }
//     let message = await install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, chaincodeType, req.username, req.orgname)
//     res.send(message);
// });
// // Instantiate chaincode on target peers
// app.post('/channels/:channelName/chaincodes', async function(req, res) {
//     logger.debug('==================== INSTANTIATE CHAINCODE ==================');
//     var peers = req.body.peers;
//     var chaincodeName = req.body.chaincodeName;
//     var chaincodeVersion = req.body.chaincodeVersion;
//     var channelName = req.params.channelName;
//     var chaincodeType = req.body.chaincodeType;
//     var fcn = req.body.fcn;
//     var args = req.body.args;
//     logger.debug('peers  : ' + peers);
//     logger.debug('channelName  : ' + channelName);
//     logger.debug('chaincodeName : ' + chaincodeName);
//     logger.debug('chaincodeVersion  : ' + chaincodeVersion);
//     logger.debug('chaincodeType  : ' + chaincodeType);
//     logger.debug('fcn  : ' + fcn);
//     logger.debug('args  : ' + args);
//     if (!chaincodeName) {
//         res.json(getErrorMessage('\'chaincodeName\''));
//         return;
//     }
//     if (!chaincodeVersion) {
//         res.json(getErrorMessage('\'chaincodeVersion\''));
//         return;
//     }
//     if (!channelName) {
//         res.json(getErrorMessage('\'channelName\''));
//         return;
//     }
//     if (!chaincodeType) {
//         res.json(getErrorMessage('\'chaincodeType\''));
//         return;
//     }
//     if (!args) {
//         res.json(getErrorMessage('\'args\''));
//         return;
//     }

//     let message = await instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodeVersion, chaincodeType, fcn, args, req.username, req.orgname);
//     res.send(message);
// });



// // Invoke transaction on chaincode on target psudo apt-get dist-upgradeeers
app.post('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res, next) {
    console.log(req.body)
        //console.log(req.session.username)
    const arg = [req.body.Id, req.body.Data_Id, req.body.Email, req.body.Phone, req.session.username]
    const peer = [req.body.peer0, req.body.peer1]
        //console.log(arg)
        //console.log(peer)

    try {
        logger.debug('==================== INVOKE ON CHAINCODE ==================');
        var peers = peer
        var args = arg
        var chaincodeName = req.body.chaincodeName;
        var channelName = req.body.channelName;
        var fcn = req.body.fcn;
        var username = req.session.username;
        var orgName = req.session.orgName;
        logger.debug('Username:' + username);
        logger.debug('OrgName:' + orgName);
        logger.debug('channelName  : ' + channelName);
        logger.debug('chaincodeName : ' + chaincodeName);
        logger.debug('fcn  : ' + fcn);
        logger.debug('args  : ' + args);
        if (!chaincodeName) {
            res.json(getErrorMessage('\'chaincodeName\''));
            return;
        }
        if (!channelName) {
            res.json(getErrorMessage('\'channelName\''));
            return;
        }
        if (!fcn) {
            res.json(getErrorMessage('\'fcn\''));
            return;
        }
        if (!args) {
            res.json(getErrorMessage('\'args\''));
            return;
        }

        const start = Date.now();
        let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, username, orgName);
        const latency = Date.now() - start;


        const response_payload = {
            result: message,
            error: null,
            errorData: null
        }
        res.render('user/adddatasuccess', { 'result': response_payload, 'user': req.session.username, 'token': req.session.token })
        console.log(response_payload)
            //res.send(response_payload);

    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.render('user/adddataerror', { 'result': response_payload, 'user': req.session.username, 'token': req.session.token })
            //res.send(response_payload);

    }

});


// // Query on chaincode on target peers
// app.get('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
//     logger.debug('==================== QUERY BY CHAINCODE ==================');
//     var channelName = req.params.channelName;
//     var chaincodeName = req.params.chaincodeName;
//     let args = req.query.args;
//     let fcn = req.query.fcn;
//     let peer = req.query.peer;

//     logger.debug('channelName : ' + channelName);
//     logger.debug('chaincodeName : ' + chaincodeName);
//     logger.debug('fcn : ' + fcn);
//     logger.debug('args : ' + args);

//     if (!chaincodeName) {
//         res.json(getErrorMessage('\'chaincodeName\''));
//         return;
//     }
//     if (!channelName) {
//         res.json(getErrorMessage('\'channelName\''));
//         return;
//     }
//     if (!fcn) {
//         res.json(getErrorMessage('\'fcn\''));
//         return;
//     }
//     if (!args) {
//         res.json(getErrorMessage('\'args\''));
//         return;
//     }
//     args = args.replace(/'/g, '"');
//     args = JSON.parse(args);
//     logger.debug(args);

//     let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
//     res.send(message);
// });

// //  Query Get Block by BlockNumber
// app.get('/channels/:channelName/blocks/:blockId', async function(req, res) {
//     logger.debug('==================== GET BLOCK BY NUMBER ==================');
//     let blockId = req.params.blockId;
//     let peer = req.query.peer;
//     logger.debug('channelName : ' + req.params.channelName);
//     logger.debug('BlockID : ' + blockId);
//     logger.debug('Peer : ' + peer);
//     if (!blockId) {
//         res.json(getErrorMessage('\'blockId\''));
//         return;
//     }

//     let message = await query.getBlockByNumber(peer, req.params.channelName, blockId, req.username, req.orgname);
//     res.send(message);
// });

// // Query Get Transaction by Transaction ID
// app.get('/channels/:channelName/transactions/:trxnId', async function(req, res) {
//     logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
//     logger.debug('channelName : ' + req.params.channelName);
//     let trxnId = req.params.trxnId;
//     let peer = req.query.peer;
//     if (!trxnId) {
//         res.json(getErrorMessage('\'trxnId\''));
//         return;
//     }

//     let message = await query.getTransactionByID(peer, req.params.channelName, trxnId, req.username, req.orgname);
//     res.send(message);
// });
// // Query Get Block by Hash
// app.get('/channels/:channelName/blocks', async function(req, res) {
//     logger.debug('================ GET BLOCK BY HASH ======================');
//     logger.debug('channelName : ' + req.params.channelName);
//     let hash = req.query.hash;
//     let peer = req.query.peer;
//     if (!hash) {
//         res.json(getErrorMessage('\'hash\''));
//         return;
//     }

//     let message = await query.getBlockByHash(peer, req.params.channelName, hash, req.username, req.orgname);
//     res.send(message);
// });
// //Query for Channel Information
// app.get('/channels/:channelName', async function(req, res) {
//     logger.debug('================ GET CHANNEL INFORMATION ======================');
//     logger.debug('channelName : ' + req.params.channelName);
//     let peer = req.query.peer;

//     let message = await query.getChainInfo(peer, req.params.channelName, req.username, req.orgname);
//     res.send(message);
// });
// //Query for Channel instantiated chaincodes
// app.get('/channels/:channelName/chaincodes', async function(req, res) {
//     logger.debug('================ GET INSTANTIATED CHAINCODES ======================');
//     logger.debug('channelName : ' + req.params.channelName);
//     let peer = req.query.peer;

//     let message = await query.getInstalledChaincodes(peer, req.params.channelName, 'instantiated', req.username, req.orgname);
//     res.send(message);
// });
// // Query to fetch all Installed/instantiated chaincodes
// app.get('/chaincodes', async function(req, res) {
//     var peer = req.query.peer;
//     var installType = req.query.type;
//     logger.debug('================ GET INSTALLED CHAINCODES ======================');

//     let message = await query.getInstalledChaincodes(peer, null, 'installed', req.username, req.orgname)
//     res.send(message);
// });
// // Query to fetch channels
// app.get('/channels', async function(req, res) {
//     logger.debug('================ GET CHANNELS ======================');
//     logger.debug('peer: ' + req.query.peer);
//     var peer = req.query.peer;
//     if (!peer) {
//         res.json(getErrorMessage('\'peer\''));
//         return;
//     }
//     var path = require('path');

//     let message = await query.getChannels(peer, req.username, req.orgname);
//     res.send(message);
// });


module.exports = app