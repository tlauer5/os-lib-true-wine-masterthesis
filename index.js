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
        const contract = createContract(general.providerURL, general.contractAddress, general.abi)

        try {
            // Preprocessing Events and Data
            console.log("\nRead events and process data...")
            let requestAndUpdateEvents = await organizeEventData(contract, firstBlockNumberInData, general)

            const dataEntries = await dataToEntriesObjects(data)
            await assignDataToEvents([...dataEntries], requestAndUpdateEvents)

            // Checks
            console.log("\n-------------\n\nCheck signatures...\n")
            await checkSignatures(requestAndUpdateEvents)
            if (reportAfterSignatureCheck(requestAndUpdateEvents)) {
                console.log("Signatures correct. Continue verification.")
            } else {
                console.log("End verification\n");
                return false;
            }

            console.log("\n-------------\n\nCheck Merkle Root...\n");
            const merkleRootCheckPassed = await checkMerkleRoot(requestAndUpdateEvents, general, contract)

            if (merkleRootCheckPassed) {
                console.log("Merkle root identical. Continue verification.")
            } else {
                reportIncorrectLeaves(merkleRootCheckPassed, requestAndUpdateEvents);
                return false;
            }

            console.log("\n-------------\n\nCheck event order...")
            checkEventOrder(requestAndUpdateEvents)

            console.log("\nCheck block numbers...")
            checkBlockNumbers(requestAndUpdateEvents)

            console.log("\nCheck timestamps...")
            checkTimestamps(requestAndUpdateEvents) //todo verändern damit wirklich zwischen zwei mrreq events und nicht nur nach zwei datenbankeinträgen...

            return reportProtocolFidelity(requestAndUpdateEvents)
        } catch (error) {
            console.log("\nThe following error occurred during the verification process:\n");
            console.log(error.message)
            console.log("\nVerification could not be continued.")
        }

    } else {
        console.log("No data received. Verification cannot be performed.");
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