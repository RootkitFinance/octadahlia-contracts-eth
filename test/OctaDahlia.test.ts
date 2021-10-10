import { ethers } from "hardhat";
import { utils, constants, Contract } from "ethers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ContractFunction } from "hardhat/internal/hardhat-network/stack-traces/model";

import { OctaDahlia } from "../typechain/OctaDahlia";
import { createUniswap } from './helpers'
import { Address } from "cluster";


describe.only("OctaDahlia", async function () {

    let owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress, attacker: SignerWithAddress;
    let octaDahlia: OctaDahlia & Contract;
    let pairedToken: Contract;
    let uniswap: {
        router: Contract;
        factory: Contract;
        weth: Contract;
        UniswapV2PairJson: { abi: any, bytecode: any };
        UniswapV2Router02Json: { abi: any, bytecode: any }
    };
    let pair: Contract;

    beforeEach(async function () {
        [owner, user1, user2, user3, attacker] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        // Initialize an OctoDahlia Token
        const octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
        octaDahlia = (await octaDahliaFactory.connect(owner).deploy()) as any as OctaDahlia & Contract

        // Create a Token
        const pairedFactory = await ethers.getContractFactory("ERC20Test");
        pairedToken = await pairedFactory.connect(owner).deploy();

        // Give Octodahlia and Uniswap Router Max Borrow from Owner Account
        await pairedToken.connect(owner).approve(octaDahlia.address, constants.MaxUint256);
        await pairedToken.connect(owner).approve(uniswap.router.address, constants.MaxUint256);

        // Create Uniswap Pair (Paired Token <-> OctaDahlia Token)
        await uniswap.factory.connect(owner).createPair(octaDahlia.address, pairedToken.address)

        let pair_address = await uniswap.factory.connect(owner).getPair(octaDahlia.address, pairedToken.address)
        pair = await ethers.getContractAt(uniswap.UniswapV2PairJson.abi, pair_address)
    })

    describe('setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator)', function () {
        it('should only initialize once', async function () {
            let mge_address = user3.address

            await expect(octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge_address, false)).to.not.be.reverted
            await expect(octaDahlia.connect(owner).setUp(uniswap.router.address, user1.address, user2.address, mge_address, false)).to.be.reverted
        })

        it('should only allow pair that includes correct token', async function () {
            let mge_address = user3.address
            
            await uniswap.factory.connect(owner).createPair(uniswap.weth.address, pairedToken.address)

            let wrong_pair_address = await uniswap.factory.connect(owner).getPair(uniswap.weth.address, pairedToken.address)
            let wrong_pair = await ethers.getContractAt(uniswap.UniswapV2PairJson.abi, wrong_pair_address)

            await expect(octaDahlia.connect(owner).setUp(wrong_pair_address.address, user1.address, user2.address, mge_address, false)).to.be.reverted
        })
    })

    describe('balanceAdjustment(bool increase, uint256 _amount, address _account)', function () {
        it('should revert if not msg.sender not from rift or mge', async function() {
            let mge = user3
            await expect(octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)).to.not.be.reverted

            await expect(octaDahlia.connect(mge).balanceAdjustment(true, 0, mge.address)).to.not.be.reverted
            await expect(octaDahlia.connect(user1).balanceAdjustment(true, 0, mge.address)).to.be.reverted
        })

        it('should mint amount to account', async function() {
            let mge = user3
            let MINT_AMOUNT = 10;
            await octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)

            await expect(octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)).to.not.be.reverted
            await expect(await octaDahlia.connect(mge).balanceOf(mge.address)).to.equal(MINT_AMOUNT)
        })

        it('should burn amount from account', async function() {
            let mge = user3
            let MINT_AMOUNT = 100;
            let BURN_AMOUNT = 10;

            await octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)
            await octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)
            await octaDahlia.connect(mge).balanceAdjustment(false, BURN_AMOUNT, mge.address)

            await expect(await octaDahlia.connect(mge).balanceOf(mge.address)).to.equal(MINT_AMOUNT - BURN_AMOUNT)
        })

        it('should revert burn amount from account if burn > balance', async function() {
            let mge = user3
            let MINT_AMOUNT = 100;
            let BURN_AMOUNT = 110;

            await expect(octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)).to.not.be.reverted
            await expect(octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)).to.not.be.reverted

            await expect(octaDahlia.connect(mge).balanceAdjustment(false, BURN_AMOUNT, mge.address)).to.be.revertedWith("ERC20: burn too much")
        })

    })

    describe('alignPrices()', function () {

        function getAmountOut(amountIn: number, tokenPairBalance: number, octoPairBalance: number ): number {
            let amountInWithFee = amountIn * 997;
            let numerator = amountInWithFee * tokenPairBalance;
            let denominator = octoPairBalance * 1000 + amountInWithFee;
            return Math.floor(numerator / denominator)
        }

        it.skip('should align price', async function() {
            let mge = user3
            let rift = owner;
            let RIFT_OCTO_BALANCE = 10;
            let UNI_PAIR_BALANCE = 100;
            let UNI_OCTO_BALANCE = 100;

            await octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)
            
            // Set Rift and Token Balance
            await octaDahlia.connect(rift).balanceAdjustment(true, RIFT_OCTO_BALANCE, rift.address)
            await octaDahlia.connect(rift).balanceAdjustment(true, RIFT_OCTO_BALANCE, rift.address)
            await octaDahlia.connect(rift).balanceAdjustment(true, UNI_OCTO_BALANCE, pair.address,)
            
            await pairedToken.connect(owner).transfer(pair.address, UNI_PAIR_BALANCE)

            ///Revert
            await expect(octaDahlia.connect(mge).alignPrices()).to.not.be.reverted

            await expect(octaDahlia.connect(rift).alignPrices()).to.not.be.reverted

        })
    })

    describe('recoverTokens(IERC20 token)', function () { 
        it('should transfer tokens from octodahlia to user', async function() {     
            
            // Setup OctaDahlia, the send octadahlia 100 tokens
            await octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, user3.address, false)
            await pairedToken.connect(owner).transfer(octaDahlia.address, 100)

            // Check balance of user1 is zero
            await expect(await pairedToken.connect(owner).balanceOf(user1.address)).to.equal(0)
            // Transfer all Octadahlia tokens to user1
            await octaDahlia.connect(user1).recoverTokens(pairedToken.address)

            await expect(await pairedToken.connect(owner).balanceOf(user1.address)).to.equal(100)
        })
    })
    describe('addOrChangeFriends(uint256 indexSpot, address friend)', function () {
        it('should alow setting friends', async function() {
            await octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, owner.address, false)

            await expect(octaDahlia.connect(user1).addOrChangeFriends(2, user3.address)).to.be.reverted

            await octaDahlia.connect(owner).addOrChangeFriends(2, user3.address)
            await expect(await octaDahlia.friendCount()).to.equal(1)
            await expect(await octaDahlia.friends(2)).to.equal(user3.address)
        })
     })

    describe('transferFrom(address sender, address recipient, uint256 amount)', function() {
        it('should not allow attacker to steal from unlocked pair liquid unlocked', async function() {
            let mge = user3
            let rift = owner;
            let RIFT_BALANCE = 10_000;

            await expect(octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge.address, false)).to.not.be.reverted
            await expect(octaDahlia.connect(rift).balanceAdjustment(true, RIFT_BALANCE, rift.address)).to.not.be.reverted

            await expect(octaDahlia.connect(attacker).transferFrom(rift.address, attacker.address, 100)).to.be.revertedWith("ERC20: allow")

            await expect(await octaDahlia.connect(attacker).balanceOf(attacker.address)).to.equal(0)

        })
    })

    describe.skip('internal', function() {
        describe('_transfer(address sender, address recipient, uint256 amount) internal', function () { })
        describe('_burnAndFees(address account, uint256 amount, uint256 burnPercent) internal', function () { })
        describe('dynamicBurnRate() internal', function () { })
        describe('getAmountOut(uint amountIn) internal', function () { })
    })

})
