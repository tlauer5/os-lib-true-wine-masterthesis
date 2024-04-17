const { getBlockTimestamp } = require('../rpc_wrapper/rpc_wrapper');
const { fetchDataFromIpfs } = require('../ipfs/ipfs');


async function genDataEntries (data) {
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


async function assignDataToEvents (dataEntries, events, providerURL) {
    let requestAndUpdateEventsAndRemovedEvents = await createRequestAndUpdateEventList(events, providerURL);

    for (i = dataEntries.length - 1; i >= 0; i--) {
        let tempObject = requestAndUpdateEventsAndRemovedEvents.requestAndUpdateEvents.find(event => (
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

    return {
        requestAndUpdateEvents: requestAndUpdateEventsAndRemovedEvents.requestAndUpdateEvents,
        removedUpdatedEvents: requestAndUpdateEventsAndRemovedEvents.removedUpdatedEvents
    }
}


function findClosestSmallerNumber (blockNumber, numbers) {
    const smallerNumbers = numbers.filter(number => number < blockNumber);

    if (smallerNumbers.length > 0) {
        return smallerNumbers.sort((a, b) => b - a)[0];
    } else {
        throw new Error(`Keine korrespondierende Event-Blocknummer (CidDataFormatUpdated oder SensorAddressUpdated) für das MerkleRootUpdated Event mit der Blocknummer ${blockNumber} gefunden.`);
    }
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


async function createRequestAndUpdateEventList (events, providerURL) {
    let requestEvents = await createListOfMRReqEvents(events, providerURL);

    let updateEventsAndRemovedEvents = await createListOfMRUpdEvents(events)

    let requestAndUpdateEvents = [...requestEvents, ...updateEventsAndRemovedEvents.MRUpdEvents];

    requestAndUpdateEvents = requestAndUpdateEvents.sort((a, b) => a.blockNumber - b.blockNumber);

    return {
        requestAndUpdateEvents: requestAndUpdateEvents,
        removedUpdatedEvents: updateEventsAndRemovedEvents.removedEvents
    };
}


async function createListOfMRReqEvents (events, providerURL) {
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


async function createListOfMRUpdEvents (events) {
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

    return {
        MRUpdEvents: MRUpdEvents,
        removedEvents: removedEvents
    }
}


async function readBlockNumberFromLeaf(leaf) {
    const data = await fetchDataFromIpfs(leaf);

    return data.blockNumber
}


module.exports = {
    genDataEntries,
    assignDataToEvents,
    assignSensorAndCidDataFormatToEvents
};