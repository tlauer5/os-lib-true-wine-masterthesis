const { getBlockTimestamp, readEvents } = require('../rpc_wrapper/rpc_wrapper');
const { fetchDataFromIpfs } = require('../ipfs/ipfs');


async function organizeEventData (contract, firstBlockNumberInData, general) {
    const events = await readEvents(contract, firstBlockNumberInData)

    const MRReqEvents = await eventsToMReqObjects(events, general.providerURL);

    let MRUpdEvents = await eventsToMRUpdObjects(events)

    let removedEvents = removeDoubleMRUpdEvents(MRUpdEvents)

    if (removedEvents.length != 0) {
        console.log("\nAttention. The following MerkleRootUpdated events that refer to the same MerkleRootRequested event were found and removed:\n");
        console.log(removedEvents);
        console.log("\n")
    }

    let requestAndUpdateEvents = [...MRReqEvents, ...MRUpdEvents];

    requestAndUpdateEvents = requestAndUpdateEvents.sort((a, b) => a.blockNumber - b.blockNumber);

    assignSensorAndCidDataFormatToEvents(requestAndUpdateEvents, events)

    return requestAndUpdateEvents
}


async function eventsToMReqObjects (events, providerURL) {
    let MRReqEvents = [...events.merkleRootRequestedEvents]
    let MRReqObjects = []

    for (blockNumber of MRReqEvents) {
        MRReqObjects.push(
            {
                "type": "MerkleRootRequested",
                "blockNumber": blockNumber,
                "eventOrderCheck": false,
                "blockTimeStamp": await getBlockTimestamp(blockNumber, providerURL),
            })

    }

    return MRReqObjects;
}


async function eventsToMRUpdObjects (events) {
    let MRUpdEvents = []

    for (const [blockNumber, values] of events.merkleRootUpdatedEvents) {
        MRUpdEvents.push({
            "type": "MerkleRootUpdated",
            "blockNumber": blockNumber,
            "blockNumberLeaf": await readBlockNumberFromLeaf(values.leaf),
            "leafUpdateEvent": values.leaf,
            "merkleRootUpdateEvent": values.merkleRoot,
            "dataInDatabase": false,
            "signatureCheck": false,
            "merkleRootCheck": false,
            "blockNumberCheck": false,
            "timestampCheck": false
        });
    }

    return MRUpdEvents;
}


async function readBlockNumberFromLeaf (leaf) {
    const data = await fetchDataFromIpfs(leaf);

    return data.blockNumber
}


function removeDoubleMRUpdEvents (MRUpdEvents) {
    let removedEvents = [];
    let temp = {};

    MRUpdEvents.forEach(event => {
        let key = event.blockNumberLeaf;
        if (!temp[key] || temp[key].blockNumber < event.blockNumber) {
            if (temp[key]) {
                removedEvents.push(temp[key]);
            }
            temp[key] = event;
        } else {
            removedEvents.push(event);
        }
    });

    MRUpdEvents = Object.values(temp);

    return removedEvents
}


function assignSensorAndCidDataFormatToEvents (requestAndUpdateEvents, events) {
    let blockNumsCidDataFormat = [...events.cidDataFormatUpdatedEvents.keys()];
    let blockNumsSensor = [...events.sensorAddressUpdatedEvents.keys()];

    requestAndUpdateEvents.forEach(event => {
        if (event.type === 'MerkleRootUpdated') {
            const correspondingCidDataFormatBlockNum = findClosestSmallerNumber(event.blockNumber, blockNumsCidDataFormat);
            const correspondingSensorBlockNum = findClosestSmallerNumber(event.blockNumber, blockNumsSensor);

            event.cidDataFormat = events.cidDataFormatUpdatedEvents.get(correspondingCidDataFormatBlockNum);
            event.sensor = events.sensorAddressUpdatedEvents.get(correspondingSensorBlockNum);

        }
    });

    requestAndUpdateEvents = requestAndUpdateEvents.sort((a, b) => a.blockNumber - b.blockNumber);
}


function findClosestSmallerNumber (blockNumber, numbers) {
    const smallerNumbers = numbers.filter(number => number < blockNumber);

    if (smallerNumbers.length > 0) {
        return smallerNumbers.sort((a, b) => b - a)[0];
    } else {
        throw new Error(`Keine korrespondierende Event-Blocknummer (CidDataFormatUpdated oder SensorAddressUpdated) für das MerkleRootUpdated Event mit der Blocknummer ${blockNumber} gefunden.`);
    }
}


async function dataToEntriesObjects (data) {
    let dataEntries = []

    for (dataEntry of data) {

        let tempObject = {
            "blockNumber": dataEntry[0],
            "timestamp": dataEntry[1],
            "temperature": dataEntry[2],
            "humidity": dataEntry[3],
            "signature": dataEntry[4],
        };

        dataEntries.push(tempObject)
    }

    return dataEntries;
}


async function assignDataToEvents (dataEntries, requestAndUpdateEvents) {
    for (i = dataEntries.length - 1; i >= 0; i--) {
        let tempObject = requestAndUpdateEvents.find(event => (
            event.type == "MerkleRootUpdated" &&
            (event.blockNumberLeaf == dataEntries[i].blockNumber))
        )

        if (tempObject) {
            tempObject.dataInDatabase = true;
            tempObject.dataFromDatabase = dataEntries[i]
            dataEntries.splice(i, 1)
        }
    }

    if (dataEntries.length != 0) {
        throw new Error(`Es gibt in der Datenbank folgende Einträge deren Blocknummern mit keiner Blocknummer aus den Events übereinstimmen: ${JSON.stringify(dataEntries)}`)
    }
}


module.exports = {
    organizeEventData,
    dataToEntriesObjects,
    assignDataToEvents
};