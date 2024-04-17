const Web3 = require('web3');
const { readMerkleRoot } = require('../rpc_wrapper/rpc_wrapper');
const { generateLeaf } = require('../ipfs/ipfs.js');
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

            if(updEvent.generatedLeaf === updEvent.leafUpdateEvent) {
                updEvent.merkleRootCheck = true;
            }
        }
    }

    const merkleRootFromSmartContract = await readMerkleRoot(contract)
    console.log("Merkle Root von Smart Contract: " + merkleRootFromSmartContract);

    const merkleTree = createMerkleTree(leafs)
    const merkleRootFromData = merkleTree.root
    console.log("Neu generierte Merkle Root mit Daten von Datenbank: " + merkleRootFromData)

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

            // Wenn das nächste Ereignis existiert und vom Typ MerkleRootUpdated ist
            if (i + 1 < requestAndUpdateEvents.length && requestAndUpdateEvents[i + 1].type === 'MerkleRootUpdated') {
                // Prüfen, ob das MerkleRootUpdated-Ereignis sich auf das aktuelle MerkleRootRequested-Ereignis bezieht
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
    recoverAddressFromData,
    checkSignatures,
    checkMerkleRoot,
    checkEventOrder,
    checkBlockNumbers,
    checkTimestamps,

};