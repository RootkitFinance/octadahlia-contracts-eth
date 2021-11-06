const hre = require("hardhat");
const ethers = hre.ethers;

const forkFrom = "https://speedy-nodes-nyc.moralis.io/1aa4d3cb15f8ba2db24211d7/bsc/mainnet/archive";//bb704b2a1409ecfe996325ed

const UniswapV2FactoryJson = require('../contracts/json/UniswapV2Factory.json');
const UniswapV2Router02Json = require('../contracts/json/UniswapV2Router02.json');
const { utils, constants } = require("ethers");

describe("MGE", function() {
    let tempAccount, buyer1, buyer2, seller1, seller2, seller3, seller4, seller5, busd, wbnb, flower, pool, timeRift;

    async function impersonate(address) {
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [address] }); 
        return await ethers.provider.getSigner(address);
    }

    async function reset() {
        await hre.network.provider.request({ method: "hardhat_reset", params: [{forking: { jsonRpcUrl: forkFrom, blockNumber: 11904984   }}] });
    }

    async function mineBlocks(blockNumber) {
        while (blockNumber > 0) {
          blockNumber--;
          await hre.network.provider.request({
            method: "evm_mine",
            params: [],
          });
        }
      }

    async function realPrice() {
        const pairedInPool = parseFloat(utils.formatEther(await busd.balanceOf(pool.address)));
        const flowerTotalSupply = parseFloat(utils.formatEther(await flower.totalSupply()));
        const flowerInPool = parseFloat(utils.formatEther(await flower.balanceOf(pool.address)));
        const flowerCirculatingSupply = flowerTotalSupply - flowerInPool;
        const price = pairedInPool/flowerCirculatingSupply;            
        return price.toString();
    }

    async function poolPrice() {
        const pairedInPool = utils.formatEther(await busd.balanceOf(pool.address));
        const flowerInPool = utils.formatEther(await flower.balanceOf(pool.address));
        const price = parseFloat(pairedInPool)/parseFloat(flowerInPool);
        return price.toString();        
    }

    async function logPrices() {
        console.log("Pool Price ", await poolPrice());
        //console.log("Real Price ", await realPrice());
    }

    beforeEach(async function() {
        await reset();
        [tempAccount] = await ethers.getSigners();
        uniswapV2Factory = new ethers.Contract("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", UniswapV2FactoryJson.abi, tempAccount);
        uniswapV2Router = new ethers.Contract("0x10ed43c718714eb63d5aa57b78b54704e256024e", UniswapV2Router02Json.abi, tempAccount);

        buyer1 = await impersonate("0xddabfa2a3eb8ac535a27c9c2ceaab24e3eca276f");
        bot = await impersonate("0x5497f5895d9b2a3ec7aa1e035900a468b668e92a");
        seller1 = await impersonate("0xddabfa2a3eb8ac535a27c9c2ceaab24e3eca276f");
        seller2 = await impersonate("0x5e2ee3c0fb094c1b9dfaf20fa97f93bdab45bb61");
        buyer2 = await impersonate("0x99b2a2b5342d1d810b7ac598ea0fcdbbd7e2f49e");
        seller3 = await impersonate("0x426e8d66d61ecc0c9c01f46eb410280116fc28f4");
        seller4 = await impersonate("0xddabfa2a3eb8ac535a27c9c2ceaab24e3eca276f");
        // seller5 = await impersonate("");
        
        
        flower = await ethers.getContractAt("OctaDahlia", "0xd54095087f542ceb2c05273160349d44f30b419e");
        timeRift = await ethers.getContractAt("TimeRift", "0x022a7620eef531ae9df90ae022c386341cb9e0fa");
        busd = await ethers.getContractAt("IERC20", "0xe9e7cea3dedca5984780bafc599bd69add087d56");
        wbnb = await ethers.getContractAt("IERC20", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c");
        pool = await ethers.getContractAt("IERC20", "0xf21f3e786513e097f14e28d8c13149f7415fbb2c");

        await tempAccount.sendTransaction({ to: seller2._address, value: utils.parseEther("0.5") });
        })

        it("trades", async function() {
           await logPrices();
           await uniswapV2Router.connect(buyer1).swapETHForExactTokens("27068000000000000000000", [wbnb.address, busd.address, flower.address], buyer1._address, "1634637564", {value: utils.parseEther("1.149778880280441555")});
           console.log("\n1. Buys with 1.149 BNB");
           await logPrices();

           await timeRift.connect(bot).balancePrices([2]);
           console.log("\n2. Balances Prices");
           await logPrices();

           await flower.connect(seller1).approve(uniswapV2Router.address, "230000000000000000000");

           await uniswapV2Router.connect(seller1).swapExactTokensForETHSupportingFeeOnTransferTokens("230000000000000000000", "0", [flower.address, busd.address, wbnb.address], seller1._address, "1634638900");
           console.log("\n3. Sells 230 OcDa");
           await logPrices();

           await flower.connect(seller2).approve(uniswapV2Router.address, "4231500000000000000000");

           await uniswapV2Router.connect(seller2).swapExactTokensForETHSupportingFeeOnTransferTokens("4231500000000000000000", "120788824424935255", [flower.address, busd.address, wbnb.address], seller2._address, "1634644895");
           console.log("\n4. Sells 4231 OcDa");
           await logPrices();

           await timeRift.connect(bot).balancePrices([2]);
           console.log("\n5. Balances Prices");
           await logPrices();

           await uniswapV2Router.connect(buyer2).swapExactTokensForTokens("100000000000000000000", "4890429349867934980029", [busd.address, flower.address], buyer2._address, "1634684094");
           console.log("\n6. Buys with 100 BUSD");
           await logPrices();

           await timeRift.connect(bot).balancePrices([2]);
           console.log("\n7. Balances Prices");
           await logPrices();

           await flower.connect(seller3).approve(uniswapV2Router.address, "3580361740009697269155");

           await uniswapV2Router.connect(seller3).swapExactTokensForTokensSupportingFeeOnTransferTokens("3580361740009697269155", "42934276024450478919", [flower.address, busd.address], seller3._address, "1635123629");
           console.log("\n8. Sells 3580 OcDa");
           await logPrices();

           await timeRift.connect(bot).balancePrices([2]);
           console.log("\n9. Balances Prices");
           await logPrices();

           await flower.connect(seller4).approve(uniswapV2Router.address, "22775093200000000000000");
           await uniswapV2Router.connect(seller4).swapExactTokensForTokensSupportingFeeOnTransferTokens("22775093200000000000000", "0", [flower.address, busd.address], seller4._address, "1635321551");
           console.log("\n10. Sells 22775 OcDa");
           await logPrices();

           await timeRift.connect(bot).balancePrices([2]);
           console.log("\n11. Balances Prices");
           await logPrices();

         
        }).timeout(2e19)
})