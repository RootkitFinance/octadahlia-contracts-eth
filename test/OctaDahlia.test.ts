import { ethers, network } from "hardhat";
import { utils, constants, Contract, BigNumber } from "ethers";
import { expect, util } from "chai";
import { parseEther } from "ethers/lib/utils";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { OctaDahlia } from "../typechain/OctaDahlia";
import { createUniswap } from './helpers'
import { ERC20, ERC20Test, IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Router02, LiquidityLockedERC20 } from "../typechain";



function hhSetBalance(address: string, balance: string) {
    return network.provider.send("hardhat_setBalance", [
        address,
        balance,
    ]);
}

/**
 * Impersonate an Account
 * @param signer Account to Impersonate
 * @param callback Action during impersonation
 */
async function hhImpersonate(address: string, callback: (signer: SignerWithAddress) => Promise<any>) {
    // Set Request
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
    });

    let res = await callback(await ethers.getSigner(address))

    // End Request
    await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [address],
    });

    return res;
}

describe("OctaDahlia", async function () {

    let owner: SignerWithAddress;
    let attacker: SignerWithAddress;
    let users: SignerWithAddress[];

    let octaDahlia: OctaDahlia & LiquidityLockedERC20;
    let tokenA: ERC20Test;
    let tokenB: ERC20Test;
    let uniswap: {
        router: IUniswapV2Router02;
        factory: IUniswapV2Factory;
        weth: ERC20;
        pairFor: (address: string) => IUniswapV2Pair,
        UniswapV2PairJson: { abi: any, bytecode: any };
        UniswapV2Router02Json: { abi: any, bytecode: any }
    };
    let pair_octo_A: IUniswapV2Pair;
    let pair_A_B: IUniswapV2Pair;

    beforeEach(async function () {
        [owner, attacker, ...users] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        // Create Tokens A/B/Octo
        const octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
        const testTokenFactory = await ethers.getContractFactory("ERC20Test");

        octaDahlia = (await octaDahliaFactory.connect(owner).deploy()) as any as OctaDahlia & Contract
        tokenA = await testTokenFactory.connect(owner).deploy("Test Token A", "TKNA", 0);
        tokenB = await testTokenFactory.connect(owner).deploy("Test Token B", "TKNB", 0);

        // Create Uniswap Pair Tokens (TokenA <-> OctaDahlia Token)
        await uniswap.factory.connect(owner).createPair(octaDahlia.address, tokenA.address)
        await uniswap.factory.connect(owner).createPair(tokenB.address, tokenA.address)

        pair_octo_A = uniswap.pairFor(await uniswap.factory.connect(owner).getPair(octaDahlia.address, tokenA.address))
        pair_A_B = uniswap.pairFor(await uniswap.factory.connect(owner).getPair(tokenA.address, tokenB.address))

        // Set Pair Balances for Impersonation Tx
        await hhSetBalance(pair_octo_A.address, (await owner.getBalance()).toHexString())
        await hhSetBalance(pair_A_B.address, (await owner.getBalance()).toHexString())
    })

    describe('setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator)', function () {
        it('should only initialize once', async function () {
            let mge_address = users[2].address

            await expect(octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge_address, false, 0, 0)).to.not.be.reverted
            await expect(octaDahlia.connect(owner).setUp(uniswap.router.address, users[0].address, users[1].address, mge_address, false, 0, 0)).to.be.reverted
        })

        it('should only allow pair that includes correct token', async function () {
            let mge_address = users[2].address

            await uniswap.factory.connect(owner).createPair(uniswap.weth.address, tokenA.address)

            let wrong_pair_address = await uniswap.factory.connect(owner).getPair(uniswap.weth.address, tokenA.address)
            let wrong_pair = await ethers.getContractAt(uniswap.UniswapV2PairJson.abi, wrong_pair_address) as any as IUniswapV2Pair

            await expect(octaDahlia.connect(owner).setUp(wrong_pair.address, users[0].address, users[1].address, mge_address, false, 0, 0)).to.be.reverted
        })
    })

    describe('balanceAdjustment(bool increase, uint256 _amount, address _account)', function () {
        it('should revert if not msg.sender not from rift or mge', async function () {
            let mge = users[2]
            await expect(octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)).to.not.be.reverted

            await expect(octaDahlia.connect(mge).balanceAdjustment(true, 0, mge.address)).to.not.be.reverted
            await expect(octaDahlia.connect(users[0]).balanceAdjustment(true, 0, mge.address)).to.be.reverted
        })

        it('should mint amount to account', async function () {
            let mge = users[2]
            let MINT_AMOUNT = 10;
            await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)

            await expect(octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)).to.not.be.reverted
            await expect(await octaDahlia.connect(mge).balanceOf(mge.address)).to.equal(MINT_AMOUNT)
        })

        it('should burn amount from account', async function () {
            let mge = users[2]
            let MINT_AMOUNT = 100;
            let BURN_AMOUNT = 10;

            await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)
            await octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)
            await octaDahlia.connect(mge).balanceAdjustment(false, BURN_AMOUNT, mge.address)

            await expect(await octaDahlia.connect(mge).balanceOf(mge.address)).to.equal(MINT_AMOUNT - BURN_AMOUNT)
        })

        it('should revert burn amount from account if burn > balance', async function () {
            let mge = users[2]
            let MINT_AMOUNT = 100;
            let BURN_AMOUNT = 110;

            await expect(octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)).to.not.be.reverted
            await expect(octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)).to.not.be.reverted

            await expect(octaDahlia.connect(mge).balanceAdjustment(false, BURN_AMOUNT, mge.address)).to.be.revertedWith("ERC20: burn too much")
        })

    })


    describe('transfer(address recipient, uint256 amount)', async function () {

        // beforeEach(async function() {
        //     let BURN_RATE = 1;

        //     await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, owner.address, false, BURN_RATE, 0)
        // })
        describe('Basic sender and recipient, (direct transactions)', function () {

            it('should on transfer 100, take 3.21% + 0% burnRate, (0.9679), -> send 97', async function () {
                let MINT_AMOUNT = 10000;
                let BURN_RATE = 0; // 0%
                let mge = users[2];
                let rift = owner;

                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, BURN_RATE, 0)

                await expect(octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)).to.not.be.reverted

                await octaDahlia.connect(mge).transfer(users[1].address, 100)

                let user1_balance = await octaDahlia.connect(owner).balanceOf(users[1].address)
                let rift_balance = await octaDahlia.connect(owner).balanceOf(rift.address)

                let transfer = Math.round(100 * (1 - 0.0321)) // 97
                let fee = Math.round(100 * 0.0321)

                // Expect 97 transfer
                await expect(user1_balance).to.equal(transfer)

                // Expect Rift Transfer
                await expect(rift_balance).to.equal(fee)

            })

            it('should on transfer 100, take 3.21% + 1% burnRate, (0.9579), -> send 96', async function () {
                let MINT_AMOUNT = 10000;
                let BURN_RATE = 100; // 1%
                let mge = users[2];
                let rift = owner;

                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, BURN_RATE, 0)

                await octaDahlia.connect(mge).balanceAdjustment(true, MINT_AMOUNT, mge.address)

                let owner_balance = await octaDahlia.connect(mge).balanceOf(mge.address)

                await octaDahlia.connect(mge).transfer(users[1].address, 100)

                let user1_balance = await octaDahlia.connect(owner).balanceOf(users[1].address)
                let rift_balance = await octaDahlia.connect(owner).balanceOf(rift.address)

                let result = Math.round(100 * (1 - 0.0321 - 0.01)) // 96
                let fee = Math.round(100 * 0.0321)

                // Expect 96 transfer
                await expect(user1_balance).to.equal(result)

                // Expect Rift Transfer
                await expect(rift_balance).to.equal(fee)
            })
        })

        describe('Sell transactions from seller (liquidity provider) to pair', function () {

            it('should burn more if pool price is higher', async function () {
                let MINT_AMOUNT = utils.parseEther("50");
                let PAIR_AMOUNT = utils.parseEther("40");
                let BURN_RATE = 10 // 1%

                let seller = users[4]
                let rift = users[5]

                // Initialize OctaDahlia + Set Balance for MGE and PairV2
                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, owner.address, false, BURN_RATE, 0)

                // Mint for Accounts
                // Octo: Total Supply 50(e21)
                await octaDahlia.connect(owner).balanceAdjustment(true, MINT_AMOUNT, seller.address)
                await tokenA.connect(owner).testMint(seller.address, MINT_AMOUNT)
                await tokenB.connect(owner).testMint(seller.address, MINT_AMOUNT)
                let total_octo_supply = MINT_AMOUNT;
                let total_A_supply = MINT_AMOUNT;

                // Mint Octo for Pair
                // Octo: Total Supply 90
                // Please see: https://github.com/RootkitFinance/octadahlia-contracts-eth/issues/7
                await octaDahlia.connect(owner).balanceAdjustment(true, PAIR_AMOUNT, pair_octo_A.address)
                total_octo_supply = total_octo_supply.add(PAIR_AMOUNT);

                // Approve
                await octaDahlia.connect(seller).approve(uniswap.router.address, constants.MaxUint256)
                await tokenA.connect(seller).approve(uniswap.router.address, constants.MaxUint256)
                await tokenB.connect(seller).approve(uniswap.router.address, constants.MaxUint256)

                // Amount
                let amt = utils.parseEther('20')

                // Circulating Supply = 90 - 50 = 50 (of owner)
                let circ_supply = total_octo_supply.sub(PAIR_AMOUNT).abs();
                let dyn_burn_rate = (circ_supply.sub(PAIR_AMOUNT).abs().mul(9970).div(circ_supply))
                let burn_amount = dyn_burn_rate.add(BURN_RATE).mul(amt).div(10000)
                let fees = amt.mul(321).div(10000)

                let seller_before = await octaDahlia.balanceOf(seller.address)
                let pair_before = await octaDahlia.balanceOf(pair_octo_A.address)

                await uniswap.router
                    .connect(seller)
                    .addLiquidity(octaDahlia.address, tokenA.address, amt, amt, amt, amt, seller.address, 2e9)

                let seller_res = await octaDahlia.balanceOf(seller.address)
                let pair_res = await octaDahlia.balanceOf(pair_octo_A.address)

                expect(seller_res.toString()).to.equal(seller_before.sub(amt).toString())
                expect(pair_res.toString()).to.equal(pair_before.add(amt).sub(burn_amount).sub(fees).toString())
            })

            it('should burn less if pool price is lower', async function () {
                let MINT_AMOUNT = utils.parseEther("50");
                let PAIR_AMOUNT = utils.parseEther("60");
                let BURN_RATE = 10 // .1%

                let seller = users[4]

                // Initialize OctaDahlia + Set Balance for MGE and PairV2
                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, owner.address, false, BURN_RATE, 0)

                // Mint for Accounts
                // Octo: Total Supply 50(e21)
                await octaDahlia.connect(owner).balanceAdjustment(true, MINT_AMOUNT, seller.address)
                await tokenA.connect(owner).testMint(seller.address, MINT_AMOUNT)
                await tokenB.connect(owner).testMint(seller.address, MINT_AMOUNT)
                let total_octo_supply = MINT_AMOUNT;
                let total_A_supply = MINT_AMOUNT;

                // Mint Octo for Pair
                // Octo: Total Supply 110
                // Please see: https://github.com/RootkitFinance/octadahlia-contracts-eth/issues/7
                await octaDahlia.connect(owner).balanceAdjustment(true, PAIR_AMOUNT, pair_octo_A.address)
                total_octo_supply = total_octo_supply.add(PAIR_AMOUNT);

                // Approve
                await octaDahlia.connect(seller).approve(uniswap.router.address, constants.MaxUint256)
                await tokenA.connect(seller).approve(uniswap.router.address, constants.MaxUint256)
                await tokenB.connect(seller).approve(uniswap.router.address, constants.MaxUint256)

                // Amount
                let amt = utils.parseEther('20')

                // Circulating Supply = 110 - 60 = 50 (of seller)
                let circ_supply = total_octo_supply.sub(PAIR_AMOUNT).abs();
                let dyn_burn_rate = (circ_supply.sub(PAIR_AMOUNT).abs().mul(9970).div(circ_supply))
                // On Pool Price Lower
                dyn_burn_rate = dyn_burn_rate.add(100).gt(BURN_RATE) ? BigNumber.from(100) : dyn_burn_rate.sub(BURN_RATE).abs();
                let burn_amount = dyn_burn_rate.mul(amt).div(10000)
                let fees = amt.mul(321).div(10000)

                let seller_before = await octaDahlia.balanceOf(seller.address)
                let pair_before = await octaDahlia.balanceOf(pair_octo_A.address)

                await uniswap.router
                    .connect(seller)
                    .addLiquidity(octaDahlia.address, tokenA.address, amt, amt, amt, amt, seller.address, 2e9)

                let seller_res = await octaDahlia.balanceOf(seller.address)
                let pair_res = await octaDahlia.balanceOf(pair_octo_A.address)

                expect(seller_res.toString()).to.equal(seller_before.sub(amt).toString())
                expect(pair_res.toString()).to.equal(pair_before.add(amt).sub(burn_amount).sub(fees).toString())
            })
        })
        describe('Buy transactions from buyer (trader) to pair', function () {
            it('should burn more if pool price is higher', async function () {
                let MINT_AMOUNT = utils.parseEther("50");
                let PAIR_AMOUNT = utils.parseEther("40");
                let BURN_RATE = 10 // .1%
                let MAX_BUY_PERCENT = 10000 // 100%

                let provider = users[4]
                let buyer = users[5]

                // Initialize OctaDahlia + Set Balance for MGE and PairV2
                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, owner.address, false, BURN_RATE, MAX_BUY_PERCENT)

                // Mint for Accounts
                // Octo: Total Supply 50(e21)
                await octaDahlia.connect(owner).balanceAdjustment(true, MINT_AMOUNT, provider.address)

                let total_octo_supply = MINT_AMOUNT;

                // Mint Octo for Pair
                // Octo: Total Supply 110
                // Please see: https://github.com/RootkitFinance/octadahlia-contracts-eth/issues/7
                await octaDahlia.connect(owner).balanceAdjustment(true, PAIR_AMOUNT, pair_octo_A.address)
                total_octo_supply = total_octo_supply.add(PAIR_AMOUNT);

                // Approve
                await octaDahlia.connect(provider).approve(uniswap.router.address, constants.MaxUint256)
                await tokenA.connect(provider).approve(uniswap.router.address, constants.MaxUint256)
                await tokenB.connect(provider).approve(uniswap.router.address, constants.MaxUint256)

                // Amount
                let amt = utils.parseEther('20')

                // Circulating Supply = 90 - 40 = 50 (of provider)
                let circ_supply = total_octo_supply.sub(PAIR_AMOUNT).abs();
                let dyn_burn_rate = (circ_supply.sub(PAIR_AMOUNT).abs().mul(9970).div(circ_supply))

                // On Pool Price Higher
                dyn_burn_rate = dyn_burn_rate.add(100).gt(BURN_RATE) ? BigNumber.from(100) : dyn_burn_rate.sub(BURN_RATE).abs();
                let burn_amount = dyn_burn_rate.mul(amt).div(10000)
                let fees = amt.mul(321).div(10000)

                let pair_before = await octaDahlia.balanceOf(pair_octo_A.address)

                // Send Amount to Buyer
                await hhImpersonate(pair_octo_A.address, async (pair) => {
                    await octaDahlia.connect(pair).transfer(buyer.address, amt)
                })

                let buyer_res = await octaDahlia.balanceOf(buyer.address)
                let pair_res = await octaDahlia.balanceOf(pair_octo_A.address)

                expect(pair_res.toString()).to.equal(pair_before.sub(amt).toString())
                expect(buyer_res.toString()).to.equal(amt.sub(fees).sub(burn_amount).toString())
            })
            it('should burn less if pool price is lower', async function () {
                let MINT_AMOUNT = utils.parseEther("50");
                let PAIR_AMOUNT = utils.parseEther("80");
                let BURN_RATE = 10 // .1%
                let MAX_BUY_PERCENT = 10000 // 100%

                let provider = users[4]
                let buyer = users[5]

                // Initialize OctaDahlia + Set Balance for MGE and PairV2
                await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, owner.address, false, BURN_RATE, MAX_BUY_PERCENT)

                // Mint for Accounts
                // Octo: Total Supply 50(e21)
                await octaDahlia.connect(owner).balanceAdjustment(true, MINT_AMOUNT, provider.address)

                let total_octo_supply = MINT_AMOUNT;

                // Mint Octo for Pair
                // Octo: Total Supply 110
                // Please see: https://github.com/RootkitFinance/octadahlia-contracts-eth/issues/7
                await octaDahlia.connect(owner).balanceAdjustment(true, PAIR_AMOUNT, pair_octo_A.address)
                total_octo_supply = total_octo_supply.add(PAIR_AMOUNT);

                // Approve
                await octaDahlia.connect(provider).approve(uniswap.router.address, constants.MaxUint256)
                await tokenA.connect(provider).approve(uniswap.router.address, constants.MaxUint256)
                await tokenB.connect(provider).approve(uniswap.router.address, constants.MaxUint256)

                // Amount
                let amt = utils.parseEther('20')

                // Circulating Supply = 90 - 40 = 50 (of provider)
                let circ_supply = total_octo_supply.sub(PAIR_AMOUNT).abs();
                let dyn_burn_rate = (circ_supply.sub(PAIR_AMOUNT).abs().mul(9970).div(circ_supply))

                let burn_amount = dyn_burn_rate.add(BURN_RATE).mul(amt).div(10000)
                let fees = amt.mul(321).div(10000)

                let pair_before = await octaDahlia.balanceOf(pair_octo_A.address)

                // Send Amount to Buyer
                await hhImpersonate(pair_octo_A.address, async (pair) => {
                    await octaDahlia.connect(pair).transfer(buyer.address, amt)
                })

                let buyer_res = await octaDahlia.balanceOf(buyer.address)
                let pair_res = await octaDahlia.balanceOf(pair_octo_A.address)

                expect(pair_res.toString()).to.equal(pair_before.sub(amt).toString())
                expect(buyer_res.toString()).to.equal(amt.sub(fees).sub(burn_amount).toString())
            })
        })

    })

    describe('alignPrices()', function () {

        function getAmountOut(amountIn: number, tokenPairBalance: number, octoPairBalance: number): number {
            let amountInWithFee = amountIn * 997;
            let numerator = amountInWithFee * tokenPairBalance;
            let denominator = octoPairBalance * 1000 + amountInWithFee;
            return Math.floor(numerator / denominator)
        }

        it.skip('should align price', async function () {
            let mge = users[2]
            let rift = owner;
            let RIFT_OCTO_BALANCE = 10;
            let UNI_PAIR_BALANCE = 100;
            let UNI_OCTO_BALANCE = 100;

            await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)

            // Set Rift and Token Balance
            await octaDahlia.connect(rift).balanceAdjustment(true, RIFT_OCTO_BALANCE, rift.address)
            await octaDahlia.connect(rift).balanceAdjustment(true, RIFT_OCTO_BALANCE, rift.address)
            await octaDahlia.connect(rift).balanceAdjustment(true, UNI_OCTO_BALANCE, pair_octo_A.address,)

            await tokenA.connect(owner).transfer(pair_octo_A.address, UNI_PAIR_BALANCE)

            ///Revert
            await expect(octaDahlia.connect(mge).alignPrices()).to.not.be.reverted

            await expect(octaDahlia.connect(rift).alignPrices()).to.not.be.reverted

        })
    })

    describe('recoverTokens(IERC20 token)', function () {
        it('should transfer tokens from octodahlia to user', async function () {

            // Setup OctaDahlia, the send octadahlia 100 tokens
            await octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, users[2].address, false, 0, 0)
            await tokenA.testMint(octaDahlia.address, 100)

            // Check balance of users[0] is zero
            await expect(await tokenA.connect(owner).balanceOf(users[0].address)).to.equal(0)
            // Transfer all Octadahlia tokens to users[0]
            await octaDahlia.connect(users[0]).recoverTokens(tokenA.address)

            await expect(await tokenA.connect(owner).balanceOf(users[0].address)).to.equal(100)
        })
    })

    describe('transferFrom(address sender, address recipient, uint256 amount)', function () {
        it('should not allow attacker to steal from unlocked pair liquid unlocked', async function () {
            let mge = users[2]
            let rift = owner;
            let RIFT_BALANCE = 10_000;

            await expect(octaDahlia.connect(owner).setUp(pair_octo_A.address, users[0].address, users[1].address, mge.address, false, 0, 0)).to.not.be.reverted
            await expect(octaDahlia.connect(rift).balanceAdjustment(true, RIFT_BALANCE, rift.address)).to.not.be.reverted

            await expect(octaDahlia.connect(attacker).transferFrom(rift.address, attacker.address, 100)).to.be.revertedWith("ERC20: allow")

            await expect(await octaDahlia.connect(attacker).balanceOf(attacker.address)).to.equal(0)

        })
    })

    describe.skip('internal', function () {
        describe('_transfer(address sender, address recipient, uint256 amount) internal', function () { })
        describe('_burnAndFees(address account, uint256 amount, uint256 burnPercent) internal', function () { })
        describe('dynamicBurnRate() internal', function () { })
        describe('getAmountOut(uint amountIn) internal', function () { })
    })

})
