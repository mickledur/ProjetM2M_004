module.exports = function(RED) {
    "use strict";
	var crypto = require('crypto');
	var https = require('https');

	var globalTierionUserAccessToken = '';
	var globalTierionUserAccessTokenExpireTime = 1;
	var globalTierionUsername = '';
	var globalTierionUserPassword = '';
	var globalTierionUserApiKey = '';

	// Login to Tierion by sending the username and password. 
	// The API call gets back an access_token which lasts n seconds
	var loginToTierionAndVerifyHash = function (receiptId, node, callback) {
	    // If we are already logged in and have an access_token which is valid, then use that
	    if(globalTierionUserAccessTokenExpireTime != undefined 
            && globalTierionUserAccessTokenExpireTime > Date.now() ) {
	        if (node.config.enabledebug == 'true') { node.warn('Already logged in to Tierion'); }
	        sendReceiptIdToTierion(receiptId, serverCredentials, node, function (jsonDataReturned) {
	            // Callback to the main method which called here, returning the Tierion response data
	            callback && callback(jsonDataReturned);
	        });
	    } else {
	        // Not already logged in, so go get an access_token
	        if (node.config.enabledebug == 'true') { node.warn('Not already logged in to Tierion, so doing that now'); }
	        var postData = JSON.stringify({
	            "username": globalTierionUsername,
	            "password": globalTierionUserPassword
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
				        node.warn('blockchain-verify: Failed to login to Tierion. Please check credentials');
				    }
			        sendReceiptIdToTierion(receiptId, node, function (jsonDataReturned) {
				        // Callback to the main method which called here, returning the Tierion response data
				        callback && callback(jsonDataReturned);
				    });
			    });
		    });
		    req.write(postData);
		    req.end();

		    req.on('error', (e) => {
			    this.warn('blockchain-verifyNode error.');
		        this.error(e);
            });
        }
	};
	// END loginToTierion

	
	// Send a hash to Tierion 
    // It requires the configServer.userAccessToken which is gotten via loginToTierion and the hash itself
    // The API call gets back a receipt id which can later be used to verify the hash on the blockchain-verify
	var sendReceiptIdToTierion = function (receiptId, node, callback) {
		// Set the options for the API call later
		var optionsHttps = {
			hostname: 'hashapi.tierion.com',
			port: 443,
			path: '/v1/receipts/' + receiptId,
			method: 'GET',
			dataType: "text",
			processData: false,
			headers: {
			    'Authorization': "Bearer " + globalTierionUserAccessToken,
				'Content-Type': 'application/json; charset=utf-8'
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
				// Here we now have the receipt, containing all the information to verify hash
			    var jsonDataReturned = JSON.parse(dataReturned);
			    // Return the full information to the method which called here
			    callback && callback(jsonDataReturned);
			});
		});
		req.end();

		req.on('error', (e) => {
			this.warn('blockchain-verifyNode sendReceiptIdToTierion error.');
		    this.error(e);
		});
	};
	// END sendReceiptIdToTierion
	

	// Send a receipt to Tierion for it to be validated
	// It requires the receipt data
    var sendReceiptToTierionForValidation = function (receiptToSend, node, callback) {
		var postData = JSON.stringify({
		    'blockchain_receipt': receiptToSend
		});
		// Set the options for the API call later
		var optionsHttps = {
		    hostname: 'api.tierion.com',
		    port: 443,
		    path: '/v1/validatereceipt',
		    method: 'POST',
		    dataType: "text",
		    processData: false,
		    headers: {
		        'X-Username': globalTierionUsername,
		        'X-Api-Key': globalTierionUserApiKey,
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
		        // Here we now have the validation response
		        if(node.config.enabledebug == 'true') { node.warn(dataReturned); }
		        var jsonDataReturned = JSON.parse(dataReturned);
		        // Return the full information to the method which called here
		        callback && callback(jsonDataReturned);
	        });
	    });
	    req.write(postData);
	    req.end();

	    req.on('error', (e) => {
		    this.warn('blockchainNode sendReceiptToTierionForValidation error.');
	        this.error(e);
	    });
	};
    // END sendReceiptToTierionForValidation
	

	
	function blockchainVerifyNode(config) {
		RED.nodes.createNode(this,config);
		var node = this;
		node.config = config;
        // Capture the incoming configuration and hold as global variables within the module
		globalTierionUsername = this.credentials.username;
		globalTierionUserPassword = this.credentials.password;
		globalTierionUserApiKey = this.credentials.apikey;
        if(node.config.enabledebug == 'true') { 
		    node.warn('blockchain-verify config:' + JSON.stringify(config));
	        node.warn('blockchain-verify server credentials:' + JSON.stringify(this.credentials));
	    }
	    
        this.on('input', function(msg) {
            // If the credentials or required inputs were not supplied then fail
            if(globalTierionUserApiKey == undefined || globalTierionUsername == undefined || globalTierionUserPassword == undefined) {
                msg.payload = {};
                msg.payload.blockchainNotice = 'Configuration credentials not supplied';
                msg.payload.result = 'FAIL';
                node.send(msg); // Send all the msg data to the output wire
                return;
            }
            if(msg.payload.tierionReceiptId == undefined) {
                msg.payload = {};
                msg.payload.blockchainNotice = 'Required input (payload.tierionReceiptId) not supplied';
                msg.payload.result = 'FAIL';
                node.send(msg); // Send all the msg data to the output wire
                return;
            }
            // Calculate the hash value for the optional incoming msg.payload.dataToHash, if it exists
            var hashVal = '';
            var hashValHex;
            if(msg.payload.dataToHash != undefined && msg.payload.dataToHash != '') {
                hashVal = crypto.createHash('sha256').update(JSON.stringify(msg.payload.dataToHash));
                hashValHex = hashVal.digest('hex');
                if(node.config.enabledebug == 'true') { node.warn('hash value is: ' + hashValHex); }
            }
			
			loginToTierionAndVerifyHash(msg.payload.tierionReceiptId, node, function(jsonDataReturned) {
			    if(jsonDataReturned.receipt == undefined || jsonDataReturned.receipt.length < 1) {
			        msg.payload.blockchainNotice = 'No receipt received from Tierion using the receiptId and credentials';
			        msg.payload.result = 'FAIL';
			        node.send(msg); // Send all the msg data to the output wire
			        return;
			    } 
                // Now we have the receipt data from Tierion
			    msg.payload.tierionReceipt = JSON.parse(jsonDataReturned.receipt);
			    if(node.config.enabledebug == 'true') { node.warn('receipt data is: ' + JSON.stringify(msg.payload.tierionReceipt)); }

			    // Does the hash in the Tierion receipt match the hash of the payload data incoming?
                // Or if no dataToHash was passed in, therefore just proceed without the hash check
			    if(msg.payload.tierionReceipt.targetHash == hashValHex || hashVal == '') {
			        if(node.config.enabledebug == 'true') { node.warn('blockchain-verify: hash = targetHash'); }
			        // Now we have the receipt, send that to the API for validation
			        sendReceiptToTierionForValidation(jsonDataReturned.receipt, node, function(jsonDataReturnedFromValidation) {
			            msg.com_tierion_validation = jsonDataReturnedFromValidation;

			            if(jsonDataReturnedFromValidation.success == undefined || jsonDataReturnedFromValidation.success.length < 1) {
			                msg.payload.blockchainNotice = 'Validation FAILURE received from Tierion. Perhaps wait 10 mins';
			                msg.payload.result = 'FAIL';
			                node.send(msg); // Send all the msg data to the output wire
			            } else {
                            // The OP_RETURN value of this blockchain transaction will match the MerkleRoot
			                msg.payload.blockchainLocation = 'https://blockexplorer.com/tx/' + msg.payload.tierionReceipt.anchors[0].sourceId;    
			                msg.payload.result = 'PASS';
			                node.send(msg); // Send all the msg data to the output wire
			            }
			        }); // End of sendReceiptToTierionForValidation
			    } else {
			        if(node.config.enabledebug == 'true') { 
			            node.warn(msg.payload.tierionReceipt.targetHash); 
			            node.warn(hashValHex); 
			        }
			        msg.payload.blockchainNotice = 'FAIL: hash of data does not match targetHash of Tierion receipt';
			        msg.payload.result = 'FAIL';        
			        node.send(msg); // Send all the msg data to the output wire
			    }
			    
			}); // End of loginToTierionAndVerifyHash
			
        }); // End of this.on('input')
	}; // End of blockchainVerifyNode

	RED.nodes.registerType("blockchainVerify",blockchainVerifyNode,{
	    credentials: {
	        username: {type:"text"},
	        password: {type:"password"},
	        apikey: {type:"text"}
	    }
	});
	
}
