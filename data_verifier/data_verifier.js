const Web3 = require('web3');
const { generateLeaf } = require('../ipfs/ipfs.js');
const { readMerkleRoot } = require('../rpc_wrapper/rpc_wrapper');
const { createMerkleTree } = require('../merkle_tree/merkle_tree.js');


async function checkSignatures (requestAndUpdateEvents) {
    for (e of requestAndUpdateEvents) {

        if (e.type == "MerkleRootUpdated" && e.dataInDatabase) {
            let recoveredAddress = await recoverAddressFromData(e.dataFromDatabase);

            if (e.sensor == recoveredAddress) {
                e.signatureCheck = true
            }
        }
    }
}


async function recoverAddressFromData (data) {
    var reconstructed_message = data.timestamp + "," + data.temperature + "," + data.humidity //create_message(data);

    return Web3.eth.accounts.recover(reconstructed_message, data.signature)
}


async function checkMerkleRoot (requestAndUpdateEvents, general, contract) {
    const updatedEvents = requestAndUpdateEvents.filter(event => event.type === 'MerkleRootUpdated');

    const leafs = [];
    for (updEvent of updatedEvents) {
        if (updEvent.dataInDatabase) {

            let tempLeaf = [updEvent.dataFromDatabase.blockNumber, await generateLeaf(updEvent.cidDataFormat, general, updEvent.dataFromDatabase)]
            leafs.push(tempLeaf)
            updEvent.generatedLeaf = tempLeaf[1]

            if (updEvent.generatedLeaf === updEvent.leafUpdateEvent) {
                updEvent.merkleRootCheck = true;
            }
        }
    }

    const merkleRootFromSmartContract = await readMerkleRoot(contract)
    console.log("Merkle Root from Smart Contract:\n-> " + merkleRootFromSmartContract + " <-\n");

    const merkleTree = createMerkleTree(leafs)
    const merkleRootFromData = merkleTree.root
    console.log("Newly generated Merkle Root with data from database:\n-> " + merkleRootFromData + " <-\n")

    if (merkleRootFromData == merkleRootFromSmartContract) {
        return true
    } else {
        return false;
    }
}


function checkEventOrder (requestAndUpdateEvents) {
    for (let i = 0; i <= requestAndUpdateEvents.length - 1; i++) {
        let event = requestAndUpdateEvents[i];
        if (event.type === 'MerkleRootRequested') {

            // If the next event exists and is of type MerkleRootUpdated
            if (i + 1 < requestAndUpdateEvents.length && requestAndUpdateEvents[i + 1].type === 'MerkleRootUpdated') {
                // Check whether the MerkleRootUpdated event refers to the current MerkleRootRequested event
                if (requestAndUpdateEvents[i + 1].blockNumberLeaf === event.blockNumber) {
                    event.eventOrderCheck = true;

                }
            }
        }
    }
}


function checkBlockNumbers (requestAndUpdateEvents) {
    const requestedBlockNumbers = new Set();

    requestAndUpdateEvents.forEach(event => {
        if (event.type === 'MerkleRootRequested') {
            requestedBlockNumbers.add(event.blockNumber);
        }
    });

    requestAndUpdateEvents.forEach(event => {
        if (event.type === 'MerkleRootUpdated') {
            if (requestedBlockNumbers.has(event.blockNumberLeaf)) {
                event.blockNumberCheck = true;
            }
        }
    });
}


function checkTimestamps (requestAndUpdateEvents) {
    const requestedEvents = requestAndUpdateEvents.filter(event => event.type === 'MerkleRootRequested');
    const updatedEvents = requestAndUpdateEvents.filter(event => event.type === 'MerkleRootUpdated');

    updatedEvents.forEach(updateEvent => {
        const requestEventIndex = requestedEvents.findIndex(requestEvent => requestEvent.blockNumber === updateEvent.blockNumberLeaf);

        const previousRequestTimestamp = requestEventIndex > 0 ? requestedEvents[requestEventIndex - 1].blockTimeStamp : null;
        if (previousRequestTimestamp === null) {
            updateEvent.timestampCheck = false;
            return;
        }
        const currentRequestTimestamp = requestedEvents[requestEventIndex].blockTimeStamp;

        const timestamps = JSON.parse(updateEvent.dataFromDatabase.timestamp);
        const validTimestamps = timestamps.every(timestamp => {
            return (timestamp > previousRequestTimestamp) && timestamp < currentRequestTimestamp;
        });

        updateEvent.timestampCheck = validTimestamps;
    });
}


module.exports = {
    checkSignatures,
    recoverAddressFromData,
    checkMerkleRoot,
    checkEventOrder,
    checkBlockNumbers,
    checkTimestamps
};