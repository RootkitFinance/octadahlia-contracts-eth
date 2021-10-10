const { ethers } = require("hardhat");
const { expect } = require("chai");
const { utils, constants } = require("ethers");
const { createUniswap } = require("./helpers");

describe.skip("TimeRift", function() {
    let owner, dev6, dev9, uniswap, timeRift, paired;

    const logInfo = async (flower) => {
        const balance = await flower.balanceOf(owner.address);
        const totalSupply = await flower.totalSupply();
        console.log(utils.formatEther(balance));
        console.log(utils.formatEther(totalSupply));
        console.log("");
    }

    beforeEach(async function() {
        [owner, dev6, dev9] = await ethers.getSigners();
        uniswap = await createUniswap(owner);

        const timeRiftFactory = await ethers.getContractFactory("TimeRift");
        timeRift = await timeRiftFactory.connect(owner).deploy(dev6.address, dev9.address, uniswap.factory.address);

        const pairedFactory = await ethers.getContractFactory("ERC20Test");
        paired = await pairedFactory.connect(owner).deploy();

        await paired.connect(owner).approve(timeRift.address, constants.MaxUint256);
        await paired.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
    })

    it("plants flower", async function() {
        const liquidity = utils.parseEther("10");
        await timeRift.connect(owner).OctaDahliaGrowsBrighter(paired.address, liquidity, liquidity);
        const flowerAddress = await timeRift.nonces(1);
        const flower = await ethers.getContractAt("OctaDahlia", flowerAddress);
        await logInfo(flower);

       // flower.connect(owner).transfer(dev9.address, utils.parseEther("0.1"));
        //await logInfo(flower);

        await flower.connect(owner).approve(timeRift.address, constants.MaxUint256);
        await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(utils.parseEther("0.1"), 0, [paired.address, flower.address], owner.address, 2e9);
        await logInfo(flower);


        await flower.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(utils.parseEther("0.1"), 0, [flower.address, paired.address], owner.address, 2e9);
        await logInfo(flower);

    })
})