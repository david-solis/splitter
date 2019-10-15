const expectedExceptionPromise = require("./utils/expectedException.js");
const Owned = artifacts.require("Owned");

contract('Owned', accounts => {
    const [owner, newOwner] = accounts;
    let owned;

    const getEventResult = (txObj, eventName) => {
        const event = txObj.logs.find(log => log.event === eventName);

        if (event) {
            return event.args;
        }
        else {
            return undefined;
        }
    };

    beforeEach("deploy new Owned", async () => {
        owned = await Owned.new({from: owner});
    });

    describe("owner", function () {
        it("Initial owner", async () => {
            assert.strictEqual(await owned.getOwner(), owner);
        });

        it("should not be possible to change owner if not owner", async function () {
            await expectedExceptionPromise(
                () => owned.setOwner(newOwner, {from: newOwner}));
        });

        it("Change owner", async () => {
            const txObj = await owned.setOwner(newOwner, {from: owner});
            assert.isTrue(txObj.receipt.status, "status must be true");
            // We expect one event
            assert.strictEqual(txObj.receipt.logs.length, 1);
            assert.strictEqual(txObj.logs.length, 1);
            // Check contract
            assert.equal(await owned.getOwner(), newOwner);
            // Check event
            const event = getEventResult(txObj, "LogOwnerSet");
            assert.equal(event.previousOwner, owner, "New owner must be changed");
            assert.equal(event.newOwner, newOwner, "New owner must be set");
        });
    });
});

