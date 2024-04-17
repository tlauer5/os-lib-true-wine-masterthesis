// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import of the "AccessControl" contract from OpenZeppelin for role-based access control
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Storage_01 is AccessControl {

    // Declaration of struct
    struct CidDataFormat {
        string multibase;
        string version;
        string multicodec;
        string multihashAlgorithm;
        uint16 multihashLength;
        string dataTemplateCid; //IPFS-CID des Templates
    }

    // Definition of roles
    bytes32 public constant MERKLE_ROOT_UPDATER = keccak256("MERKLE_ROOT_UPDATER");
    bytes32 public constant CHAINLINK_UPKEEPER = keccak256("CHAINLINK_UPKEEPER");

    // Declaration of variables
    string public merkleRoot;
    address public sensor;
    CidDataFormat public cidDataFormat;

    // Declaration of events
    event MerkleRootRequested(uint256 indexed blockNumber);

    event MerkleRootUpdated(
        uint256 indexed blockNumber,
        string merkleRoot,
        string leaf
    );

    event CidDataFormatUpdated(
        uint256 indexed blockNumber,
        string multibase,
        string version,
        string multicodec,
        string multihashAlgorithm,
        uint16 multihashLength,
        string dataTemplateCid
    );

    event SensorAddressUpdated(
        uint256 indexed blockNumber,
        address sensorAddress
    );

    // Constructor
    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    // Declaration and definition of functions
    function requestMerkleRoot() public onlyRole(CHAINLINK_UPKEEPER) {
        // Emitting the "MerkleRootRequested" event
        emit MerkleRootRequested(block.number);
    }

    function setMerkleRoot(string memory merkleRoot_, string memory leaf_)
        public
        onlyRole(MERKLE_ROOT_UPDATER)
    {
        // Writing the new Merkle Root
        merkleRoot = merkleRoot_;

        // Emitting the "MerkleRootUpdated" event
        emit MerkleRootUpdated(block.number, merkleRoot_, leaf_);
    }

    function setSensorAddress(address sensor_)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Writing the new sensor address
        sensor = sensor_;

        // Emitting the "SensorAddressUpdated" event
        emit SensorAddressUpdated(block.number, sensor_);
    }

    function setCidDataFormat(
        string memory multibase_,
        string memory version_,
        string memory multicodec_,
        string memory multihashAlgorithm_,
        uint16 multihashLength_,
        string memory dataTemplateCid_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {

        //  Writing the information required to generate the IPFS CID
        cidDataFormat.multibase = multibase_;
        cidDataFormat.version = version_;
        cidDataFormat.multicodec = multicodec_;
        cidDataFormat.multihashAlgorithm = multihashAlgorithm_;
        cidDataFormat.multihashLength = multihashLength_;
        cidDataFormat.dataTemplateCid = dataTemplateCid_;

        // Emitting the "CidDataFormatUpdated" event
        emit CidDataFormatUpdated(
            block.number,
            multibase_,
            version_,
            multicodec_,
            multihashAlgorithm_,
            multihashLength_,
            dataTemplateCid_
        );
    }
}