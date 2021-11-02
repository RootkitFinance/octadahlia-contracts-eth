import { ethers } from "hardhat";
import { utils, constants } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { createUniswap } from "./helpers";
import { ERC20, ERC20Test, IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Router02, LiquidityLockedERC20, TimeRift } from "../typechain";

describe('TimeRift', function() {
    let owner: SignerWithAddress;
    let attacker: SignerWithAddress;
    let users: SignerWithAddress[];
    let dev6: SignerWithAddress;
    let dev9: SignerWithAddress;

    let tokenA: ERC20Test;
    let timeRift: TimeRift;

    let uniswap: {
        router: IUniswapV2Router02;
        factory: IUniswapV2Factory;
        weth: ERC20;
        pairFor: (address: string) => IUniswapV2Pair & ERC20,
        UniswapV2PairJson: { abi: any, bytecode: any };
        UniswapV2Router02Json: { abi: any, bytecode: any }
    };

    beforeEach(async function() {
        [owner, attacker, dev6, dev9, ...users] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        // Tokens
        const testTokenFactory = await ethers.getContractFactory("ERC20Test");
        const timeRiftFactory = await ethers.getContractFactory("TimeRift");
        
        // TimeRift
        timeRift = await timeRiftFactory.connect(owner).deploy(dev6.address, dev9.address, uniswap.factory.address)
        tokenA = await testTokenFactory.connect(owner).deploy("Test Token A", "TKNA", 0);
    })
    describe('constructor(address _dev6, address _dev9, IUniswapV2Factory _uniswapFactory)', function() {
        it('should initialize', async function() {
            let [dev6, dev9, ] = users;
            let timeRiftFactory = await ethers.getContractFactory("TimeRift");
            expect(timeRiftFactory.connect(owner).deploy(dev6.address, dev9.address, uniswap.factory.address)).to.not.be.reverted
        })
    })
    describe('enableMge(address _mge, bool _enable) public', function() {
        it('should only run with owners', async function() {
            expect(timeRift.connect(attacker).enableMge(attacker.address, true)).to.be.reverted
        })
        it('should set mge', async function() {
            let mge = users[0]
            await timeRift.connect(owner).enableMge(mge.address, true);
            expect(await timeRift.MGEs(mge.address)).to.be.true
        })
    })
    describe('enableBalancer(address _balancer, bool _enable)', function() {
        it('should only run with owners', async function() {
            expect(timeRift.connect(attacker).enableBalancer(attacker.address, true)).to.be.reverted
        })
        it('should set balancer', async function() {
            let balancer = users[0]
            await timeRift.connect(owner).enableBalancer(balancer.address, true);
            expect(await timeRift.balancers(balancer.address)).to.be.true
        })
    })
    describe('setFlowerFeeSplitter(IFlowerFeeSplitter _flowerFeeSplitter)', function() {
        it('should only run with owners', async function() {
            expect(timeRift.connect(attacker).setFlowerFeeSplitter(attacker.address)).to.be.reverted
        })
        it('should set flowerFeeSplitter', async function() {
            let [mge, rootFeeder, devFeeder] = users;
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)
    
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            expect(await timeRift.splitter()).to.equal(feeSplitter.address)
        })
    })
    describe('setDabPercent(uint256 _dabPercent)', function() {
        it('should only run with owners', async function() {
            let dabPercent = utils.parseEther('0')
            expect(timeRift.connect(attacker).setDabPercent(dabPercent)).to.be.reverted
        })
        it('should set balancer', async function() {
            let dabPercent = utils.parseEther('1')
            await timeRift.connect(owner).setDabPercent(dabPercent);
            expect(await timeRift.dabPercent()).to.equal(dabPercent)
        })
    })
    describe('OctaDahliaGrowsBrighter(IERC20 pairedToken, uint256 startingLiquidity, uint256 startingTokenSupply, bool dictate, uint256 burnRate, uint256 maxBuyPercent)', function() {
        it('should create a new pool with new octadahlia token and input token', async function() {
            let [rootFeeder, devFeeder] = users;
            let mge = owner;
            let startingLiquidity = utils.parseEther('101')
            let startingTokenSupply = utils.parseEther('100')
            let dictate = true;
            let burnRate = utils.parseEther('1')
            let maxBuyPercent = utils.parseEther('1')

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('100000000'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)
            
            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(mge.address, true)
            
            // Creates a pool and octa token
            await timeRift.connect(owner).OctaDahliaGrowsBrighter(tokenA.address, startingLiquidity, startingTokenSupply, dictate, burnRate, maxBuyPercent)
            
            // Check Created Contracts
            let createdOctaAddress = await timeRift.nonces(await timeRift.lastNonce())
            let createdPoolAddress = await timeRift.pools(await createdOctaAddress)
            
            let octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
            let createdOcta = octaDahliaFactory.attach(createdOctaAddress)
            let createdPair = uniswap.pairFor(createdPoolAddress)

            // Check Balances
            let ownerOctaBalance = await createdOcta.balanceOf(owner.address)
            let poolOctaBalance = await createdOcta.balanceOf(createdPair.address)
            let poolABalance = await tokenA.balanceOf(createdPair.address)
            let splitterAllowance = await tokenA.allowance(timeRift.address, feeSplitter.address)

            expect(ownerOctaBalance).to.equal(startingTokenSupply)
            expect(poolOctaBalance).to.equal(startingTokenSupply)
            expect(poolABalance).to.equal(startingLiquidity)
            expect(splitterAllowance).to.equal(constants.MaxUint256)
        })
    })
    describe('balancePrices(uint256[] memory noncesToBalance)', function() {
        it('should balance an octa token', async function() {
            let [rootFeeder, devFeeder] = users;
            let mge = owner;
            let startingLiquidity = utils.parseEther('101')
            let startingTokenSupply = utils.parseEther('100')
            let dictate = true;
            let burnRate = utils.parseEther('1')
            let maxBuyPercent = utils.parseEther('1')

            // Mint Token for Owner, set Approvals
            tokenA.testMint(owner.address, utils.parseEther('100000000'))
            tokenA.connect(owner).approve(timeRift.address, constants.MaxUint256)
            tokenA.connect(owner).approve(uniswap.router.address, constants.MaxUint256)

            // Set Splitter, set controller
            let feeSplitterFactory = await ethers.getContractFactory('FlowerFeeSplitter')
            let feeSplitter = await feeSplitterFactory.connect(owner).deploy(rootFeeder.address, devFeeder.address)
            
            await feeSplitter.setController(timeRift.address, true)
            await timeRift.connect(owner).setFlowerFeeSplitter(feeSplitter.address);
            await timeRift.connect(owner).enableMge(mge.address, true)
            
            // Creates a pool and octa token
            await timeRift.connect(owner).OctaDahliaGrowsBrighter(tokenA.address, startingLiquidity, startingTokenSupply, dictate, burnRate, maxBuyPercent)
            
            // Check Created Contracts
            let createdOctaAddress = await timeRift.nonces(await timeRift.lastNonce())
            let createdPoolAddress = await timeRift.pools(await createdOctaAddress)
            
            let octaDahliaFactory = await ethers.getContractFactory("OctaDahlia");
            let createdOcta = octaDahliaFactory.attach(createdOctaAddress)
            let createdPair = uniswap.pairFor(createdPoolAddress)
            
            let rift_balance_octa = utils.parseEther('1')
            await createdOcta.balanceAdjustment(true, rift_balance_octa, timeRift.address)
            await createdOcta.balanceOf(timeRift.address)

            let pair_balance = {
                octa: await createdOcta.balanceOf(createdPair.address),
                A: await tokenA.balanceOf(createdPair.address)
            };
            let totalSupply = await createdOcta.totalSupply()
            let expected_pair_balance = totalSupply.sub(pair_balance.octa.add(rift_balance_octa))
            
            // Balance only one pair
            await timeRift.balancePrices([1])
            let new_pair_balance_octa = await createdOcta.balanceOf(createdPair.address);
            
            expect(new_pair_balance_octa).to.equal(expected_pair_balance)
            expect(await createdOcta.balanceOf(timeRift.address)).to.equal(utils.parseEther('0'))
        })
    })
    describe('whoNeedsBalance() public view returns (uint256[] memory)', function() {})
    describe('recoverTokens(IERC20 token)', function() {
        it('should only run with owners', async function() {
            expect(timeRift.connect(attacker).recoverTokens(tokenA.address)).to.be.reverted
        })
        it('should recover tokens', async function() {
            let timeRiftBalance = utils.parseEther('100');
            await tokenA.testMint(timeRift.address, timeRiftBalance)
            await timeRift.connect(owner).recoverTokens(tokenA.address)
            expect(await tokenA.balanceOf(owner.address)).to.equal(timeRiftBalance)
        })
    })
})