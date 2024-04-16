const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");


function createMerkleTree (values) {
    leafType = ["uint256", "string"]
    return StandardMerkleTree.of(values, leafType);
}


module.exports = {
    createMerkleTree
}