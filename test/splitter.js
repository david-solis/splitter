const expectedExceptionPromise = require("./utils/expectedException.js");

const Splitter = artifacts.require("Splitter");

contract('Splitter', accounts => {
    const [owner, first, second, newOwner, unauthorised] = accounts;
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    let instance;
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

    beforeEach(async () => {
        instance = await Splitter.new({from: owner});
    });

    describe("deploy", function () {
        it("should have balances before split equal to zero", async () => {
            const balBefore1 = await instance.balances.call(first);
            const balBefore2 = await instance.balances.call(second);

            assert.equal(balBefore1.toString(), 0, "Failed to deploy with " + first + " address equalling zero");
            assert.equal(balBefore2.toString(), 0, "Failed to deploy with " + second + " address equalling zero");
        });
    });

    describe("owner", function () {
        it("Change owner", async () => {
            const txObj = await instance.setOwner(newOwner, {from: owner});
            assert.isTrue(txObj.receipt.status, "status must be true");
            const event = getEventResult(txObj, "LogOwnerSet");
            assert.equal(event.previousOwner, owner, "New owner must be changed");
            assert.equal(event.newOwner, newOwner, "New owner must be set");
        });

        it("should not be possible to split when sender is not the owner", async function () {
            await expectedExceptionPromise(
                () => instance.split(first, second, {from: unauthorised, value: 100}),
                maxGas);
        });
    });

    describe("pause", function () {
        it("should allow pause and unpause of contract", async () => {
            var txObj = await instance.setPaused(true, {from: owner});
            assert.isTrue(txObj.receipt.status, "receiptstatus must be true");

            var event = getEventResult(txObj, "LogPausedSet");
            assert.equal(event.sender, owner, "function must have been execute by owner");
            assert.equal(event.newPausedState, true, "contract must be paused");

            txObj = await instance.setPaused(false, {from: owner});
            assert.isTrue(txObj.receipt.status, "receipt status must be true");

            event = getEventResult(txObj, "LogPausedSet");
            assert.equal(event.sender, owner, "function must have been execute by owner");
            assert.equal(event.newPausedState, false, "failed to unpause");
        });

        it("should not be possible to split when contract is paussed", async function () {
            await instance.setPaused(true, {from: owner});
            await expectedExceptionPromise(
                () => instance.split(first, second, {from: owner, value: 100}),
                maxGas);
        });
    });

    describe("split", function () {
        it("should split ether between 2 addresses", async () => {
            const ether = 99;
            const txObj = await instance.split(first, second, {from: owner, value: ether});

            assert.isTrue(txObj.receipt.status, "receipt status must be true");
            const acc1 = await instance.balances.call(first);
            const acc2 = await instance.balances.call(second);

            const half = Math.floor((ether / 2));
            assert.equal(acc1.toString(), half, "failed to split ether equaly");
            assert.equal(acc2.toString(), ether - half, "failed to split ether equaly");
        });

        it("should reject direct transaction with value", async function () {
            await expectedExceptionPromise(
                () => instance.sendTransaction({from: owner, value: 1, gas: maxGas}),
                maxGas);
        });

        it("should reject direct transaction without value", async function () {
            await expectedExceptionPromise(
                () => instance.sendTransaction({from: owner, gas: maxGas}),
                maxGas);
        });

        it("should reject without Ether", async function () {
            await expectedExceptionPromise(
                () => instance.split(first, second, {from: owner, gas: maxGas}),
                maxGas);
        });

        it("should reject with 1 Wei", async function () {
            await expectedExceptionPromise(
                () => instance.split(first, second, {from: owner, value: 1, gas: maxGas}),
                maxGas);
        });

        it("should reject without first", async function () {
            await expectedExceptionPromise(
                () => instance.split(zeroAddress, second, {from: owner, value: 1000, gas: maxGas}),
                maxGas);
        });

        it("should reject without second", async function () {
            await expectedExceptionPromise(
                () => instance.split(first, zeroAddress, {from: owner, value: 1000, gas: maxGas}),
                maxGas);
        });
    });

    describe("withdraw", function() {

        beforeEach("split 4001 first", async() => {
            await instance.split(first, second, { from: owner, value: 4001 });
        });

        it("should reject withdraw by owner", async function() {
            await expectedExceptionPromise(
                () => instance.withdraw({ from: owner, gas: maxGas }),
                maxGas);
        });

        it("should reject withdraw if value passed", async function() {
            await expectedExceptionPromise(
                () => instance.withdraw({ from: first, value: 1, gas: maxGas }),
                maxGas);
        });

        it("should emit a single event when first withdraws", async function() {
            await instance.withdraw({ from: first })
                .then(txObject => {
                    assert.strictEqual(txObject.logs.length, 1);
                    assert.strictEqual(txObject.logs[0].event, "LogWithdrawn");
                    assert.strictEqual(txObject.logs[0].args.sender, first);
                    assert.strictEqual(txObject.logs[0].args.balance.toString(10), "2000");
                });
        });

        it("should reduce splitter balance by withdrawn amount", async function() {
            await instance.withdraw({ from: first })
                .then(txObject => web3.eth.getBalance(instance.address))
                .then(balance => assert.strictEqual(balance.toString(10), "2001"));
        });

        it("should reject first withdrawing twice", async function() {
            await instance.withdraw({ from: first })
                .then(txObject => expectedExceptionPromise(
                    async () => await instance.withdraw({ from: first, gas: maxGas }),
                    maxGas));
        });
    });
});
