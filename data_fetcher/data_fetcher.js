const axios = require('axios');


async function getAllData (url) {
    try {
        const response = await axios.get(url)
        return response.data;
    } catch (error) {
        console.error(error.message);
        return undefined;
    }
}


module.exports = {
    getAllData
};