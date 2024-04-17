require('dotenv').config({ path: `${__dirname}/.env` });
const { createContract, readSensor, readMerkleRoot, readAllEvents, readCidDataFormat, getBlockTimestamp } = require("./rpc_wrapper/rpc_wrapper")
const { getAllData } = require("./data_fetcher/data_fetcher");
const { checkBlockNumbers, recoverAddressFromData, checkSignatures, checkMerkleRoot, checkEventOrder, checkTimestamps } = require("./data_verifier/data_verifier");
const { createCid, fetchDataFromIpfs, fillTemplateWithData, generateBufferForIpfs, storeBlobToIPFS } = require("./ipfs/ipfs");
const { createMerkleTree } = require('./merkle_tree/merkle_tree.js');
const { genDataEntries, assignDataToEvents, assignSensorAndCidDataFormatToEvents } = require('./data_preprocessing/data_preprocessor');
const { reportAfterSignatureCheck, reportIncorrectLeaves, reportProtocolFidelity } = require('./result_reporter/result_reporter.js');


const general = {
    temperatureUnit: process.env.TEMPERATURE_UNIT,
    humidityUnit: process.env.HUMIDITY_UNIT,
    chainId: process.env.CHAIN_ID,
    contractAddress: process.env.CONTRACT_ADDRESS,
    providerURL: process.env.PROVIDER_URL,
    abi: require("./rpc_wrapper/abi/abi.json")
};


async function verifyIntegrity (data, rpcKey=process.env.RPC_KEY) {
    if (data && data.length !== 0) {
        general.providerURL = general.providerURL + rpcKey
        const firstBlockNumberInData = data[0][0]
        const contract = createContract(general)

        try {
            console.log("Lese Events und ordne Daten zu...\n")
            const events = await readAllEvents(contract, firstBlockNumberInData)
            let dataEntries = await genDataEntries(data)
            let requestAndUpdateEventsAndRemovedEvents = await assignDataToEvents([...dataEntries], events, general.providerURL)
            let requestAndUpdateEvents = requestAndUpdateEventsAndRemovedEvents.requestAndUpdateEvents;
            let removedUpdatedEvents = requestAndUpdateEventsAndRemovedEvents.removedUpdatedEvents;

            if (removedUpdatedEvents.length != 0){
                console.log("Achtung. Folgende MerkleRootUpdated Events, die sich auf dasselbe MerkleRootRequested Event beziehen, wurden gefunden und entfernt:\n");
                console.log(removedUpdatedEvents);
                console.log("\n")
            }

            assignSensorAndCidDataFormatToEvents(requestAndUpdateEvents, events)

            // Überprüfungen
            console.log("\nStarte Überprüfungen:\nChecke Signaturen...")
            await checkSignatures(requestAndUpdateEvents)
            if (reportAfterSignatureCheck(requestAndUpdateEvents)) {
                console.log("Signaturen korrekt. Führe Überprüfung fort.")
            } else {
                console.log("Beende Überprüfung\n");
                return false;
            }

            console.log("\nChecke Merkle Root...");
            const merkleRootCheckPassed = await checkMerkleRoot(requestAndUpdateEvents, general, contract)

            if (merkleRootCheckPassed) {
                console.log("Merkle Root identisch. Führe Überprüfung fort.")
            } else {
                reportIncorrectLeaves(merkleRootCheckPassed, requestAndUpdateEvents);
                return false;
            }


            console.log("\nChecke Eventreihenfolge...")
            checkEventOrder(requestAndUpdateEvents)

            console.log("\nChecke Blocknummern...")
            checkBlockNumbers(requestAndUpdateEvents)

            console.log("\nChecke Zeitstempel...")
            checkTimestamps(requestAndUpdateEvents) //todo verändern damit wirklich zwischen zwei mrreq events und nicht nur nach zwei datenbankeinträgen...

            return reportProtocolFidelity(requestAndUpdateEvents)
        } catch (error) {
            console.log(error.message)
        }

    } else {
        console.log("Data is missing.");
        return false;
    }
}


async function dataFromWebsite (apiUrl = process.env.DEFAULT_DATA_API_URL) {
    return getAllData(apiUrl);
}


async function graphForData (data) {
    await plotData(data);
}


module.exports = {
    verifyIntegrity,
    dataFromWebsite,
    graphForData,
    createMerkleTree,
    recoverAddressFromData,
    createCid,
    fetchDataFromIpfs,
    fillTemplateWithData,
    generateBufferForIpfs,
    storeBlobToIPFS,
    readSensor,
    readMerkleRoot,
    readCidDataFormat,
    createContract,
    getBlockTimestamp
}