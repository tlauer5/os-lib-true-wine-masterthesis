require('dotenv').config({ path: `${__dirname}/.env` });
const { getAllData } = require("./data_fetcher/data_fetcher");
const { createContract, readSensor, readMerkleRoot, readCidDataFormat, getBlockTimestamp } = require("./rpc_wrapper/rpc_wrapper")
const { organizeEventData, dataToEntriesObjects, assignDataToEvents } = require('./data_preprocessing/data_preprocessor');
const { checkSignatures, checkMerkleRoot, checkEventOrder, checkBlockNumbers, checkTimestamps, recoverAddressFromData } = require("./data_verifier/data_verifier");
const { reportAfterSignatureCheck, reportIncorrectLeaves, reportProtocolFidelity } = require('./result_reporter/result_reporter.js');
const { createCid, fetchDataFromIpfs, fillTemplateWithData, generateBufferForIpfs, storeBlobToIPFS } = require("./ipfs/ipfs");
const { createMerkleTree } = require('./merkle_tree/merkle_tree.js');


const general = {
    temperatureUnit: process.env.TEMPERATURE_UNIT,
    humidityUnit: process.env.HUMIDITY_UNIT,
    chainId: process.env.CHAIN_ID,
    contractAddress: process.env.CONTRACT_ADDRESS,
    providerURL: process.env.PROVIDER_URL,
    abi: require("./rpc_wrapper/abi/abi.json")
};


async function dataFromWebsite (apiUrl = process.env.DEFAULT_DATA_API_URL) {
    return getAllData(apiUrl);
}


async function verifyIntegrity (data, rpcKey = process.env.RPC_KEY) {
    if (data && data.length !== 0) {

        general.providerURL = general.providerURL + rpcKey
        const firstBlockNumberInData = data[0][0]
        const contract = createContract(general)

        try {
            // Preprozessierung von Events und Daten
            console.log("\nLese Events (das Abfragen der Zeitstempel dauert etwas länger)...")
            let requestAndUpdateEvents = await organizeEventData(contract, firstBlockNumberInData, general)

            console.log("\nOrdne Events Daten zu...");
            const dataEntries = await dataToEntriesObjects(data)
            await assignDataToEvents([...dataEntries], requestAndUpdateEvents)

            // Überprüfungen
            console.log("\n-------------\nStarte Überprüfungen:\nChecke Signaturen...")
            await checkSignatures(requestAndUpdateEvents)
            if (reportAfterSignatureCheck(requestAndUpdateEvents)) {
                console.log("Signaturen korrekt. Führe Überprüfung fort.")
            } else {
                console.log("Beende Überprüfung\n");
                return false;
            }

            console.log("\n-------------\nChecke Merkle Root...");
            const merkleRootCheckPassed = await checkMerkleRoot(requestAndUpdateEvents, general, contract)

            if (merkleRootCheckPassed) {
                console.log("Merkle Root identisch. Führe Überprüfung fort.")
            } else {
                reportIncorrectLeaves(merkleRootCheckPassed, requestAndUpdateEvents);
                return false;
            }

            console.log("\n-------------\nChecke Eventreihenfolge...")
            checkEventOrder(requestAndUpdateEvents)

            console.log("\nChecke Blocknummern...")
            checkBlockNumbers(requestAndUpdateEvents)

            console.log("\nChecke Zeitstempel...")
            checkTimestamps(requestAndUpdateEvents) //todo verändern damit wirklich zwischen zwei mrreq events und nicht nur nach zwei datenbankeinträgen...

            return reportProtocolFidelity(requestAndUpdateEvents)
        } catch (error) {
            console.log("Folgender Fehler ist in dem Prozess der Verifizierung aufgetreten:\n");
            console.log(error.message)
            console.log("\nVerifikation konnte nicht weiter fortgeführt werden.")
        }

    } else {
        console.log("Keine Daten erhalten. Verifikation kann nicht durchgeführt werden.");
        return false;
    }
}


module.exports = {
    dataFromWebsite,
    verifyIntegrity,
    createContract,
    readSensor,
    readMerkleRoot,
    readCidDataFormat,
    getBlockTimestamp,
    recoverAddressFromData,
    createCid,
    fetchDataFromIpfs,
    fillTemplateWithData,
    generateBufferForIpfs,
    storeBlobToIPFS,
    createMerkleTree
}