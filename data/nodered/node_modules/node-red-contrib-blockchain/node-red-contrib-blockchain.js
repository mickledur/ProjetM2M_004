module.exports = function(RED) {
    "use strict";
	var crypto = require('crypto');
	var https = require('https');

	var globalTierionUserAccessToken = '';
	var globalTierionUserAccessTokenExpireTime = 1;

	// Login to Tierion by sending the username and password. 
	// The API call gets back an access_token which lasts n seconds
	var loginToTierionAndSendHash = function (hashToSend, serverCredentials, node, callback) {
	    // If we are already logged in and have an access_token which is valid, then use that
	    if(globalTierionUserAccessTokenExpireTime != undefined 
            && globalTierionUserAccessTokenExpireTime > Date.now() ) {
	        if (node.config.enabledebug == 'true') { node.warn('Already logged in to Tierion'); }
	        sendHashToTierion(hashToSend, serverCredentials, node, function (jsonDataReturned) {
	            // Callback to the main method which called here, returning the Tierion response data
	            callback && callback(jsonDataReturned);
	        });
	    } else {
	        // Not already logged in, so go get an access_token
	        if (node.config.enabledebug == 'true') { node.warn('Not already logged in to Tierion, so doing that now'); }
	        var postData = JSON.stringify({
	            "username": serverCredentials.username,
	            "password": serverCredentials.password
	        });
	        // Set the options for the API call later
	        var optionsHttps = {
	            hostname: 'hashapi.tierion.com',
	            port: 443,
	            path: '/v1/auth/token',
	            method: 'POST',
	            dataType: "text",
	            processData: false,
	            headers: {
	                'Content-Type': 'application/json; charset=utf-8',
	                'Content-Length': Buffer.byteLength(postData)
	            }
	        };
	        // Make the API call to Tierion
	        var req = https.request(optionsHttps, (res) => {
	            // console.log('Login response statusCode: ', res.statusCode); }    // For Dev use
	            // console.log('Login response headers: ', res.headers); }          // For Dev use
                // Data is returned via a buffer so collect it all before the end signal is received
			    var dataReturned = "";
			    res.on('data', (d) => {
				    dataReturned += d;
			    });
			    res.on("end", function () {
				    // API call has now returned
				    // Now have the access_token and refresh_token in order to make a Tierion call
                    // Store the access_token information as it can be used for later calls
			        globalTierionUserAccessToken = JSON.parse(dataReturned).access_token;
			        globalTierionUserAccessTokenExpireTime = Date.now() + (JSON.parse(dataReturned).expires_in * 1000);
			        if(globalTierionUserAccessToken== undefined) {
				        node.warn('blockchain: Failed to login to Tierion. Please check credentials');
				    }
				    sendHashToTierion(hashToSend, serverCredentials, node, function (jsonDataReturned) {
				        // Callback to the main method which called here, returning the Tierion response data
				        callback && callback(jsonDataReturned);
				    });
			    });
		    });
		    req.write(postData);
		    req.end();

		    req.on('error', (e) => {
			    this.warn('blockchainNode error.');
		        this.error(e);
            });
        }
	};
	// END loginToTierion

	
	// Send a hash to Tierion 
    // It requires the configServer.userAccessToken which is gotten via loginToTierion and the hash itself
    // The API call gets back a receipt id which can later be used to verify the hash on the blockchain
	var sendHashToTierion = function (hashToSend, serverCredentials, node, callback) {
	    var postData = JSON.stringify({
	        'hash': hashToSend
	    });
		// Set the options for the API call later
		var optionsHttps = {
			hostname: 'hashapi.tierion.com',
			port: 443,
			path: '/v1/hashitems',
			method: 'POST',
			dataType: "text",
			processData: false,
			headers: {
			    'Authorization': "Bearer " + globalTierionUserAccessToken,
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Length': Buffer.byteLength(postData)
			}
		};
		// Make the API call to Tierion
		var req = https.request(optionsHttps, (res) => {
			var dataReturned = "";
			res.on('data', (d) => {
				dataReturned += d;
			});
			res.on("end", function () {
				// API call has now returned
				// Here we now have the receiptId
			    if(node.config.enabledebug == 'true') { node.warn(dataReturned); }
			    var jsonDataReturned = JSON.parse(dataReturned);
			    // Add the hash value which was originally sent to Tierion to the data object
			    jsonDataReturned.com_tierion_hash = hashToSend;
			    // Return the full information to the method which called here
			    callback && callback(jsonDataReturned);
			});
		});
		req.write(postData);
		req.end();

		req.on('error', (e) => {
			this.warn('blockchainNode sendHashToTierion error.');
		    this.error(e);
		});
	};
	// END sendHashToTierion
	
	
	function blockchainNode(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.config = config;
		this.serverCredentials = this.credentials;
		if(node.config.enabledebug == 'true') { 
		    node.warn('blockchain config:' + JSON.stringify(config));
	        node.warn('blockchain server credentials:' + JSON.stringify(this.serverCredentials));
	    }
		
		this.on('input', function(msg) {
		    // Calculate the hash value for the incoming msg.payload
			var hashVal = crypto.createHash('sha256').update(JSON.stringify(msg.payload));
			var hashValHex = hashVal.digest('hex');
			if(node.config.enabledebug == 'true') { 
			    node.warn('data value is: ' + JSON.stringify(msg.payload)); 
			    node.warn('hash value is: ' + hashValHex); 
			}
			loginToTierionAndSendHash(hashValHex, this.serverCredentials, node, function(jsonDataReturned) {
			    // Construct the outgoing msg.payload as an array with all the information
			    var incomingPayloadData = msg.payload;
			    msg.payload = {};
			    msg.payload.dataToHash = incomingPayloadData;

			    if(jsonDataReturned.receiptId == undefined || jsonDataReturned.receiptId.length < 1) {
			        msg.payload.blockchainNotice = 'no receiptId received from Tierion';
			        msg.payload.result = 'FAIL';
			        node.send(msg); // Send all the msg data to the output wire
			        return;
			    }
			    // Add the Tierion receiptId and Hash to the msg object - for use when verifying the stamp on the blockchain
			    msg.payload.tierionHashHex = hashValHex;
			    msg.payload.tierionReceiptId = jsonDataReturned.receiptId;
			    msg.payload.tierionTimestamp = jsonDataReturned.timestamp;
			    msg.payload.result = 'PASS';
			    // Send all the msg data to the output wire
			    // msg now contains original msg.payload with the Tierion data as extra params beside the payload.
			    node.send(msg);
			}); 
			
		});
	};

	RED.nodes.registerType("blockchain",blockchainNode,{
	    credentials: {
	        username: {type:"text"},
	        password: {type:"password"}
	    }
	});
	
}
