const { ethers } = require("ethers")


function createContract (general) {
    const provider = createProvider(general.providerURL)

    return new ethers.Contract(general.contractAddress, general.abi, provider);
}


function createProvider(providerURL) {
    return new ethers.providers.JsonRpcProvider(providerURL);
}


async function readSensor (contract) {
    try {
        const result = await contract.sensor();
        console.log("Read sensor address: " + result + " from contract.\n");
        return result
    } catch (error) {
        console.error('Error:', error);
    }
}


async function readCidDataFormat (contract) {
    try {
        const result = await contract.cidDataFormat();
        console.log("Read cidDataFormat: " + result + " from contract.\n");

        return {
            multibase: result.multibase,
            version: result.version,
            multicodec: result.multicodec,
            multihashAlgorithm: result.multihashAlgorithm,
            multihashLength: result.multihashLength,
            dataTemplateCid: result.dataTemplateCid
        }
    } catch (error) {
        console.error('Error:', error);
    }
}


async function readMerkleRoot (contract) {
    try {
        return await contract.merkleRoot();
    } catch (error) {
        console.error('Error:', error);
    }
}


async function readAllEvents (contract, firstBlockNumberInData) {
    const fromBlock = 0;
    const toBlock = 'latest';
    const events = await contract.queryFilter({}, fromBlock, toBlock);

    merkleRootUpdatedEvents = new Map();
    cidDataFormatUpdatedEvents = new Map();
    sensorAddressUpdatedEvents = new Map();
    merkleRootRequestedEvents = []

    for (e of events) {

        let blockNumber = parseInt(e.args[0]._hex, 16);

        if (e.event == "MerkleRootUpdated" && blockNumber >= firstBlockNumberInData) {
            merkleRootUpdatedEvents.set(
                blockNumber,
                {
                    leaf: e.args[2],
                    merkleRoot: e.args[1]
                });

        } else if (e.event == "CidDataFormatUpdated") {

            cidDataFormatUpdatedEvents.set(
                blockNumber,
                {
                    multibase: e.args[1],
                    version: e.args[2],
                    multicodec: e.args[3],
                    multihashAlgorithm: e.args[4],
                    multihashLength: e.args[5],
                    dataTemplateCid: e.args[6]
                })

        } else if (e.event == "SensorAddressUpdated") {
            sensorAddressUpdatedEvents.set(
                blockNumber,
                e.args[1]
                )

        } else if (e.event == "MerkleRootRequested" && blockNumber >= firstBlockNumberInData) {
            merkleRootRequestedEvents.push(blockNumber)
        }
    }

    return {
        merkleRootRequestedEvents: merkleRootRequestedEvents,
        merkleRootUpdatedEvents: merkleRootUpdatedEvents,
        sensorAddressUpdatedEvents: sensorAddressUpdatedEvents,
        cidDataFormatUpdatedEvents: cidDataFormatUpdatedEvents
    }
}


async function getBlockTimestamp(blockNumber, providerURL) {
    const provider = createProvider(providerURL)

    const block = await provider.getBlock(blockNumber);

    if (block) {
        return block.timestamp
    } else {
        return false
    }

}


module.exports = {
    readSensor,
    readMerkleRoot,
    createContract,
    createProvider,
    readAllEvents,
    readCidDataFormat,
    getBlockTimestamp
};