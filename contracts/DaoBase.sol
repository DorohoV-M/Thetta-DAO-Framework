pragma solidity ^0.4.22;

import "./DaoStorage.sol";
import "./IDaoBase.sol";

import "./tokens/StdDaoToken.sol";

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title DaoBase 
 * @dev This is the base contract that you should use.
 * 
 * 1. This contract will be the owner of the 'store' and all 'tokens' inside the store!
 * It will transfer ownership only during upgrade
 *
 * 2. Currently DaoBase works only with StdDaoToken. It does not support working with 
 * plain ERC20 tokens because we need some extra features like mintFor(), burnFor() and transferOwnership()
*/
contract DaoBase is IDaoBase, Ownable {
	DaoStorage public store;

	event DaoBase_UpgradeDaoContract(address _new);
	event DaoBase_AddGroupMember(string _groupName, address _a);
	event DaoBase_RemoveGroupMember(address _new);
	event DaoBase_AllowActionByShareholder(bytes32 _what, address _tokenAddress);
	event DaoBase_AllowActionByVoting(bytes32 _what, address _tokenAddress);
	event DaoBase_AllowActionByAddress(bytes32 _what, address _a);
	event DaoBase_AllowActionByAnyMemberOfGroup(bytes32 _what, string _groupName);
	event DaoBase_AddNewProposal(address _proposal);
	event DaoBase_IssueTokens(address _tokenAddress, address _to, uint _amount);
	event DaoBase_BurnTokens(address _tokenAddress, address _who, uint _amount);

	//bytes32 public constant ISSUE_TOKENS = keccak256(abi.encodePacked("issueTokens"));
	bytes32 constant public ISSUE_TOKENS = 0xe003bf3bc29ae37598e0a6b52d6c5d94b0a53e4e52ae40c01a29cdd0e7816b71;
	//bytes32 public constant MANAGE_GROUPS = keccak256(abi.encodePacked("manageGroups"));
	bytes32 constant public MANAGE_GROUPS = 0x060990aad7751fab616bf14cf6b68ac4c5cdc555f8f06bc9f15ba1b156e81b0b;
	//bytes32 public constant ADD_NEW_PROPOSAL = keccak256(abi.encodePacked("addNewProposal"));
	bytes32 constant public ADD_NEW_PROPOSAL = 0x55c7fa9eebcea37770fd33ec28acf7eacb6ea53052a9e9bc0a98169768578c5f;
	//bytes32 public constant BURN_TOKENS = keccak256(abi.encodePacked("burnTokens"));
	bytes32 constant public BURN_TOKENS = 0x324cd2c359ecbc6ad92db8d027aab5d643f27c3055619a49702576797bb41fe5;
	//bytes32 public constant UPGRADE_DAO_CONTRACT = keccak256(abi.encodePacked("upgradeDaoContract"));
	bytes32 constant public UPGRADE_DAO_CONTRACT = 0x3794eb44dffe1fc69d141df1b355cf30d543d8006634dd7a125d0e5f500b7fb1;
	//bytes32 public constant REMOVE_GROUP_MEMBER = keccak256(abi.encodePacked("removeGroupMember"));
	bytes32 constant public REMOVE_GROUP_MEMBER = 0x3a5165e670fb3632ad283cd3622bfca48f4c8202b504a023dafe70df30567075;
	//bytes32 public constant WITHDRAW_DONATIONS = keccak256(abi.encodePacked("removeGroupMember"));
	bytes32 constant public WITHDRAW_DONATIONS = 0xfc685f51f68cb86aa29db19c2a8f4e85183375ba55b5e56fb2e89adc5f5e4285;
	//bytes32 public constant ALLOW_ACTION_BY_SHAREHOLDER = keccak256(abi.encodePacked("allowActionByShareholder"));
	bytes32 constant public ALLOW_ACTION_BY_SHAREHOLDER = 0xbeaac974e61895532ee7d8efc953d378116d446667765b57f62c791c37b03c8d;
	//bytes32 public constant ALLOW_ACTION_BY_VOTING = keccak256(abi.encodePacked("allowActionByVoting"));
	bytes32 constant public ALLOW_ACTION_BY_VOTING = 0x2e0b85549a7529dfca5fb20621fe76f393d05d7fc99be4dd3d996c8e1925ba0b;
	//bytes32 public constant ALLOW_ACTION_BY_ADDRESS = keccak256(abi.encodePacked("allowActionByAddress"));
	bytes32 constant public ALLOW_ACTION_BY_ADDRESS = 0x087dfe531c937a5cbe06c1240d8f791b240719b90fd2a4e453a201ce0f00c176;
	//bytes32 public constant ALLOW_ACTION_BY_ANY_MEMBER_OF_GROUP = keccak256(abi.encodePacked("allowActionByAnyMemberOfGroup"));
	bytes32 constant public ALLOW_ACTION_BY_ANY_MEMBER_OF_GROUP = 0xa7889b6adda0a2270859e5c6327f82b987d24f5729de85a5746ce28eed9e0d07;

	constructor(DaoStorage _store) public {
		store = _store;

		// WARNING: please! do not forget to transfer the store
		// ownership to the Dao (this contract)
		// Like this:
		// 
		// store.transferOwnership(daoBase);

		// WARNING: please! do not forget to transfer all tokens'
		// ownership to the Dao (i.e. DaoBase or any derived contract)
		// Like this:
		//
		// token.transferOwnership(daoBase);
	}

	modifier isCanDo(bytes32 _what){
		require(isCanDoAction(msg.sender,_what)); 
		_; 
	}

// IDaoBase:
	function addObserver(IDaoObserver _observer) public {
		store.addObserver(_observer);
	}

	function upgradeDaoContract(IDaoBase _new) public isCanDo(UPGRADE_DAO_CONTRACT) {
		emit DaoBase_UpgradeDaoContract(_new);
		// call observers.onUpgrade() for all observers
		for(uint i=0; i<store.getObserverCount(); ++i) {
			IDaoObserver(store.getObserverAtIndex(i)).onUpgrade(_new);
		}

		// transfer ownership of the store (this -> _new)
		store.transferOwnership(_new);

		// transfer ownership of all tokens (this -> _new)
		for(i=0; i<store.getAllTokenAddresses().length; ++i) {
			store.getAllTokenAddresses()[i].transferOwnership(_new);
		}
	}

// Groups:
	function getMembersCount(string _groupName) public view returns(uint) {
		return store.getMembersCount(keccak256(abi.encodePacked(_groupName)));
	}

	function addGroupMember(string _groupName, address _a) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_AddGroupMember(_groupName, _a);
		store.addGroupMember(keccak256(abi.encodePacked(_groupName)), _a);
	}

	function getGroupMembers(string _groupName) public view returns(address[]) {
		return store.getGroupMembers(keccak256(abi.encodePacked(_groupName)));
	}

	function removeGroupMember(string _groupName, address _a) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_RemoveGroupMember(_a);
		store.removeGroupMember(keccak256(abi.encodePacked(_groupName)), _a);
	}

	function isGroupMember(string _groupName,address _a) public view returns(bool) {
		return store.isGroupMember(keccak256(abi.encodePacked(_groupName)), _a);
	}

	function getMemberByIndex(string _groupName, uint _index) public view returns (address) {
		return store.getMemberByIndex(keccak256(abi.encodePacked(_groupName)), _index);
	}

// Actions:
	function allowActionByShareholder(bytes32 _what, address _tokenAddress) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_AllowActionByShareholder(_what, _tokenAddress);
		store.allowActionByShareholder(_what, _tokenAddress);
	}

	function allowActionByVoting(bytes32 _what, address _tokenAddress) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_AllowActionByVoting(_what, _tokenAddress);
		store.allowActionByVoting(_what,_tokenAddress);
	}

	function allowActionByAddress(bytes32 _what, address _a) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_AllowActionByAddress(_what, _a);
		store.allowActionByAddress(_what,_a);
	}

	function allowActionByAnyMemberOfGroup(bytes32 _what, string _groupName) public isCanDo(MANAGE_GROUPS) {
		emit DaoBase_AllowActionByAnyMemberOfGroup(_what, _groupName);
		store.allowActionByAnyMemberOfGroup(_what, keccak256(abi.encodePacked(_groupName)));
	}

	/**
	 * @dev Function that will check if action is DIRECTLY callable by msg.sender (account or another contract)
	 * How permissions works now:
	 * 1. if caller is in the whitelist -> allow
	 * 2. if caller is in the group and this action can be done by group members -> allow
	 * 3. if caller is shareholder and this action can be done by a shareholder -> allow
	 * 4. if this action requires voting 
	 *    a. caller is in the majority -> allow
	 *    b. caller is voting and it is succeeded -> allow
	 * 4. deny
	*/
	function isCanDoAction(address _a, bytes32 _permissionNameHash) public view returns(bool) {
		// 0 - is can do by address?
		if(store.isCanDoByAddress(_permissionNameHash, _a)) {
			return true;
		}

		// 1 - check if group member can do that without voting?
	   if(store.isCanDoByGroupMember(_permissionNameHash, _a)) {
			return true;
		}

		for(uint i=0; i<store.getAllTokenAddresses().length; ++i) {

			// 2 - check if shareholder can do that without voting?
			if(store.isCanDoByShareholder(_permissionNameHash, store.getAllTokenAddresses()[i]) && 
				(store.getAllTokenAddresses()[i].balanceOf(_a)!=0)) {
				return true;
			}


			// 3 - can do action only by starting new vote first?
			bool isCan = store.isCanDoByVoting(_permissionNameHash, store.getAllTokenAddresses()[i]);
			if(isCan) {
				bool isVotingFound = false;
				bool votingResult = false;
				(isVotingFound, votingResult) = store.getProposalVotingResults(_a);

				if(isVotingFound) {
					// if this action can be done by voting, then Proposal can do this action 
					// from within its context
					// in this case msg.sender is a Voting!
					return votingResult;
				}

				// 4 - only token holders with > 51% of gov.tokens can add new task immediately 
				// otherwise -> start voting
				bool isInMajority = 
					(store.getAllTokenAddresses()[i].balanceOf(_a)) >
					(store.getAllTokenAddresses()[i].totalSupply()/2);
				if(isInMajority) {
					return true;
				}
			}
		}

		return false;
	}

// Proposals:
	function addNewProposal(IProposal _proposal) public isCanDo(ADD_NEW_PROPOSAL) { 
		emit DaoBase_AddNewProposal(address(_proposal));
		store.addNewProposal(_proposal);
	}

	function getProposalAtIndex(uint _i)public view returns(IProposal) {
		return store.getProposalAtIndex(_i);
	}

	function getProposalsCount()public view returns(uint) {
		return store.getProposalsCount();
	}

// Tokens:
	function issueTokens(address _tokenAddress, address _to, uint _amount)public isCanDo(ISSUE_TOKENS) {
		emit DaoBase_IssueTokens(_tokenAddress, _to, _amount);
		for(uint i=0; i<store.getAllTokenAddresses().length; ++i) {
			if(store.getAllTokenAddresses()[i]==_tokenAddress) {
				// WARNING:
				// token ownership should be transferred to the current DaoBase to do that!!!
				store.getAllTokenAddresses()[i].mintFor(_to, _amount);
				return;
			}
		}

		// if not found!
		revert();
	}

	function burnTokens(address _tokenAddress, address _who, uint _amount)public isCanDo(BURN_TOKENS) {
		emit DaoBase_BurnTokens(_tokenAddress, _who, _amount);

		for(uint i=0; i<store.getAllTokenAddresses().length; ++i) {
			if(store.getAllTokenAddresses()[i]==_tokenAddress){
				// WARNING:
				// token ownership should be transferred to the current DaoBase to do that!!!
				store.getAllTokenAddresses()[i].burnFor(_who, _amount);
				return;
			}
		}

		// if not found!
		revert();
	}
}


