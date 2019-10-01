pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Pausable.sol";

contract Splitter is Pausable {
    using SafeMath for uint;

    mapping(address => uint) public balances;

    event LogSplit(address indexed sender, address indexed first, address indexed second, uint amount);
    /**
     * Event emitted when the payment recorded here has been withdrawn.
     * @param sender The account that ran the action.
     * @param balance The value of the payment withdrawn measured in weis.
     */
    event LogWithdrawn(address indexed sender, uint balance);

    constructor() public {
    }

    function split(address first, address second) public payable whenNotPaused fromOwner {
        require(msg.value > 0);
        require(first != second);
        require(first != address(0) && second != address(0));

        uint half = msg.value.div(2);
        require(half > 0);

        balances[first] = balances[first].add(half);
        balances[second] = balances[second].add(msg.value.sub(half));
        emit LogSplit(msg.sender, first, second, msg.value);
    }

    function withdraw() public whenNotPaused {
        uint balance = balances[msg.sender];
        require(balance > 0);

        balances[msg.sender] = 0;
        msg.sender.transfer(balance);
        emit LogWithdrawn(msg.sender, balance);
    }

    function() external payable {
        revert();
    }
}
