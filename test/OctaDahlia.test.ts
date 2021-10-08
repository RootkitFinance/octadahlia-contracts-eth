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

    let owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress;
    let octaDahlia: OctaDahlia & Contract;
    let paired: Contract;
    let uniswap: { 
        router: Contract; 
        factory: Contract; 
        weth: Contract; 
        UniswapV2PairJson: { abi: any, bytecode: any }; 
        UniswapV2Router02Json: { abi: any, bytecode: any } 
    };
    let pair: Contract;

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        const octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
        octaDahlia = (await octaDahliaFactory.connect(owner).deploy()) as any as OctaDahlia & Contract

        const pairedFactory = await ethers.getContractFactory("ERC20Test");
        paired = await pairedFactory.connect(owner).deploy();

        await paired.connect(owner).approve(octaDahlia.address, constants.MaxUint256);
        await paired.connect(owner).approve(uniswap.router.address, constants.MaxUint256);

        await uniswap.factory.connect(owner).createPair(octaDahlia.address, paired.address)

        let pair_address = await uniswap.factory.connect(owner).getPair(octaDahlia.address, paired.address)
        pair = await ethers.getContractAt(uniswap.UniswapV2PairJson.abi, pair_address)
    })

    describe('setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator)', function () {
        it('should only initialize once', async function () {
            let mge_address = user3.address

            await expect(octaDahlia.connect(owner).setUp(pair.address, user1.address, user2.address, mge_address, false)).to.not.be.reverted
            await expect(octaDahlia.connect(owner).setUp(uniswap.router.address, user1.address, user2.address, mge_address, false)).to.be.reverted
        })
        it('should only allow pair that includes correct token')
    })
    describe('balanceAdjustment(bool increase, uint256 _amount, address _account)', function () {

    })

    describe('alignPrices()', function () { })

    describe('recoverTokens(IERC20 token)', function () { })
    describe('addOrChangeFriends(uint256 indexSpot, address friend)', function () { })


    describe('_transfer(address sender, address recipient, uint256 amount) internal', function () { })
    describe('_burnAndFees(address account, uint256 amount, uint256 burnPercent) internal', function () { })
    describe('dynamicBurnRate() internal', function () { })
    describe('getAmountOut(uint amountIn) internal', function () { })


})
