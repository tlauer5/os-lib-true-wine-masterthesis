const axios = require('axios');
const CID = require('cids');
const multihashing = require('multihashing-async');


async function generateLeaf (cidDataFormat, general, data) {
  const bufferForIpfs = await generateBufferForIpfs(cidDataFormat.dataTemplateCid, general, data)

  const cid = await createCid(bufferForIpfs, cidDataFormat)

  return cid;
}


async function generateBufferForIpfs (dataTemplateCid, general, data) {
  const template = await fetchDataFromIpfs(dataTemplateCid);

  filledTemplate = fillTemplateWithData(template, general, data);

  const formattedJson = JSON.stringify(filledTemplate, null, 2);

  return Buffer.from(formattedJson);
}


async function fetchDataFromIpfs (cid) {
  const ipfsUrl = `https://${cid}.ipfs.nftstorage.link/`
  // const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;

  try {
    const response = await axios.get(ipfsUrl);
    let data = response.data;

    return data

  } catch (error) {
    throw new Error("Daten konnten nicht von IPFS eingeholt werden.")
  }
}


function fillTemplateWithData (template, general, data) {
  template["blockNumber"] = parseInt(data.blockNumber)
  template["chainId"] = parseInt(general.chainId)
  template["contractAddress"] = general.contractAddress

  template["units"]["temperature"] = general.temperatureUnit
  template["units"]["humidity"] = general.humidityUnit

  template["sensorSignature"] = data.signature

  template["sensorData"]["timestamp"] = data.timestamp
  template["sensorData"]["temperature"] = data.temperature
  template["sensorData"]["humidity"] = data.humidity

  return template
}


async function createCid (buffer, cidDataFormat) {
  const { multihashAlgorithm, version, multicodec } = cidDataFormat;

  const hash = await multihashing(buffer, multihashAlgorithm);

  const cid = new CID(getCidVersion(version), multicodec, hash);

  const cidString = cid.toString()//cid.toBaseEncodedString('base32');

  return cidString
}


function getCidVersion (version) {
  return parseInt(version[version.length - 1], 10);
}


async function storeBlobToIPFS (blobData, apiKey) {
  try {
    const response = await axios.post("https://api.nft.storage/upload", blobData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const cid = response.data.value.cid;
    console.log('Blob stored successfully. CID:', cid);
  } catch (error) {
    console.error('Error storing Blob:', error);
  }
}


module.exports = {
  createCid,
  fetchDataFromIpfs,
  fillTemplateWithData,
  generateBufferForIpfs,
  generateLeaf,
  storeBlobToIPFS
};
