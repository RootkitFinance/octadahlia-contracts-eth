import { ethers } from "hardhat";
import { utils, constants, Contract } from "ethers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ContractFunction } from "hardhat/internal/hardhat-network/stack-traces/model";

import { MultiOwned } from "../typechain/MultiOwned";

describe("MultiOwned", async function () {

    let owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress;
    let multiOwned: MultiOwned

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const multiOwnedFactory = await ethers.getContractFactory("OctaDahlia");
        multiOwned = (await multiOwnedFactory.connect(owner).deploy()) as any as MultiOwned
        return multiOwned
    })

    describe('setInitialOwners(address owner1, address owner2, address owner3)', function () {
        it('should set only once', async function () {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)

            let res = await multiOwned.ownerIndex(owner.address)
            await expect(multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)).to.be.reverted
        })
    })

    describe('transferOwnership(address newOwner)', function () {
        it('should replace ownership to new user, if not owner', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            
            await expect(await multiOwned.connect(user1).isOwner(user3.address)).to.be.false
            await multiOwned.connect(user1).transferOwnership(user3.address)
            await expect(await multiOwned.connect(user1).isOwner(user3.address)).to.be.true
        })

        it('should not replace ownership to new owner, iff owner', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)

            await expect(await multiOwned.connect(owner).isOwner(user3.address)).to.be.false
            await multiOwned.connect(owner).transferOwnership(user3.address)
            await expect(await multiOwned.connect(user1).isOwner(user3.address)).to.be.false
        })
    })
    
    describe('claimOwnership()', function () {
        it('should not allow a non pendingOwner to claimOwnership', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            
            await expect(multiOwned.connect(user1).claimOwnership()).to.be.reverted
            await expect(multiOwned.connect(user3).claimOwnership()).to.be.reverted
        })
        it('should allow new pendingOwner to claimOwnership', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            
            await multiOwned.connect(owner).transferOwnership(user3.address)
            await expect(multiOwned.connect(user3).claimOwnership()).to.not.be.reverted

            await expect(await multiOwned.connect(user3).owners(1)).to.equal(user3.address)
            await expect(await multiOwned.connect(user3).ownerIndex(user3.address)).to.equal(1)
        })
    })

    describe('addExtraOwners(uint256 indexSpot, address newOwner)', function () {
        
        it('should reject replacing an owner if sender is not owner', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            await expect(multiOwned.connect(user1).addExtraOwners(3, user3.address)).to.be.reverted
        })

        it('should reject if indexspot is zero', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            await expect(multiOwned.connect(owner).addExtraOwners(0, user3.address)).to.be.reverted
        })

        it('should allow pushing only up to 8 owners iff sender is owner, dictator is off', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)

            let users = await ethers.getSigners()

            for (let i = 4; i < 9; i++) {
                await expect(multiOwned.connect(owner).addExtraOwners(i, users[i].address)).to.not.be.reverted
                await expect(await multiOwned.connect(owner).isOwner(users[i].address)).to.be.true
                
            }
            await expect(multiOwned.connect(owner).addExtraOwners(9, users[9].address)).to.be.reverted

            let count = await multiOwned.connect(owner).ownerCount()
            expect(count).to.be.equal(8)
        })

        it('should not allow replacing owners if dictator modifier is off', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            await expect(multiOwned.connect(owner).addExtraOwners(2, user3.address)).to.be.reverted
        })

        it.skip('should allow replacing any owner if dictator modifier is on', async function() {
            await multiOwned.connect(owner).setInitialOwners(owner.address, user1.address, user2.address)
            await expect(multiOwned.connect(owner).addExtraOwners(2, user3.address)).to.not.be.reverted
        })
    })

})