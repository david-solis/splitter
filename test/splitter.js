const expectedExceptionPromise = require("./utils/expectedException.js");
const {toBN, toWei, asciiToHex} = web3.utils;
const {getBalance} = web3.eth;

const Splitter = artifacts.require("Splitter");

contract('Splitter', accounts => {
    const [owner, first, second, unauthorised] = accounts;
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    let splitter;
    const maxGas = 15000000;

    const getEventResult = (txObj, eventName) => {
        const event = txObj.logs.find(log => log.event === eventName);

        if (event) {
            return event.args;
        }
        else {
            return undefined;
        }
    };

    beforeEach("deploy new Splitter", async () => {
        splitter = await Splitter.new({from: owner});
    });

    describe("deploy", function () {
        it("should have balances before split equal to zero", async () => {
            const balBefore1 = await splitter.balances.call(first);
            const balBefore2 = await splitter.balances.call(second);
            assert.strictEqual(balBefore1.toString(), "0", "Failed to deploy with " + first + " address equalling zero");
            assert.strictEqual(balBefore2.toString(), "0", "Failed to deploy with " + second + " address equalling zero");
        });
    });

    describe("access", function () {
        it("should  be possible to split when sender is not the owner", async function () {
            const txObj = await splitter.split(first, second, {from: unauthorised, value: 100, gas: maxGas});
            assert.isTrue(txObj.receipt.status, "receipt status must be true");
        });
    });

    describe("control", function () {
        it("should not be possible to split when contract is paussed", async function () {
            await splitter.setPaused(true, {from: owner});
            await expectedExceptionPromise(
                () => splitter.split(first, second, {from: owner, value: 100, gas: maxGas}),
                maxGas);
        });
    });

    describe("split", function () {
        it("should split ether between 2 addresses", async () => {
            const txObj = await splitter.split(first, second, {from: owner, value: 99, gas: maxGas});
            assert.isTrue(txObj.receipt.status, "receipt status must be true");

            const acc1 = await splitter.balances.call(first);
            const acc2 = await splitter.balances.call(second);
            // Check contract storage
            assert.equal(acc1.toString(), 49, "failed to split ether equaly");
            assert.equal(acc2.toString(), 50, "failed to split ether equaly");
            // Check event
            event = getEventResult(txObj, "LogSplit");
            assert.strictEqual(event.sender, owner, "sender mismatch");
            assert.strictEqual(event.first, first, "first mismatch");
            assert.strictEqual(event.second, second, "second mismatch");
            assert.equal(event.amount, 99, "amount mismatch");
        });

        it("should reject direct transaction with value", async function () {
            await expectedExceptionPromise(
                () => splitter.sendTransaction({from: owner, value: 1, gas: maxGas}),
                maxGas);
        });

        it("should reject direct transaction without value", async function () {
            await expectedExceptionPromise(
                () => splitter.sendTransaction({from: owner, gas: maxGas}),
                maxGas);
        });

        it("should reject without Ether", async function () {
            await expectedExceptionPromise(
                () => splitter.split(first, second, {from: owner, gas: maxGas}),
                maxGas);
        });

        it("should reject with 1 Wei", async function () {
            await expectedExceptionPromise(
                () => splitter.split(first, second, {from: owner, value: 1, gas: maxGas}),
                maxGas);
        });

        it("should reject if first equals to second", async function () {
            await expectedExceptionPromise(
                () => splitter.split(first, first, {from: owner, value: 1000, gas: maxGas}),
                maxGas);
        });

        it("should reject without first", async function () {
            await expectedExceptionPromise(
                () => splitter.split(zeroAddress, second, {from: owner, value: 1000, gas: maxGas}),
                maxGas);
        });

        it("should reject without second", async function () {
            await expectedExceptionPromise(
                () => splitter.split(first, zeroAddress, {from: owner, value: 1000, gas: maxGas}),
                maxGas);
        });
    });

    describe("withdraw", function() {

        beforeEach("split 4001", async() => {
            await splitter.split(first, second, { from: owner, value: 4001, gas: maxGas });
        });

        it("should reject withdraw by owner", async function() {
            await expectedExceptionPromise(
                () => splitter.withdraw({ from: owner, gas: maxGas }),
                maxGas);
        });

        it("should reject withdraw if value passed", async function() {
            await expectedExceptionPromise(
                () => splitter.withdraw({ from: first, value: 1, gas: maxGas }),
                maxGas);
        });

        it("should emit a single event when first withdraws", async function() {
            await splitter.withdraw({ from: first })
                .then(txObject => {
                    assert.strictEqual(txObject.logs.length, 1);
                    assert.strictEqual(txObject.logs[0].event, "LogWithdrawn");
                    assert.strictEqual(txObject.logs[0].args.sender, first);
                    assert.strictEqual(txObject.logs[0].args.balance.toString(10), "2000");
                });
        });

        it("should reduce splitter balance by withdrawn amount", async function() {
            await splitter.withdraw({ from: first });
            // Check contract balance
            const balance = await getBalance(splitter.address);
            assert.strictEqual(balance.toString(10), "2001", "contract balance mismatch");
            // Check contract storage
            const acc1 = await splitter.balances.call(first);
            assert.equal(acc1.toString(), 0, "should be zero");
        });

        it("should affect first balance", async function() {
            const previousBalance = toBN(await getBalance(first));
            const txObject = await splitter.withdraw({ from: first });
            // Check first's balance
            const transaction = await web3.eth.getTransaction(txObject.tx);
            const gasPrice = toBN(txObject.receipt.gasUsed).mul(toBN(transaction.gasPrice));
            const finalBalance = toBN(await getBalance(first));
            // finalBalance = previousBalance + 2000 - gasPrice
            assert.isTrue(previousBalance.sub(gasPrice).add(toBN(2000)).eq(finalBalance), "first balance mismatch");
        });

        it("should reject first withdrawing twice", async function() {
            await splitter.withdraw({ from: first })
                .then(expectedExceptionPromise(
                    async () => await splitter.withdraw({ from: first, gas: maxGas }),
                    maxGas));
        });
    });
});
