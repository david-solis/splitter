const expectedExceptionPromise = require("./utils/expectedException.js");

const Splitter = artifacts.require("Splitter");

contract('Splitter', accounts => {
    const [owner, first, second, newOwner, unauthorised] = accounts;
    let splitter;
    const maxGas = 15000000;

    const getEventResult = (txObj, eventName) => {
        const event = txObj.logs.find(log => log.event === eventName);

        if (event) {
            return event.args;
        } else {
            return undefined;
        }
    };

    beforeEach("deploy new Splitter", function () {
        return Splitter.new({from: owner})
            .then(instance => splitter = instance);
    });

    describe("owner", function () {
        it("Change owner", async () => {
            const txObj = await splitter.setOwner(newOwner, {from: owner});
            assert.isTrue(txObj.receipt.status, "status must be true");
            const event = getEventResult(txObj, "LogOwnerSet");
            assert.equal(event.previousOwner, owner, "New owner must be changed");
            assert.equal(event.newOwner, newOwner, "New owner must be set");
        });

        it("should not be possible to split when sender is not the owner", async function () {
            await expectedExceptionPromise(
                () => splitter.split(first, second, {from: unauthorised, value: 100, gas: maxGas}),
                maxGas);
        });
    });
});

