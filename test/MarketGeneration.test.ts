import { ethers } from "hardhat";
import { utils, constants } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { createUniswap, hhSetBalance } from "./helpers";
import { ERC20, ERC20Test, ERC20Test__factory, IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Router02, LiquidityLockedERC20, MarketGeneration, MarketGeneration__factory, OctaDahlia, OctaDahlia__factory, TimeRift, TimeRift__factory } from "../typechain";

describe('MarketGeneration', function () {
    let owner: SignerWithAddress;
    let attacker: SignerWithAddress;
    let users: SignerWithAddress[];
    let dev6: SignerWithAddress;
    let dev9: SignerWithAddress;

    let tokenA: ERC20Test;
    let timeRift: TimeRift;
    let marketGenerationFactory: MarketGeneration__factory;
    let testTokenFactory: ERC20Test__factory;
    let timeRiftFactory: TimeRift__factory;
    let octaDahliaFactory: OctaDahlia__factory;

    let uniswap: {
        router: IUniswapV2Router02;
        factory: IUniswapV2Factory;
        weth: ERC20;
        pairFor: (address: string) => IUniswapV2Pair & ERC20,
        UniswapV2PairJson: { abi: any, bytecode: any };
        UniswapV2Router02Json: { abi: any, bytecode: any }
    };

    beforeEach(async function () {
        [owner, attacker, dev6, dev9, ...users] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        // Tokens
        testTokenFactory = await ethers.getContractFactory("ERC20Test");
        timeRiftFactory = await ethers.getContractFactory("TimeRift");
        marketGenerationFactory = await ethers.getContractFactory("MarketGeneration");
        octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");

        // TimeRift
        timeRift = await timeRiftFactory.connect(owner).deploy(dev6.address, dev9.address, uniswap.factory.address)
        tokenA = await testTokenFactory.connect(owner).deploy("Test Token A", "TKNA", 0);
    })

    describe('constructor(IERC20 _pairedToken, ITimeRift _timeRift)', function () {
        it('should initialize', async function () {
            let [dev6, dev9,] = users;
            expect(marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)).to.not.be.reverted
        })
    })
    describe('setHardCap(uint256 _totalHardCap, uint256 _individualHardCap)', function () {
        it('should only run with owners', async function () {
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)
            expect(marketGeneration.connect(attacker).setHardCap(0, 0)).to.be.reverted
        })
        it('should set cap', async function () {
            let totalHardCap = utils.parseEther('1')
            let individualHardCap = utils.parseEther('2')
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)
            await marketGeneration.connect(owner).setHardCap(totalHardCap, individualHardCap);

            expect(await marketGeneration.totalHardCap()).to.equal(totalHardCap)
            expect(await marketGeneration.individualHardCap()).to.equal(individualHardCap)

        })
    })
    describe('activate()', function () {
        it('should only run with owners', async function () {
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)
            expect(marketGeneration.connect(attacker).activate()).to.be.reverted
        })
        it('should activate', async function () {
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)
            await marketGeneration.connect(owner).activate();
            expect(await marketGeneration.isActive()).to.be.true
        })
    })

    describe('complete(uint256 octaDalhiaPerPaired, uint256 burnRate, uint256 maxBuyPercent)', function () {
        it('should create a new pool with new octadahlia token and input token', async function () {
            let [rootFeeder, devFeeder] = users;
            let octaDahliaPerPaired = 1
            let marketGenerationBalance = utils.parseEther('1')
            let burnRate = utils.parseEther('0')
            let maxBuyPercent = utils.parseEther('1')
            let totalHardCap = utils.parseEther('101')
            let individualHardCap = utils.parseEther('101')
            let MgeTokenABalance = utils.parseEther('100')

            // Set Token as Weth
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('1'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)
            tokenA.connect(owner).testMint(marketGeneration.address, MgeTokenABalance)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)

            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(marketGeneration.address, true)
            await timeRift.connect(owner).addExtraOwners(4, marketGeneration.address)

            // Activate Distribution
            await marketGeneration.connect(owner).activate()
            // Set Cap + Contribute
            let contribution = utils.parseUnits('100')
            await marketGeneration.setHardCap(totalHardCap, individualHardCap);
            await marketGeneration.connect(owner).contribute({ value: contribution })

            // Set Balance to Deposit/Exchange
            await marketGeneration.connect(owner).complete(octaDahliaPerPaired, burnRate, maxBuyPercent)

            // Check Created Contracts
            let createdOctaAddress = await marketGeneration.octaDahlia()
            let createdPoolAddress = await timeRift.pools(await createdOctaAddress)

            let octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
            let createdOcta = octaDahliaFactory.attach(createdOctaAddress)
            let createdPair = uniswap.pairFor(createdPoolAddress)

            // Check Balances
            let splitterAllowance = await tokenA.allowance(timeRift.address, feeSplitter.address)
            let poolOctaBalance = await createdOcta.balanceOf(createdPair.address)
            let mgeOctaBalance = await createdOcta.balanceOf(marketGeneration.address)
            let poolABalance = await tokenA.balanceOf(createdPair.address)
            let supply = await marketGeneration.startingSupply()

            expect(mgeOctaBalance).to.equal(MgeTokenABalance.mul(octaDahliaPerPaired))
            expect(poolOctaBalance).to.equal(MgeTokenABalance.mul(octaDahliaPerPaired))
            expect(splitterAllowance).to.equal(constants.MaxUint256)
            expect(supply).to.equal(MgeTokenABalance.mul(octaDahliaPerPaired))
        })
    })
    describe('claim()', function () {
        it('should not allow claiming until distribution is completed', async function () {
            let [rootFeeder, devFeeder] = users;
            let octaDahliaPerPaired = 1
            let burnRate = utils.parseEther('0')
            let maxBuyPercent = utils.parseEther('1')
            let totalHardCap = utils.parseEther('101')
            let individualHardCap = utils.parseEther('101')
            let MgeTokenABalance = utils.parseEther('100')
            let user = users[1];

            // Set Token as Weth
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('1'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)
            tokenA.connect(owner).testMint(marketGeneration.address, MgeTokenABalance)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)

            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(marketGeneration.address, true)
            await timeRift.connect(owner).addExtraOwners(4, marketGeneration.address)

            // Activate Distribution
            await marketGeneration.connect(owner).activate()
            // Set Cap + Contribute
            let contribution = utils.parseUnits('100')
            await marketGeneration.setHardCap(totalHardCap, individualHardCap);
            await marketGeneration.connect(owner).contribute({ value: contribution })

            // Since We have not completed the distrubtion, reject
            expect(marketGeneration.connect(owner).claim()).to.be.reverted
        })
        it('should get 100% if contribution == totalContribution', async function () {
            let [rootFeeder, devFeeder] = users;
            let octaDahliaPerPaired = 1
            let burnRate = 0
            let maxBuyPercent = utils.parseEther('1')
            let totalHardCap = utils.parseEther('101')
            let individualHardCap = utils.parseEther('101')
            let MgeTokenABalance = utils.parseEther('100')
            let contributor = users[4];

            // Set Token as Weth
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('1'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)
            tokenA.connect(owner).testMint(marketGeneration.address, MgeTokenABalance)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)

            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(marketGeneration.address, true)
            await timeRift.connect(owner).addExtraOwners(4, marketGeneration.address)

            // Activate Distribution
            await marketGeneration.connect(owner).activate()
            // Set Cap + Contribute
            await marketGeneration.setHardCap(totalHardCap, individualHardCap);

            // Contribute
            let contribution = utils.parseUnits('100')
            await marketGeneration.connect(contributor).contribute({ value: contribution })

            // Set Balance to Deposit/Exchange
            await marketGeneration.connect(owner).complete(octaDahliaPerPaired, burnRate, maxBuyPercent)

            let createdOcta = octaDahliaFactory.attach(await marketGeneration.octaDahlia());
            let balance_rift = await createdOcta.balanceOf(timeRift.address);

            // Claim, should get full totalContribution
            await marketGeneration.connect(contributor).claim();
            let balance_contributor = await createdOcta.balanceOf(contributor.address);
            let balance_fee = balance_rift.sub(await createdOcta.balanceOf(timeRift.address))
            let total_supply = await marketGeneration.startingSupply();
            let total_contribution = await marketGeneration.totalContribution()

            expect(total_contribution).to.equal(total_supply)
            expect(balance_contributor).to.equal(total_contribution.add(balance_fee))
        })
        it('should get 0% if contribution == 0', async function () {
            let [rootFeeder, devFeeder] = users;
            let octaDahliaPerPaired = 1
            let burnRate = 0
            let maxBuyPercent = utils.parseEther('1')
            let totalHardCap = utils.parseEther('101')
            let individualHardCap = utils.parseEther('101')
            let MgeTokenABalance = utils.parseEther('100')
            let contributor = users[4];

            // Set Token as Weth
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('1'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)
            tokenA.connect(owner).testMint(marketGeneration.address, MgeTokenABalance)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)

            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(marketGeneration.address, true)
            await timeRift.connect(owner).addExtraOwners(4, marketGeneration.address)

            // Activate Distribution
            await marketGeneration.connect(owner).activate()
            // Set Cap + Contribute
            await marketGeneration.setHardCap(totalHardCap, individualHardCap);

            // Contribute
            let user_contribution = utils.parseUnits('0')
            let owner_contribution = utils.parseUnits('100')
            await marketGeneration.connect(contributor).contribute({ value: user_contribution })
            await marketGeneration.connect(owner).contribute({ value: owner_contribution })

            // Set Balance to Deposit/Exchange
            await marketGeneration.connect(owner).complete(octaDahliaPerPaired, burnRate, maxBuyPercent)

            let createdOcta = octaDahliaFactory.attach(await marketGeneration.octaDahlia());
            let balance_rift = await createdOcta.balanceOf(timeRift.address);

            // Claim, should get full totalContribution
            expect(marketGeneration.connect(contributor).claim()).to.be.reverted;
            let balance_contributor = await createdOcta.balanceOf(contributor.address);
            let balance_fee = balance_rift.sub(await createdOcta.balanceOf(timeRift.address))
            let total_supply = await marketGeneration.startingSupply();
            let total_contribution = await marketGeneration.totalContribution()

            expect(total_contribution).to.equal(total_supply)
            expect(balance_contributor).to.equal(0)
        })
        it('should get 50% if contribution == totalContribution / 2', async function () {
            let [rootFeeder, devFeeder] = users;
            let octaDahliaPerPaired = 1
            let burnRate = 0
            let maxBuyPercent = utils.parseEther('1')
            let totalHardCap = utils.parseEther('101')
            let individualHardCap = utils.parseEther('101')
            let MgeTokenABalance = utils.parseEther('100')
            let contributor = users[4];

            // Set Token as Weth
            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('1'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)
            tokenA.connect(owner).testMint(marketGeneration.address, MgeTokenABalance)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)

            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(marketGeneration.address, true)
            await timeRift.connect(owner).addExtraOwners(4, marketGeneration.address)

            // Activate Distribution
            await marketGeneration.connect(owner).activate()
            // Set Cap + Contribute
            await marketGeneration.setHardCap(totalHardCap, individualHardCap);

            // Contribute
            let user_contribution = utils.parseUnits('50')
            let owner_contribution = utils.parseUnits('50')
            await marketGeneration.connect(contributor).contribute({ value: user_contribution })
            await marketGeneration.connect(owner).contribute({ value: owner_contribution })

            // Set Balance to Deposit/Exchange
            await marketGeneration.connect(owner).complete(octaDahliaPerPaired, burnRate, maxBuyPercent)

            let createdOcta = octaDahliaFactory.attach(await marketGeneration.octaDahlia());
            let balance_rift = await createdOcta.balanceOf(timeRift.address);

            // Claim, should get full totalContribution
            await marketGeneration.connect(contributor).claim();
            let balance_contributor = await createdOcta.balanceOf(contributor.address);
            let balance_fee = balance_rift.sub(await createdOcta.balanceOf(timeRift.address))
            let total_supply = await marketGeneration.startingSupply();
            let total_contribution = await marketGeneration.totalContribution()

            expect(total_contribution).to.equal(total_supply)
            expect(balance_contributor).to.equal(total_contribution.div(2).add(balance_fee))
        })
    })
    describe('contribute()', function () {
        it('should allow if value < indidualHardCap && totalContribution < totalHardCap', async function () {
            let totalHardCap = utils.parseEther('100')
            let individualHardCap = utils.parseEther('1')
            let contribution = utils.parseEther('0.9')
            let user = users[4]

            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            await marketGeneration.connect(owner).activate()
            await marketGeneration.connect(owner).setHardCap(totalHardCap, individualHardCap)
            let req = marketGeneration.connect(user).contribute({ value: contribution })
            expect(req).to.not.be.reverted
            let user_contribution = await marketGeneration.contribution(user.address)
            let total_contribution = await marketGeneration.totalContribution()
            expect(user_contribution).to.equal(contribution)
            expect(total_contribution).to.equal(contribution)
        })
        it('should reject if value >= individualHardCap', async function () {
            let totalHardCap = utils.parseEther('100')
            let individualHardCap = utils.parseEther('1')
            let contribution = individualHardCap.add(100)
            let user = users[4]

            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            await marketGeneration.connect(owner).activate()
            await marketGeneration.connect(owner).setHardCap(totalHardCap, individualHardCap)
            let req = marketGeneration.connect(user).contribute({ value: contribution })
            expect(req).to.be.reverted
        })
        it('should reject if totalContribution >= totalHardCap', async function () {
            let totalHardCap = utils.parseEther('100')
            let individualHardCap = utils.parseEther('101')
            let contribution = totalHardCap
            let user = users[4]

            let marketGeneration = await marketGenerationFactory.connect(owner).deploy(tokenA.address, timeRift.address)

            await marketGeneration.connect(owner).activate()
            await marketGeneration.connect(owner).setHardCap(totalHardCap, individualHardCap)
            let req = marketGeneration.connect(user).contribute({ value: contribution })
            expect(req).to.be.reverted
        })
    })
    describe('getTotalClaim(address account)', function () {
        // it('should only run with owners', async function() {
        //     expect(timeRift.connect(attacker).recoverTokens(tokenA.address)).to.be.reverted
        // })
        // it('should recover tokens', async function() {
        //     let timeRiftBalance = utils.parseEther('100');
        //     await tokenA.testMint(timeRift.address, timeRiftBalance)
        //     await timeRift.connect(owner).recoverTokens(tokenA.address)
        //     expect(await tokenA.balanceOf(owner.address)).to.equal(timeRiftBalance)
        // })
    })
})