// Helpers

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers, network } from "hardhat";

import UniswapV2PairJson from '../contracts/json/UniswapV2Pair.json';
import UniswapV2FactoryJson from '../contracts/json/UniswapV2Factory.json';
import UniswapV2Router02Json from '../contracts/json/UniswapV2Router02.json';
import UniswapV2LibraryJson from '../contracts/json/UniswapV2Library.json';

import { IUniswapV2Router02, IUniswapV2Factory, IUniswapV2Router01, IUniswapV2Pair } from '../typechain'


/**
 * Set Eth Balance to Account
 * @param address Account to Set Balance To
 * @param balance Amount in Hex String
 * @returns 
 */
export function hhSetBalance(address: string, balance: string) {
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
export async function hhImpersonate(address: string, callback: (signer: SignerWithAddress) => Promise<any>) {
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

export async function createUniswap(owner: SignerWithAddress) {
    const erc20Factory = await ethers.getContractFactory("ERC20Test");
    const weth = await erc20Factory.connect(owner).deploy("Wrapped Ether", "WETH", 18);

    const factory = (await new ethers.ContractFactory(UniswapV2FactoryJson.abi, UniswapV2FactoryJson.bytecode, owner).deploy(owner.address)) as IUniswapV2Factory;
    const router = (await new ethers.ContractFactory(UniswapV2Router02Json.abi, UniswapV2Router02Json.bytecode, owner).deploy(factory.address, weth.address)) as IUniswapV2Router02;
    const library = await new ethers.ContractFactory(UniswapV2LibraryJson.abi, UniswapV2LibraryJson.bytecode, owner).deploy();

    return {
        factory,
        router,
        library,
        weth,
        pairFor: (address: string) => new ethers.Contract(address, UniswapV2PairJson.abi, owner) as IUniswapV2Pair,
        UniswapV2PairJson,
        UniswapV2Router02Json,
        UniswapV2FactoryJson
    };
}

