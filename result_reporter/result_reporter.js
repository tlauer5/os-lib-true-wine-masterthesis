function reportAfterSignatureCheck (requestAndUpdateEvents) {
    let allCorrect = true;

    requestAndUpdateEvents.forEach(event => {
        if (event.type == "MerkleRootUpdated" && event.dataInDatabase && event.signatureCheck === false) {
            console.log("Signaturcheck for data entry with block number " + event.blockNumberLeaf + " invalid.");
            allCorrect = false;
        }
    });

    return allCorrect;
}


function reportIncorrectLeaves (requestAndUpdateEvents) {
    if (merkleRootCheckPassed) {
        console.log("Merkle roots match. Continue verification.\n");
    } else {
        console.log("Merkle Roots different. Finish review.\n")

        requestAndUpdateEvents.forEach(event => {
            if (event.type == "MerkleRootUpdated" && event.merkleRootCheck === false) {
                console.log("Merkle Root check for data entry with block number " + event.blockNumberLeaf + " invalid.");
                allCorrect = false;
            }
        });

        return false;
    }
}


function convertToBerlinTime (unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
}


function reportProtocolFidelity (requestAndUpdateEvents) {
    intervals = validityOfIntervals(requestAndUpdateEvents)

    const hasInvalidIntervals = intervals.some(interval => !interval.valid);

    if (hasInvalidIntervals) {
        console.log("The following intervals have integrity: ")
        console.log(intervals.filter(interval => interval.valid))
        console.log("\n\nThe following intervals have no integrity: ")
        console.log(intervals.filter(interval => !interval.valid));
        return false
    } else {
        if(intervals.length != 0) {
            console.log("\n\nData integrity could be verified from " + convertToBerlinTime(intervals[0].start) + " to " + convertToBerlinTime(intervals[intervals.length - 1].end) + ".")
        }
        return true
    }
}


function validityOfIntervals (requestAndUpdateEvents) {
    const results = [];
    let lastRequestedEvent = null;

    requestAndUpdateEvents.forEach((event) => {
        if (event.type === 'MerkleRootRequested') {
            if (lastRequestedEvent) {
                const interval = { start: lastRequestedEvent.blockTimeStamp, end: event.blockTimeStamp, valid: false };

                if (event.eventOrderCheck) {
                    const updatedEvent = requestAndUpdateEvents.find(e =>
                        e.type === 'MerkleRootUpdated' &&
                        e.blockNumberLeaf === event.blockNumber
                    );

                    if (updatedEvent && updatedEvent.blockNumberCheck && updatedEvent.timestampCheck) {
                        interval.valid = true;
                    }
                }

                results.push(interval);
            }

            lastRequestedEvent = event;
        }
    });

    return results
}


module.exports = {
    reportAfterSignatureCheck,
    reportIncorrectLeaves,
    reportProtocolFidelity,
    convertToBerlinTime
}