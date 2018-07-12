var MoneyflowTable = artifacts.require("./MoneyflowTable");

var DaoBase = artifacts.require("./DaoBase");
var StdDaoToken = artifacts.require("./StdDaoToken");
var DaoStorage = artifacts.require("./DaoStorage");

var MoneyFlow = artifacts.require("./MoneyFlow");
var NewWeiFund = artifacts.require("./NewWeiFund");
// var ConditionalFund = artifacts.require("./WeiFund2");
var IWeiReceiver = artifacts.require("./IWeiReceiver");

var CheckExceptions = require('./utils/checkexceptions');

var WeiTopDownSplitter = artifacts.require("./WeiTopDownSplitter");
var WeiUnsortedSplitter = artifacts.require("./WeiUnsortedSplitter");
var WeiAbsoluteExpense = artifacts.require("./WeiAbsoluteExpense");
var WeiRelativeExpense = artifacts.require("./WeiRelativeExpense");
var WeiAbsoluteExpenseWithPeriod = artifacts.require("./WeiAbsoluteExpenseWithPeriod");
var WeiRelativeExpenseWithPeriod = artifacts.require("./WeiRelativeExpenseWithPeriod");

const getEId=o=> o.logs.filter(l => l.event == 'elementAdded')[0].args._eId.toNumber();
const KECCAK256=x=> web3.sha3(x);

async function passHours(hours){
	await web3.currentProvider.sendAsync({
		jsonrpc: '2.0',
		method: 'evm_increaseTime',
		params: [3600 * hours * 1000],
		id: new Date().getTime()
	}, function(err){if(err) console.log('err:', err)});
}

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('ConditionalFund', (accounts) => {
	let money = web3.toWei(0.001, "ether");

	const creator = accounts[0];
	const employee1 = accounts[1];
	const employee2 = accounts[2];
	const outsider = accounts[3];

	beforeEach(async() => {
	});

	it('Should not create fund with wrong args',async() => {
		await NewWeiFund.new(0, false, false, 0).should.be.rejectedWith('revert');
		await NewWeiFund.new(1e18, true, true, 0).should.be.rejectedWith('revert');
		await NewWeiFund.new(1e18, false, true, 24).should.be.rejectedWith('revert');
		await NewWeiFund.new(1e18, false, true, 0).should.be.rejectedWith('revert');
		await NewWeiFund.new(1e18, true, true, 0).should.be.rejectedWith('revert');
	});

	it('Should collect money, then revert if more, then flush',async() => {
		let fund = await NewWeiFund.new(1e18, false, false, 0);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var minNeed = await fund.getMinWeiNeeded();
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(minNeed.toNumber(), 0);
		assert.equal(isNeed, true);

		await fund.processFunds(1e17, {value:3e17}).should.be.rejectedWith('revert');
		await fund.processFunds(3e17, {value:1e17}).should.be.rejectedWith('revert');
		await fund.processFunds(3e17, {value:3e17, from:creator});
		await fund.processFunds(3e17, {value:3e17, from:employee1});

		var totalNeed = await fund.getTotalWeiNeeded(4e17);
		var minNeed = await fund.getMinWeiNeeded();
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 4e17);
		assert.equal(minNeed.toNumber(), 0);
		assert.equal(isNeed, true);

		await fund.processFunds(5e17, {value:5e17}).should.be.rejectedWith('revert'); //overflow
		await fund.processFunds(4e17, {value:4e17, from:employee2});
		await fund.processFunds(1e17, {value:1e17}).should.be.rejectedWith('revert'); //overflow

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var minNeed = await fund.getMinWeiNeeded();
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(minNeed.toNumber(), 0);
		assert.equal(isNeed, false);

		var b1 = await web3.eth.getBalance(employee1);
		await fund.flushTo(employee1);
		var b2 = await web3.eth.getBalance(employee1);
		assert.equal(b2.toNumber()-b1.toNumber(), 1e18);

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var minNeed = await fund.getMinWeiNeeded();
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(minNeed.toNumber(), 0);
		assert.equal(isNeed, false);
	});

	it('Should collect money (periodic, not accumulate debt), then time passed, then need money again',async() => {
		let fund = await NewWeiFund.new(1e18, true, false, 24);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);

		await fund.processFunds(1e18, {value:1e18});

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);

		await passHours(23);

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);

		await passHours(1);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);
	
		await passHours(24);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);	

		await fund.processFunds(5e17, {value:5e17});

		var totalNeed = await fund.getTotalWeiNeeded(5e17);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 5e17);
		assert.equal(isNeed, true);

		await passHours(24);

		var totalNeed = await fund.getTotalWeiNeeded(5e17);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 5e17);
		assert.equal(isNeed, true);

		await fund.processFunds(5e17, {value:5e17});

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);
	});

	it('Should collect money (periodic, accumulate debt), then time passed, then need money again',async() => {
		let fund = await NewWeiFund.new(1e18, true, true, 24);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);

		await fund.processFunds(1e18, {value:1e18});

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);

		await passHours(23);

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);

		await passHours(1);

		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);
	
		await passHours(24);

		var totalNeed = await fund.getTotalWeiNeeded(2e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 2e18);
		assert.equal(isNeed, true);	

		await fund.processFunds(5e17, {value:5e17});

		var totalNeed = await fund.getTotalWeiNeeded(1.5e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1.5e18);
		assert.equal(isNeed, true);

		await passHours(24);

		var totalNeed = await fund.getTotalWeiNeeded(2.5e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 2.5e18);
		assert.equal(isNeed, true);

		await fund.processFunds(2.5e18, {value:2.5e18});

		var totalNeed = await fund.getTotalWeiNeeded(0);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 0);
		assert.equal(isNeed, false);
	});

	it('Should collect money (periodic, accumulate debt), then time passed, then need money again',async() => {
		let fund = await NewWeiFund.new(1e18, true, true, 24);
		var totalNeed = await fund.getTotalWeiNeeded(1e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(isNeed, true);

		await passHours(48);
		var totalNeed = await fund.getTotalWeiNeeded(3e18);
		var isNeed = await fund.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 3e18);
		assert.equal(isNeed, true);
	});

	it('Should implement roadmap pattern with funds (-> abs-abs-abs)',async() => {
		let splitter = await WeiTopDownSplitter.new('Splitter');

		let milestone1 = await NewWeiFund.new(0.1e18, false, false, 0);
		let milestone2 = await NewWeiFund.new(0.2e18, false, false, 0);
		let milestone3 = await NewWeiFund.new(0.7e18, false, false, 0);
		await splitter.addChild(milestone1.address);
		await splitter.addChild(milestone2.address);
		await splitter.addChild(milestone3.address);

		var totalNeed = await splitter.getTotalWeiNeeded(1e18);
		var minNeed = await splitter.getMinWeiNeeded();
		var isNeed = await splitter.isNeedsMoney();
		assert.equal(totalNeed.toNumber(), 1e18);
		assert.equal(minNeed.toNumber(), 0);
		assert.equal(isNeed, true);

		await splitter.processFunds(0.01e18,{value:0.01e18});
		// await splitter.processFunds(0.03e18,{value:0.01e18});
		// await splitter.processFunds(0.08e18,{value:0.01e18});


// ---------- НАДО ПЕРЕДЕЛАТЬ В СПЛИТТЕРЕ ----------

													// for(uint i=0; i<childrenCount; ++i){
													// 	IWeiReceiver c = IWeiReceiver(children[i]);
													// 	uint needed = c.getTotalWeiNeeded(_currentFlow);

													// 	// send money. can throw!
													// 	// we sent needed money but specifying TOTAL amount of flow
													// 	// this help relative Splitters to calculate how to split money
													// 	c.processFunds.value(needed)(_currentFlow);
													// }

		// var totalNeed = await splitter.getTotalWeiNeeded(0);
		// var minNeed = await splitter.getMinWeiNeeded();
		// var isNeed = await splitter.isNeedsMoney();
		// assert.equal(totalNeed.toNumber(), 0.88e18);
		// assert.equal(minNeed.toNumber(), 0);
		// assert.equal(isNeed, true);	

		// await splitter.processFunds(0.4e18,{value:0.4e18});
		// await splitter.processFunds(0.48e18,{value:0.48e18});

		// var totalNeed = await splitter.getTotalWeiNeeded(0);
		// var minNeed = await splitter.getMinWeiNeeded();
		// var isNeed = await splitter.isNeedsMoney();
		// assert.equal(totalNeed.toNumber(), 0);
		// assert.equal(minNeed.toNumber(), 0);
		// assert.equal(isNeed, false);	
	});
});

/*contract('ConditionalFund', (accounts) => {
	let money = web3.toWei(0.001, "ether");

	const creator = accounts[0];
	const employee1 = accounts[1];
	const employee2 = accounts[2];
	const outsider = accounts[3];

	beforeEach(async() => {
	});

	it('Should create fund with push model',async() => {
		let neededAmount = 1e18;
		let output = employee2;
		let isAutoWithdraw = true;
		let nextTargetOutput = '0x0';
		let allowFlushTo = false;
		let isPeriodic = false;
		let periodHours = 0;

		let weiFund2 = await WeiFund2.new(neededAmount, output, isAutoWithdraw, nextTargetOutput, allowFlushTo, isPeriodic, periodHours);
		let b1 = await web3.eth.getBalance(employee2);
		await weiFund2.processFunds(5e17, {value:5e17});
		await weiFund2.processFunds(5e17, {value:5e17});
		let b2 = await web3.eth.getBalance(employee2);
		assert.equal(b2.toNumber()-b1.toNumber(), 1e18);

		await weiFund2.processFunds(5e17, {value:5e17});
		await weiFund2.processFunds(5e17, {value:5e17});
		let b3 = await web3.eth.getBalance(employee2);
		assert.equal(b3.toNumber()-b1.toNumber(), 2e18);

		await weiFund2.processFunds(5e17, {value:4e18});
		let b4 = await web3.eth.getBalance(employee2);
		assert.equal(b4.toNumber()-b1.toNumber(), 6e18);
	});

	it('Should create fund with pull model',async() => {
		let neededAmount = 1e18;
		let output = '0x0';
		let isAutoWithdraw = false;
		let allowFlushTo = false;
		let isPeriodic = false;
		let periodHours = 0;

		let weiFund2NextOutput = await WeiFund2.new(neededAmount, employee2, true, '0x0', allowFlushTo, isPeriodic, periodHours);
		let weiFund2 = await WeiFund2.new(neededAmount, employee2, false, weiFund2NextOutput.address, allowFlushTo, isPeriodic, periodHours);
		

		let b1 = await web3.eth.getBalance(employee2);
		let w1 = await web3.eth.getBalance(weiFund2.address);
		let wn1 = await web3.eth.getBalance(weiFund2NextOutput.address);

		await weiFund2.processFunds(5e17, {value:5e17});
		await weiFund2.processFunds(5e17, {value:5e17});

		let b2 = await web3.eth.getBalance(employee2);
		await weiFund2.flush();
		let b3 = await web3.eth.getBalance(employee2);
		
		let w2 = await web3.eth.getBalance(weiFund2.address);
		let wn2 = await web3.eth.getBalance(weiFund2NextOutput.address);

		assert.equal(b2.toNumber()-b1.toNumber(), 0);
		assert.equal(w2.toNumber()-w1.toNumber(), 0);
		assert.equal(wn2.toNumber()-wn1.toNumber(), 0);
		assert.equal(b3.toNumber()-b2.toNumber(), 1e18);

		await weiFund2.processFunds(5e17, {value:5e17});
		await weiFund2.processFunds(5e17, {value:5e17});
		await weiFund2.processFunds(1e18, {value:1e18});

		let w3 = await web3.eth.getBalance(weiFund2.address);
		let wn3 = await web3.eth.getBalance(weiFund2NextOutput.address);

		console.log()
		// assert.equal(w3.toNumber()-w2.toNumber(), 1e18);
		// assert.equal(wn3.toNumber()-wn2.toNumber(), 1e18);
		await weiFund2.flush();
		await weiFund2NextOutput.flush();

		let b4 = await web3.eth.getBalance(employee2);
		assert.equal(b4.toNumber()-b3.toNumber(), 2e18);
	});
});*/