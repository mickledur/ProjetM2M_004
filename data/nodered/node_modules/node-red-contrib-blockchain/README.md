# node-red-contrib-blockchain

** A Node-Red node to stamp your data on the blockchain via [Tierion.com](http://www.Tierion.com) **


# What it is

An easy-to-use node for stamping a hash of your data on the blockchain, thus providing an incontrovertible proof-of-existence. This node uses Tierion.com API to stamp the hash of incoming data onto the blockchain direct from Node-Red.


# Key Features:

   * Drag and drop on node-red
   * Fully configurable
   * Produce irrefutable proof and a verifiable, immutable record

   
## Installation

	npm install node-red-contrib-blockchain
	
	- This will download this module and place in your node_modules directory.
	- This will add 2 new nodes along the left menu of Node-Red when next started.
	- blockchain node will take a payload, hash it and stamp it on the blockchain.
	- blockchainVerify will take a receiptId from Tierion, verify it and supply the location on the blockchain to corroborate.
	
	

## Usage of Blockchain node

When you open the node-Red GUI, there will be a node under the "storage" section called blockchain which you can drag onto the board. Then double click to set the configuration.

This module creates a hash your incoming payload and sends that to the Tierion API which stamps that onto the blockchain. You will need an account with Tierion (for free) for the module to work.

Once you have your Tierion.com account, enter your credentials for the blockchain module by double clicking on the node dragged onto the Node-Red canvas.

For a sample usage to get started, inject any sample text string into the input on the left of the node and output the right node to the debug window. If successful it will report an outgoing payload.result of "PASS" and the payload will also have other compononents such as the hash of the incoming data.


## Usage of BlockchainVerify node

For the blockchainVerify node, you can locate your API Key from the page [https://tierion.com/app/api](https://tierion.com/app/api). That API key must be entered into the configuration of the node. Double click the node to access the configuration. Enable debug to see extra messages in the debug panel.

Input Mandatory: Supply the input with msg.payload.tierionReceiptId which was returned when the initial payload was stamped to the blockchain.
Input Optional: Supply the input with msg.payload.dataToHash which was the original payload data. The node will hash that data and confirm it matches the Tierion version of the target hash within the receipt mentioned in the msg.payload.tierionReceiptId.

Output: 
msg.payload.result will be "PASS" or "FAIL". 
msg.payload.tierionReceipt is the entire Tieirion receipt in JSON format. 
msg.blockchainLocation will contain a url to view the particular blockchain transaction which stamped the hash data. You will be able to view the OP_RETURN code and verify it matches the target hash within the receipt. 
  
[Tierion.com User Guide](https://tierion.com/docs)


## Tierion.com service.

Company site: [Tierion.com](https://Tierion.com)
Tierion uses a system of hashes of hashes to create a scalable system which does not bombard the blockchain, but still provides the original benefits.

## Author 

Jason Ruane, jason.ruane@gmail.com, Random Labs, www.jasonruane.com



