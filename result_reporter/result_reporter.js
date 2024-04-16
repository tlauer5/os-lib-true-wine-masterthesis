function reportAfterSignatureCheck (requestAndUpdateEvents) {
    let allCorrect = true;

    requestAndUpdateEvents.forEach(event => {
        if (event.type == "MerkleRootUpdated" && event.dataInDatabase && event.signatureCheck === false) {
            console.log("Signaturcheck für Dateneintrag mit Blocknummer: " + event.blockNumber + " ungültig.");
            allCorrect = false;
        }
    });

    return allCorrect;
}


function reportIncorrectLeaves (requestAndUpdateEvents) {
    if (merkleRootCheckPassed) {
        console.log("Merkle Roots stimmen überein. Führe Überprüfung fort.\n");
    } else {
        console.log("Merkle Roots unterschiedlich. Beende Überprüfung.\n")

        requestAndUpdateEvents.forEach(event => {
            if (event.type == "MerkleRootUpdated" && event.merkleRootCheck === false) {
                console.log("Signaturcheck für Dateneintrag mit Blocknummer: " + event.blockNumber + " ungültig.");
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
        console.log("Folgende Intervalle sind integer: ")
        console.log(intervals.filter(interval => interval.valid))
        console.log("\n\nFolgende Intervalle sind nicht integer: ")
        console.log(intervals.filter(interval => !interval.valid));
        return false
    } else {
        console.log("Datenintegrität konnte von " + intervals[0].start + " bis " + intervals[intervals.length - 1].end + " verifiziert werden.\n")
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